import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PanelCard } from "@/components/PanelCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDate, orNotAvailable } from "@/lib/format";

const PROPOSAL_STATUS = [
  { key: "rascunho", label: "Rascunho" },
  { key: "enviada", label: "Enviada" },
  { key: "visualizada", label: "Visualizada" },
  { key: "aceita", label: "Aceita" },
  { key: "recusada", label: "Recusada" },
] as const;

export const Route = createFileRoute("/_authenticated/proposals")({
  head: () => ({
    meta: [
      { title: "Propostas | Lead Hunter AI" },
      {
        name: "description",
        content:
          "Propostas comerciais com escopo, prazo, preço, condições e validade — do rascunho ao aceite.",
      },
      { property: "og:title", content: "Propostas | Lead Hunter AI" },
      {
        property: "og:description",
        content: "Acompanhe o status de cada proposta enviada e o valor em jogo.",
      },
    ],
  }),
  component: ProposalsPage,
});

function ProposalsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["proposals"],
    queryFn: async () => {
      const [proposals, leads] = await Promise.all([
        supabase
          .from("proposals")
          .select("*, leads(company_name)")
          .order("created_at", { ascending: false }),
        supabase
          .from("leads")
          .select("id, company_name, recommended_offer, potential_value_max, lead_score")
          .gte("lead_score", 60)
          .order("lead_score", { ascending: false })
          .limit(20),
      ]);
      if (proposals.error) throw new Error(proposals.error.message);
      return { proposals: proposals.data ?? [], leads: leads.data ?? [] };
    },
  });

  const create = useMutation({
    mutationFn: async (leadId: string) => {
      const lead = data?.leads.find((entry) => entry.id === leadId);
      const { data: session } = await supabase.auth.getUser();
      const userId = session.user?.id;
      if (!userId || !lead) throw new Error("Não foi possível criar a proposta.");
      const { error } = await supabase.from("proposals").insert({
        user_id: userId,
        lead_id: lead.id,
        service_name: lead.recommended_offer ?? "A definir",
        price: Number(lead.potential_value_max ?? 0),
        status: "rascunho",
        scope: "Escopo a detalhar a partir da oferta recomendada.",
        delivery_days: 15,
        client_name: lead.company_name,
        conditions: "50% na aprovação e 50% na entrega.",
        valid_until: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Proposta criada como rascunho.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao criar."),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("proposals").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Status da proposta atualizado.");
    },
  });

  const proposals = data?.proposals ?? [];

  return (
    <AppShell
      title="Propostas"
      description="Do rascunho ao aceite, com escopo, prazo, preço e validade."
      actions={
        (data?.leads.length ?? 0) > 0 && (
          <Select onValueChange={(value) => create.mutate(value)}>
            <SelectTrigger aria-label="Selecionar lead para criar proposta" className="w-64 border-edge bg-card">
              <SelectValue placeholder="CRIAR PROPOSTA para…" />
            </SelectTrigger>
            <SelectContent>
              {(data?.leads ?? []).map((lead) => (
                <SelectItem key={lead.id} value={lead.id}>
                  {lead.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((row) => (
            <div key={row} className="h-28 animate-pulse rounded-2xl bg-soft" />
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhuma proposta ainda"
          description="Qualifique empresas e gere a oferta: a proposta nasce do serviço recomendado e da faixa de preço definida por você."
          action={
            <Button asChild>
              <Link to="/attack">Ver empresas prontas</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {proposals.map((proposal) => (
            <PanelCard key={proposal.id} bodyClassName="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    to="/leads/$id"
                    params={{ id: proposal.lead_id ?? "" }}
                    className="text-base font-semibold hover:text-ice"
                  >
                    {(proposal.leads as { company_name?: string } | null)?.company_name ??
                      "Empresa removida"}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {orNotAvailable(proposal.service_name)} · criada em{" "}
                    {formatDate(proposal.created_at)}
                  </p>
                </div>
                <p className="font-mono text-lg">{formatBRL(Number(proposal.price))}</p>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="label-mono text-muted-foreground">Prazo</dt>
                  <dd className="mt-0.5">
                    {proposal.delivery_days ? `${proposal.delivery_days} dias` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="label-mono text-muted-foreground">Validade</dt>
                  <dd className="mt-0.5">{orNotAvailable(proposal.valid_until)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="label-mono text-muted-foreground">Condições</dt>
                  <dd className="mt-0.5 text-muted-foreground">
                    {orNotAvailable(proposal.conditions)}
                  </dd>
                </div>
              </dl>
              <div className="mt-4">
                <Select
                  value={proposal.status}
                  onValueChange={(value) => changeStatus.mutate({ id: proposal.id, status: value })}
                >
                  <SelectTrigger aria-label="Selecionar status da proposta" className="border-edge bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPOSAL_STATUS.map((status) => (
                      <SelectItem key={status.key} value={status.key}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </PanelCard>
          ))}
        </div>
      )}
    </AppShell>
  );
}
