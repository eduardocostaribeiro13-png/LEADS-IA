import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { useMemo } from "react";

import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PanelCard } from "@/components/PanelCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatPercent } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/intelligence")({
  head: () => ({
    meta: [
      { title: "Inteligência | Lead Hunter AI" },
      {
        name: "description",
        content:
          "Quais segmentos, cidades e abordagens realmente fecham — e por quais motivos as oportunidades são perdidas.",
      },
      { property: "og:title", content: "Inteligência | Lead Hunter AI" },
      {
        property: "og:description",
        content: "Aprenda com o próprio histórico para prospectar melhor.",
      },
    ],
  }),
  component: IntelligencePage,
});

interface GroupStat {
  key: string;
  total: number;
  closed: number;
  revenue: number;
}

function group(
  leads: Array<{ status: string; potential_value_max: number | null }>,
  keyOf: (lead: never) => string | null,
): GroupStat[] {
  const map = new Map<string, GroupStat>();
  for (const lead of leads) {
    const key = keyOf(lead as never) || "Dado não disponível";
    const current = map.get(key) ?? { key, total: 0, closed: 0, revenue: 0 };
    current.total += 1;
    if (lead.status === "fechado") {
      current.closed += 1;
      current.revenue += Number(lead.potential_value_max ?? 0);
    }
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.closed - a.closed || b.total - a.total).slice(0, 6);
}

function StatList({ stats, emptyLabel }: { stats: GroupStat[]; emptyLabel: string }) {
  if (stats.length === 0) return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  return (
    <ul className="space-y-2">
      {stats.map((stat) => (
        <li
          key={stat.key}
          className="flex items-center justify-between rounded-lg border border-edge bg-card px-3 py-2 text-xs"
        >
          <span className="truncate text-foreground">{stat.key}</span>
          <span className="shrink-0 font-mono text-muted-foreground">
            {stat.closed}/{stat.total} · {formatPercent(stat.total > 0 ? (stat.closed / stat.total) * 100 : 0)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function IntelligencePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["intelligence"],
    queryFn: async () => {
      const [leads, feedback] = await Promise.all([
        supabase
          .from("leads")
          .select("category, city, state, status, potential_value_max, recommended_offer, lead_score"),
        supabase.from("lead_score_feedback").select("*").order("created_at", { ascending: false }),
      ]);
      if (leads.error) throw new Error(leads.error.message);
      return { leads: leads.data ?? [], feedback: feedback.data ?? [] };
    },
  });

  const leads = data?.leads ?? [];

  const bySegment = useMemo(
    () => group(leads, (lead: never) => (lead as { category: string | null }).category),
    [leads],
  );
  const byCity = useMemo(
    () =>
      group(leads, (lead: never) => {
        const entry = lead as { city: string | null; state: string | null };
        return [entry.city, entry.state].filter(Boolean).join("/") || null;
      }),
    [leads],
  );
  const byOffer = useMemo(
    () =>
      group(leads, (lead: never) => (lead as { recommended_offer: string | null }).recommended_offer),
    [leads],
  );

  const closedLeads = leads.filter((lead) => lead.status === "fechado");
  const bestTicket = closedLeads.reduce(
    (max, lead) => Math.max(max, Number(lead.potential_value_max ?? 0)),
    0,
  );

  const reasons = (data?.feedback ?? []).filter((entry) => entry.reason);

  if (!isLoading && leads.length === 0) {
    return (
      <AppShell title="Inteligência" description="O que funciona na sua prospecção.">
        <EmptyState
          icon={BarChart3}
          title="Ainda não há histórico para analisar"
          description="Conforme você caça, aborda e fecha empresas, esta página mostra os melhores segmentos, cidades, ofertas e motivos de perda."
          action={
            <Button asChild>
              <Link to="/hunter">Começar a caçar</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Inteligência"
      description="Aprenda com os próprios resultados: onde você fecha mais e por quê."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PanelCard title="Melhores segmentos" subtitle="Fechados sobre o total de empresas.">
          <StatList stats={bySegment} emptyLabel="Sem dados suficientes." />
        </PanelCard>
        <PanelCard title="Melhores cidades">
          <StatList stats={byCity} emptyLabel="Sem dados suficientes." />
        </PanelCard>
        <PanelCard title="Ofertas que mais fecham">
          <StatList stats={byOffer} emptyLabel="Nenhuma oferta gerada ainda." />
        </PanelCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PanelCard title="Melhor ticket fechado">
          <p className="font-mono text-2xl font-semibold">{formatBRL(bestTicket)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {closedLeads.length} cliente(s) fechado(s) até agora.
          </p>
        </PanelCard>
        <PanelCard
          title="Motivos de ganho e perda"
          subtitle="Alimentado pelo seu feedback em cada empresa."
        >
          {reasons.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum motivo registrado ainda. Ao fechar ou perder uma empresa, registre o motivo para
              melhorar a pontuação das próximas.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {reasons.slice(0, 8).map((entry) => (
                <li key={entry.id} className="rounded-lg border border-edge bg-card px-3 py-2">
                  <span className={entry.converted ? "text-tier-good" : "text-destructive"}>
                    {entry.converted ? "Fechado" : "Perdido"}
                  </span>
                  <span className="ml-2 text-muted-foreground">{entry.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>
    </AppShell>
  );
}
