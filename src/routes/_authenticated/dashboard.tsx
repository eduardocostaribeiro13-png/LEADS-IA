import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Crosshair,
  FileText,
  Handshake,
  Radar,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/KpiCard";
import { PanelCard } from "@/components/PanelCard";
import { ScoreDial } from "@/components/ScoreDial";
import { TierBadge } from "@/components/TierBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatRange, orNotAvailable } from "@/lib/format";
import { FUNNEL_STAGES } from "@/lib/score";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Command Center | Lead Hunter AI" },
      {
        name: "description",
        content:
          "Visão geral da prospecção: leads encontrados, qualificados, propostas, clientes, receita e fila de ataque.",
      },
      { property: "og:title", content: "Command Center | Lead Hunter AI" },
      {
        property: "og:description",
        content: "Acompanhe funil, receita e os melhores leads do dia em um só painel.",
      },
    ],
  }),
  component: Dashboard,
});

function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [leads, proposals, transactions, settings] = await Promise.all([
        supabase
          .from("leads")
          .select(
            "id, company_name, category, city, state, lead_score, status, main_problem, recommended_offer, potential_value_min, potential_value_max, is_demo",
          )
          .order("lead_score", { ascending: false }),
        supabase.from("proposals").select("id, status, price"),
        supabase.from("financial_transactions").select("amount, kind, occurred_on"),
        supabase.from("settings").select("*").maybeSingle(),
      ]);

      if (leads.error) throw new Error(leads.error.message);

      return {
        leads: leads.data ?? [],
        proposals: proposals.data ?? [],
        transactions: transactions.data ?? [],
        settings: settings.data,
      };
    },
  });
}

function Dashboard() {
  const { data, isLoading } = useDashboardData();

  const leads = data?.leads ?? [];
  const settings = data?.settings;

  const counts = {
    total: leads.length,
    analisados: leads.filter((lead) => lead.status !== "novo").length,
    qualificados: leads.filter((lead) =>
      ["qualificado", "contatado", "respondeu", "interessado", "proposta", "negociacao", "fechado"].includes(
        lead.status,
      ),
    ).length,
    contatados: leads.filter((lead) =>
      ["contatado", "respondeu", "interessado", "proposta", "negociacao", "fechado"].includes(lead.status),
    ).length,
    fechados: leads.filter((lead) => lead.status === "fechado").length,
  };

  const propostasEnviadas = (data?.proposals ?? []).filter((proposal) =>
    ["enviada", "visualizada", "aceita"].includes(proposal.status),
  ).length;

  const receitaFechada = (data?.transactions ?? [])
    .filter((entry) => entry.kind === "fechada")
    .reduce((sum, entry) => sum + Number(entry.amount), 0);

  const receitaPotencial = leads
    .filter((lead) => !["fechado", "perdido"].includes(lead.status))
    .reduce((sum, lead) => sum + Number(lead.potential_value_max ?? 0), 0);

  const attackQueue = leads.filter((lead) => lead.lead_score >= 75).slice(0, 6);

  const maltaGoalEur = Number(settings?.malta_goal_eur ?? 0);
  const eurBrl = Number(settings?.eur_brl ?? 6);
  const maltaGoalBrl = maltaGoalEur * eurBrl;
  const maltaProgress = maltaGoalBrl > 0 ? Math.min(100, (receitaFechada / maltaGoalBrl) * 100) : 0;
  const avgTicket = Number(settings?.avg_ticket ?? 0);

  return (
    <AppShell
      title="Command Center"
      description="Tudo o que importa para transformar empresas em clientes hoje."
      actions={
        <Button asChild className="gap-2">
          <Link to="/hunter">
            <Radar className="size-4" aria-hidden="true" />
            Caçar leads
          </Link>
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Leads" value={counts.total} icon={Users} loading={isLoading} />
        <KpiCard
          label="Qualificados"
          value={counts.qualificados}
          hint={`${counts.contatados} contatados`}
          icon={Crosshair}
          loading={isLoading}
        />
        <KpiCard label="Propostas" value={propostasEnviadas} icon={FileText} loading={isLoading} />
        <KpiCard label="Clientes" value={counts.fechados} icon={Handshake} loading={isLoading} />
        <KpiCard
          label="Receita fechada"
          value={formatBRL(receitaFechada)}
          hint={`Potencial ${formatBRL(receitaPotencial)}`}
          icon={Wallet}
          loading={isLoading}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <PanelCard
          title="Attack Queue"
          subtitle="Somente empresas com alta probabilidade de comprar (score 75+)."
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/attack">Ver fila completa</Link>
            </Button>
          }
          bodyClassName="p-0"
        >
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-16 animate-pulse rounded-xl bg-soft" />
              ))}
            </div>
          ) : attackQueue.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Crosshair}
                title="Nenhuma empresa na fila de ataque ainda"
                description="Cace leads e rode a análise: as empresas com score 75 ou mais aparecem aqui, prontas para abordagem."
                action={
                  <Button asChild>
                    <Link to="/hunter">Caçar meus primeiros leads</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-edge">
              {attackQueue.map((lead) => (
                <li key={lead.id}>
                  <Link
                    to="/leads/$id"
                    params={{ id: lead.id }}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-soft/50"
                  >
                    <ScoreDial score={lead.lead_score} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {lead.company_name}
                        </span>
                        <TierBadge score={lead.lead_score} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {orNotAvailable(lead.category)} ·{" "}
                        {orNotAvailable([lead.city, lead.state].filter(Boolean).join("/"))}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        Problema: {orNotAvailable(lead.main_problem)}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-xs text-muted-foreground">
                        {orNotAvailable(lead.recommended_offer)}
                      </p>
                      <p className="mt-1 font-mono text-sm text-foreground">
                        {formatRange(lead.potential_value_min, lead.potential_value_max)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <div className="space-y-6">
          <PanelCard title="Pipeline" subtitle="Etapa por etapa, do encontro ao fechamento.">
            <ul className="space-y-3">
              {FUNNEL_STAGES.map((stage) => {
                const count = leads.filter((lead) => lead.status === stage.key).length;
                const width = counts.total > 0 ? (count / counts.total) * 100 : 0;
                return (
                  <li key={stage.key}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{stage.label}</span>
                      <span className="font-mono text-foreground">{count}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-soft">
                      <div
                        className="h-full rounded-full bg-ice transition-[width] duration-700"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </PanelCard>

          <PanelCard
            title="Malta Fund"
            subtitle={`Meta de € ${maltaGoalEur.toLocaleString("pt-BR")} · câmbio ${eurBrl.toFixed(2)}`}
          >
            <p className="font-mono text-2xl font-semibold">{formatBRL(receitaFechada)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              de {formatBRL(maltaGoalBrl)} · faltam {formatBRL(Math.max(0, maltaGoalBrl - receitaFechada))}
            </p>
            <Progress value={maltaProgress} className="mt-4 h-2" />
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>{maltaProgress.toFixed(1)}% da meta</span>
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="size-3.5" aria-hidden="true" />
                {avgTicket > 0
                  ? `${Math.ceil(Math.max(0, maltaGoalBrl - receitaFechada) / avgTicket)} clientes restantes`
                  : "Defina o ticket médio"}
              </span>
            </div>
            <Button asChild variant="outline" size="sm" className="mt-4 w-full border-edge">
              <Link to="/finance">Abrir financeiro</Link>
            </Button>
          </PanelCard>
        </div>
      </div>
    </AppShell>
  );
}
