import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/KpiCard";
import { PanelCard } from "@/components/PanelCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatPercent } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Financeiro | Lead Hunter AI" },
      {
        name: "description",
        content:
          "Receita fechada e prevista, propostas abertas, ticket médio, taxa de conversão e a meta Malta Fund em euros e reais.",
      },
      { property: "og:title", content: "Financeiro | Lead Hunter AI" },
      {
        property: "og:description",
        content: "Quanto você já fechou, quanto está em jogo e quantos clientes faltam.",
      },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["finance"],
    queryFn: async () => {
      const [transactions, proposals, leads, settings] = await Promise.all([
        supabase.from("financial_transactions").select("*").order("occurred_on"),
        supabase.from("proposals").select("status, price"),
        supabase.from("leads").select("status, potential_value_max"),
        supabase.from("settings").select("*").maybeSingle(),
      ]);
      if (transactions.error) throw new Error(transactions.error.message);
      return {
        transactions: transactions.data ?? [],
        proposals: proposals.data ?? [],
        leads: leads.data ?? [],
        settings: settings.data,
      };
    },
  });

  const settings = data?.settings;
  const [goalEur, setGoalEur] = useState<string>("");
  const [rate, setRate] = useState<string>("");
  const [goalInput, setGoalInput] = useState("");
  const [ticketInput, setTicketInput] = useState("");
  const [rateInput, setRateInput] = useState("");

  const saveSettings = useMutation({
    mutationFn: async () => {
      const payload: { malta_goal_eur?: number; eur_brl?: number } = {};
      if (goalEur) payload.malta_goal_eur = Number(goalEur);
      if (rate) payload.eur_brl = Number(rate);
      if (Object.keys(payload).length === 0) return;
      const { error } = await supabase
        .from("settings")
        .update(payload)
        .eq("id", settings?.id ?? "");
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Meta atualizada.");
    },
    onError: () => toast.error("Não foi possível salvar a meta."),
  });

  const closed = (data?.transactions ?? [])
    .filter((entry) => entry.kind === "fechada")
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const forecast = (data?.transactions ?? [])
    .filter((entry) => entry.kind === "prevista")
    .reduce((sum, entry) => sum + Number(entry.amount), 0);

  const openProposals = (data?.proposals ?? []).filter((proposal) =>
    ["enviada", "visualizada"].includes(proposal.status),
  );
  const openProposalsValue = openProposals.reduce((sum, entry) => sum + Number(entry.price), 0);

  const leads = data?.leads ?? [];
  const negotiating = leads
    .filter((lead) => ["proposta", "negociacao", "interessado"].includes(lead.status))
    .reduce((sum, lead) => sum + Number(lead.potential_value_max ?? 0), 0);
  const lost = leads
    .filter((lead) => lead.status === "perdido")
    .reduce((sum, lead) => sum + Number(lead.potential_value_max ?? 0), 0);
  const clients = leads.filter((lead) => lead.status === "fechado").length;
  const conversion = leads.length > 0 ? (clients / leads.length) * 100 : 0;
  const avgTicket = clients > 0 ? closed / clients : Number(settings?.avg_ticket ?? 0);

  const monthly = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const entry of data?.transactions ?? []) {
      if (entry.kind !== "fechada") continue;
      const month = String(entry.occurred_on).slice(0, 7);
      buckets.set(month, (buckets.get(month) ?? 0) + Number(entry.amount));
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({ month, value }));
  }, [data?.transactions]);

  const goal = Number(goalEur || settings?.malta_goal_eur || 0);
  const eurBrl = Number(rate || settings?.eur_brl || 6);
  const goalBrl = goal * eurBrl;
  const progress = goalBrl > 0 ? Math.min(100, (closed / goalBrl) * 100) : 0;

  const calcGoal = Number(goalInput) || 0;
  const calcTicket = Number(ticketInput) || avgTicket || 0;
  const calcRate = Number(rateInput) || (conversion > 0 ? conversion : 10);
  const neededClients = calcTicket > 0 ? Math.ceil(calcGoal / calcTicket) : 0;
  const neededProposals = calcRate > 0 ? Math.ceil(neededClients / (calcRate / 100)) : 0;

  return (
    <AppShell title="Financeiro" description="Receita, previsões e a meta que importa.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Receita fechada" value={formatBRL(closed)} loading={isLoading} />
        <KpiCard label="Receita prevista" value={formatBRL(forecast)} loading={isLoading} />
        <KpiCard
          label="Propostas abertas"
          value={formatBRL(openProposalsValue)}
          hint={`${openProposals.length} proposta(s)`}
          loading={isLoading}
        />
        <KpiCard label="Em negociação" value={formatBRL(negotiating)} loading={isLoading} />
        <KpiCard label="Ticket médio" value={formatBRL(avgTicket)} loading={isLoading} />
        <KpiCard label="Taxa de conversão" value={formatPercent(conversion)} loading={isLoading} />
        <KpiCard label="Clientes" value={clients} loading={isLoading} />
        <KpiCard label="Valor perdido" value={formatBRL(lost)} loading={isLoading} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <PanelCard title="Receita por mês" subtitle="Somente receita efetivamente fechada.">
          {monthly.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma receita registrada ainda. Ao fechar um cliente, registre a receita para
              acompanhar a evolução mensal.
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid stroke="var(--edge)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--edge)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => formatBRL(value)}
                  />
                  <Bar dataKey="value" fill="var(--ice)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </PanelCard>

        <div className="space-y-6">
          <PanelCard title="Malta Fund" subtitle="Meta em euros, convertida automaticamente.">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="goal" className="text-xs">
                  Meta (€)
                </Label>
                <Input
                  id="goal"
                  value={goalEur || String(settings?.malta_goal_eur ?? "")}
                  onChange={(event) => setGoalEur(event.target.value)}
                  className="h-9 border-edge bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rate" className="text-xs">
                  Câmbio EUR/BRL
                </Label>
                <Input
                  id="rate"
                  value={rate || String(settings?.eur_brl ?? "")}
                  onChange={(event) => setRate(event.target.value)}
                  className="h-9 border-edge bg-card"
                />
              </div>
            </div>
            <Button
              size="sm"
              className="mt-3 w-full"
              onClick={() => saveSettings.mutate()}
              disabled={saveSettings.isPending}
            >
              Salvar meta
            </Button>
            <div className="mt-5">
              <p className="font-mono text-2xl font-semibold">{formatBRL(closed)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                de {formatBRL(goalBrl)} · faltam {formatBRL(Math.max(0, goalBrl - closed))}
              </p>
              <Progress value={progress} className="mt-3 h-2" />
              <p className="mt-2 text-xs text-muted-foreground">
                {progress.toFixed(1)}% da meta ·{" "}
                {avgTicket > 0
                  ? `${Math.ceil(Math.max(0, goalBrl - closed) / avgTicket)} clientes necessários`
                  : "Defina o ticket médio nas configurações"}
              </p>
            </div>
          </PanelCard>

          <PanelCard title="Quantos clientes eu preciso?" subtitle="Simule meta, ticket e conversão.">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="calcGoal" className="text-xs">
                  Meta financeira (R$)
                </Label>
                <Input
                  id="calcGoal"
                  value={goalInput}
                  onChange={(event) => setGoalInput(event.target.value)}
                  placeholder="60000"
                  className="h-9 border-edge bg-card"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="calcTicket" className="text-xs">
                    Ticket médio (R$)
                  </Label>
                  <Input
                    id="calcTicket"
                    value={ticketInput}
                    onChange={(event) => setTicketInput(event.target.value)}
                    placeholder={String(Math.round(avgTicket) || 3000)}
                    className="h-9 border-edge bg-card"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="calcRate" className="text-xs">
                    Conversão (%)
                  </Label>
                  <Input
                    id="calcRate"
                    value={rateInput}
                    onChange={(event) => setRateInput(event.target.value)}
                    placeholder="10"
                    className="h-9 border-edge bg-card"
                  />
                </div>
              </div>
            </div>
            <ul className="mt-5 space-y-2 text-xs">
              {[
                ["Clientes necessários", neededClients],
                ["Propostas necessárias", neededProposals],
                ["Reuniões necessárias", neededProposals * 2],
                ["Contatos necessários", neededProposals * 6],
                ["Leads necessários", neededProposals * 12],
              ].map(([label, value]) => (
                <li
                  key={String(label)}
                  className="flex items-center justify-between rounded-lg border border-edge bg-card px-3 py-2"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono text-foreground">{value}</span>
                </li>
              ))}
            </ul>
          </PanelCard>
        </div>
      </div>
    </AppShell>
  );
}
