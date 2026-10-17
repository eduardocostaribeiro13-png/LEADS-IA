begin;

create table public.hunt_schedules (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  city text not null check (length(trim(city)) between 1 and 100),
  state text not null default '' check (length(state) <= 100),
  country text not null default 'Brasil' check (length(trim(country)) between 1 and 100),
  segment text not null check (segment in ('Clínicas','Odontologia','Advocacia','Imobiliárias','Restaurantes','Hotéis','Pousadas','Academias','Salões','Barbearias','Lojas')),
  quantity integer not null default 10 check (quantity between 1 and 20),
  updated_at timestamptz not null default now()
);
alter table public.hunt_schedules enable row level security;
grant select, insert, update, delete on public.hunt_schedules to authenticated;
grant all on public.hunt_schedules to service_role;
create policy "own hunt schedule" on public.hunt_schedules for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger hunt_schedules_touch before update on public.hunt_schedules
  for each row execute function public.touch_updated_at();

create table public.hunt_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.hunt_schedules(user_id) on delete cascade,
  run_day date not null,
  status text not null check (status in ('running','completed','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  inserted_count integer not null default 0,
  error text,
  attempt integer not null default 1,
  lease_token uuid not null default gen_random_uuid(),
  unique (user_id, run_day)
);
alter table public.hunt_runs enable row level security;
grant select on public.hunt_runs to authenticated;
grant all on public.hunt_runs to service_role;
create policy "own hunt results" on public.hunt_runs for select to authenticated using (auth.uid() = user_id);

alter table public.leads add column external_id text;
create unique index leads_source_identity on public.leads(user_id, source, external_id);

-- Only the trusted background worker can claim work. No service credential reaches the browser/MCP.
create function public.claim_daily_hunt(p_user_id uuid)
returns setof public.hunt_runs
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.hunt_schedules where user_id = p_user_id and enabled) then
    return;
  end if;
  return query
  insert into public.hunt_runs(user_id, run_day, status)
  values (p_user_id, (now() at time zone 'America/Sao_Paulo')::date, 'running')
  on conflict (user_id, run_day) do update
    set status = 'running', started_at = now(), finished_at = null, error = null,
        attempt = hunt_runs.attempt + 1, lease_token = gen_random_uuid()
    where hunt_runs.attempt < 3 and (hunt_runs.status = 'failed'
      or (hunt_runs.status = 'running' and hunt_runs.started_at < now() - interval '40 minutes'))
  returning *;
end $$;
revoke all on function public.claim_daily_hunt(uuid) from public, anon, authenticated;
grant execute on function public.claim_daily_hunt(uuid) to service_role;

commit;
