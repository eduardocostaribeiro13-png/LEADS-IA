import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PanelCard } from "./PanelCard";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { SEGMENTS } from "@/services/leadHunterService";

export function DailyHunt() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [draft, setDraft] = useState<
    Partial<{ city: string; state: string; segment: string; quantity: number; enabled: boolean }>
  >({});
  const query = useQuery({
    queryKey: ["daily-hunt", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [schedule, runs] = await Promise.all([
        supabase.from("hunt_schedules").select("*").eq("user_id", user!.id).maybeSingle(),
        supabase
          .from("hunt_runs")
          .select("*")
          .eq("user_id", user!.id)
          .order("started_at", { ascending: false })
          .limit(5),
      ]);
      if (schedule.error || runs.error)
        throw new Error(
          "A busca diária ainda não está disponível. Tente novamente após a configuração do serviço.",
        );
      return { schedule: schedule.data, runs: runs.data ?? [] };
    },
  });
  const value = {
    city: "Curitiba",
    state: "PR",
    segment: "Restaurantes",
    quantity: 10,
    enabled: false,
    ...query.data?.schedule,
    ...draft,
  };
  const save = useMutation({
    mutationFn: async () => {
      if (!user || !query.isSuccess) throw new Error("Aguarde o carregamento das configurações.");
      if (!value.city.trim()) throw new Error("Informe uma cidade.");
      const { data, error } = await supabase
        .from("hunt_schedules")
        .upsert({
          user_id: user.id,
          enabled: value.enabled,
          city: value.city.trim(),
          state: value.state.trim(),
          country: "Brasil",
          segment: value.segment,
          quantity: value.quantity,
        })
        .select("user_id")
        .single();
      if (error || !data) throw new Error("Não foi possível salvar a busca diária.");
    },
    onSuccess: async () => {
      setDraft({});
      await client.invalidateQueries({ queryKey: ["daily-hunt", user?.id] });
      toast.success("Preferências da busca diária salvas.");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <PanelCard
      title="Busca diária automática"
      subtitle="Busca e salva empresas mesmo quando o site está fechado."
      className="mt-6"
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Todos os dias a partir das 9h17 (Brasília), com novas tentativas em caso de falha. A fonte
        gratuita pode ter poucos resultados; empresas repetidas são ignoradas.
      </p>
      {query.error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {query.error.message}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="daily-city">Cidade</Label>
          <Input
            id="daily-city"
            value={value.city}
            onChange={(e) => setDraft({ ...draft, city: e.target.value })}
            maxLength={100}
          />
        </div>
        <div>
          <Label htmlFor="daily-state">Estado</Label>
          <Input
            id="daily-state"
            value={value.state}
            onChange={(e) => setDraft({ ...draft, state: e.target.value })}
            maxLength={100}
          />
        </div>
        <div>
          <Label htmlFor="daily-segment">Segmento</Label>
          <select
            id="daily-segment"
            className="h-10 w-full rounded-md border border-edge bg-card px-3"
            value={value.segment}
            onChange={(e) => setDraft({ ...draft, segment: e.target.value })}
          >
            {SEGMENTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="daily-quantity">Limite diário de novos leads</Label>
          <select
            id="daily-quantity"
            className="h-10 w-full rounded-md border border-edge bg-card px-3"
            value={value.quantity}
            onChange={(e) => setDraft({ ...draft, quantity: Number(e.target.value) })}
          >
            <option value={10}>Até 10</option>
            <option value={20}>Até 20</option>
          </select>
        </div>
      </div>
      <div className="my-4 flex items-center gap-3">
        <Switch
          id="daily-enabled"
          checked={value.enabled}
          onCheckedChange={(enabled) => setDraft({ ...draft, enabled })}
        />
        <Label htmlFor="daily-enabled">Buscar automaticamente todos os dias</Label>
      </div>
      <Button disabled={!query.isSuccess || save.isPending} onClick={() => save.mutate()}>
        Salvar busca diária
      </Button>
      <div className="mt-4 text-sm" aria-live="polite">
        {query.data?.runs.length === 0 && <p>Nenhuma execução registrada ainda.</p>}
        {query.data?.runs.map((run) => (
          <p key={run.id} className="mt-2">
            {new Date(run.started_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}:{" "}
            {run.status === "completed"
              ? `${run.inserted_count} novos leads salvos`
              : run.status === "failed"
                ? `Falha: ${run.error}`
                : "Busca em andamento"}
          </p>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Dados:{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          OpenStreetMap contributors
        </a>
        . Telefones e sites aparecem apenas quando informados na fonte. Os resultados ficam na sua
        lista de leads.
      </p>
    </PanelCard>
  );
}
