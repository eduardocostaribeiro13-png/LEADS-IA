-- =====================================================================
-- LEAD HUNTER AI — core schema
-- =====================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  whatsapp text,
  instagram text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- settings (one row per user)
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  ticket_min numeric not null default 1000,
  ticket_max numeric not null default 6000,
  avg_ticket numeric not null default 2500,
  close_rate numeric not null default 20,
  priority_cities text[] not null default '{}',
  priority_segments text[] not null default '{}',
  message_tone text not null default 'consultivo',
  malta_goal_eur numeric not null default 30000,
  eur_brl numeric not null default 6.2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.settings to authenticated;
grant all on public.settings to service_role;
alter table public.settings enable row level security;
create policy "own settings" on public.settings for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- services offered by the user
create table public.services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  description text,
  price_min numeric not null default 0,
  price_max numeric not null default 0,
  delivery_days integer,
  priority integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_user_idx on public.services(user_id);
grant select, insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "own services" on public.services for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- leads
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  company_name text not null,
  category text,
  description text,
  address text,
  city text,
  state text,
  country text default 'Brasil',
  phone text,
  whatsapp text,
  email text,
  website text,
  instagram text,
  facebook text,
  google_maps_url text,
  rating numeric,
  review_count integer,
  followers integer,
  source text not null default 'manual',
  is_demo boolean not null default false,
  status text not null default 'novo' check (status in ('novo','analisado','qualificado','contatado','respondeu','interessado','proposta','negociacao','fechado','perdido')),
  tags text[] not null default '{}',
  lead_score integer not null default 0 check (lead_score between 0 and 100),
  investment_score integer not null default 0,
  website_need_score integer not null default 0,
  digital_presence_score integer not null default 0,
  sales_potential_score integer not null default 0,
  problem_score integer not null default 0,
  potential_value_min numeric,
  potential_value_max numeric,
  recommended_offer text,
  main_problem text,
  next_contact_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_user_idx on public.leads(user_id);
create index leads_score_idx on public.leads(user_id, lead_score desc);
create index leads_status_idx on public.leads(user_id, status);
create index leads_city_idx on public.leads(user_id, city);
grant select, insert, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;
alter table public.leads enable row level security;
create policy "own leads" on public.leads for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- audits
create table public.lead_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  website_findings jsonb not null default '[]'::jsonb,
  google_findings jsonb not null default '[]'::jsonb,
  social_findings jsonb not null default '[]'::jsonb,
  problems jsonb not null default '[]'::jsonb,
  summary text,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index lead_audits_lead_idx on public.lead_audits(lead_id);
grant select, insert, update, delete on public.lead_audits to authenticated;
grant all on public.lead_audits to service_role;
alter table public.lead_audits enable row level security;
create policy "own audits" on public.lead_audits for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- opportunities / offers
create table public.lead_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  opportunity_summary text,
  service_name text,
  rationale text,
  benefits jsonb not null default '[]'::jsonb,
  structure jsonb not null default '[]'::jsonb,
  price_min numeric,
  price_max numeric,
  sales_argument text,
  urgency text,
  cta text,
  website_prompt text,
  created_at timestamptz not null default now()
);
create index lead_opportunities_lead_idx on public.lead_opportunities(lead_id);
grant select, insert, update, delete on public.lead_opportunities to authenticated;
grant all on public.lead_opportunities to service_role;
alter table public.lead_opportunities enable row level security;
create policy "own opportunities" on public.lead_opportunities for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- design references
create table public.design_references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  name text not null,
  url text,
  reason text,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index design_references_lead_idx on public.design_references(lead_id);
grant select, insert, update, delete on public.design_references to authenticated;
grant all on public.design_references to service_role;
alter table public.design_references enable row level security;
create policy "own references" on public.design_references for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- outreach messages
create table public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null default 'whatsapp' check (channel in ('whatsapp','instagram','email','linkedin')),
  step text not null default 'primeiro' check (step in ('primeiro','segundo','terceiro','final')),
  content text not null,
  sent boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index outreach_lead_idx on public.outreach_messages(lead_id);
grant select, insert, update, delete on public.outreach_messages to authenticated;
grant all on public.outreach_messages to service_role;
alter table public.outreach_messages enable row level security;
create policy "own outreach" on public.outreach_messages for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- proposals
create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lead_id uuid references public.leads(id) on delete set null,
  client_name text not null,
  service_name text,
  description text,
  scope jsonb not null default '[]'::jsonb,
  delivery_days integer,
  price numeric not null default 0,
  conditions text,
  valid_until date,
  notes text,
  status text not null default 'rascunho' check (status in ('rascunho','enviada','visualizada','aceita','recusada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index proposals_user_idx on public.proposals(user_id);
grant select, insert, update, delete on public.proposals to authenticated;
grant all on public.proposals to service_role;
alter table public.proposals enable row level security;
create policy "own proposals" on public.proposals for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- financial transactions
create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lead_id uuid references public.leads(id) on delete set null,
  description text not null,
  amount numeric not null default 0,
  kind text not null default 'fechada' check (kind in ('fechada','prevista')),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index finance_user_idx on public.financial_transactions(user_id);
grant select, insert, update, delete on public.financial_transactions to authenticated;
grant all on public.financial_transactions to service_role;
alter table public.financial_transactions enable row level security;
create policy "own finance" on public.financial_transactions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, read);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- score feedback (learning loop)
create table public.lead_score_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lead_id uuid references public.leads(id) on delete cascade,
  score_before integer,
  converted boolean not null default false,
  deal_value numeric,
  reason text,
  created_at timestamptz not null default now()
);
create index feedback_user_idx on public.lead_score_feedback(user_id);
grant select, insert, update, delete on public.lead_score_feedback to authenticated;
grant all on public.lead_score_feedback to service_role;
alter table public.lead_score_feedback enable row level security;
create policy "own feedback" on public.lead_score_feedback for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger leads_touch before update on public.leads for each row execute function public.touch_updated_at();
create trigger proposals_touch before update on public.proposals for each row execute function public.touch_updated_at();
create trigger services_touch before update on public.services for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- create profile + defaults on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do nothing;

  insert into public.settings (user_id) values (new.id) on conflict (user_id) do nothing;

  insert into public.services (user_id, name, description, price_min, price_max, delivery_days, priority)
  values
    (new.id, 'Website Premium', 'Site institucional completo com foco em autoridade e conversão.', 2500, 6000, 21, 1),
    (new.id, 'Landing Page de Alta Conversão', 'Página única focada em captar contatos via WhatsApp.', 1000, 3000, 7, 2),
    (new.id, 'Página HTML', 'Página simples e rápida para presença mínima.', 500, 2000, 4, 4),
    (new.id, 'Redesign de Site', 'Modernização de site existente com foco em conversão.', 1500, 5000, 14, 3);
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();