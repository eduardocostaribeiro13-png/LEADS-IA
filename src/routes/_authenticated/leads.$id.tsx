import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PanelCard } from "@/components/PanelCard";
import { ScoreDial } from "@/components/ScoreDial";
import { Tag, TierBadge } from "@/components/TierBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  analyzeLead,
  findDesignReferences,
  generateOffer,
  generateOutreach,
  generateWebsitePrompt,
} from "@/lib/ai.functions";
import { formatDate, formatRange, orNotAvailable } from "@/lib/format";
import { PIPELINE_STAGES, SCORE_WEIGHTS } from "@/lib/score";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leads/$id")({
  head: () => ({
    meta: [
      { title: "Empresa | Lead Hunter AI" },
      {
        name: "description",
        content:
          "Auditoria digital, problemas detectados, oferta recomendada, prompt do site e mensagem de abordagem da empresa.",
      },
      { property: "og:title", content: "Empresa | Lead Hunter AI" },
      {
        property: "og:description",
        content: "Tudo sobre a empresa: score, problemas, oferta e abordagem.",
      },
    ],
  }),
  component: LeadDetail,
});

const STATUS_BADGE: Record<string, string> = {
  ok: "text-tier-good",
  atencao: "text-tier-mid",
  critico: "text-destructive",
  indisponivel: "text-muted-foreground",
};

const SEVERITY_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

function LeadDetail() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const runAnalyze = useServerFn(analyzeLead);
  const runOffer = useServerFn(generateOffer);
  const runPrompt = useServerFn(generateWebsitePrompt);
  const runReferences = useServerFn(findDesignReferences);
  const runOutreach = useServerFn(generateOutreach);

  const [channel, setChannel] = useState<"whatsapp" | "instagram" | "email" | "linkedin">(
    "whatsapp",
  );
  const [step, setStep] = useState<"primeiro" | "segundo" | "terceiro" | "final">("primeiro");

  const { data, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const [lead, audits, opportunities, references, messages] = await Promise.all([
        supabase.from("leads").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("lead_audits")
          .select("*")
          .eq("lead_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("lead_opportunities")
          .select("*")
          .eq("lead_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("design_references").select("*").eq("lead_id", id),
        supabase
          .from("outreach_messages")
          .select("*")
          .eq("lead_id", id)
          .order("created_at", { ascending: false }),
      ]);
      if (lead.error) throw new Error(lead.error.message);
      return {
        lead: lead.data,
        audit: audits.data?.[0] ?? null,
        opportunity: opportunities.data?.[0] ?? null,
        references: references.data ?? [],
        messages: messages.data ?? [],
      };
    },
  });

  function invalidate() {
    return queryClient.invalidateQueries();
  }

  function aiMutation<T>(fn: (input: { data: { leadId: string } }) => Promise<T>, success: string) {
    return {
      mutationFn: () => fn({ data: { leadId: id } }),
      onSuccess: async () => {
        await invalidate();
        toast.success(success);
      },
      onError: (error: unknown) =>
        toast.error(error instanceof Error ? error.message : "A IA não conseguiu concluir agora."),
    };
  }

  const analyze = useMutation(aiMutation(runAnalyze, "Auditoria concluída."));
  const offer = useMutation(aiMutation(runOffer, "Oferta gerada."));
  const prompt = useMutation(aiMutation(runPrompt, "Prompt do site gerado."));
  const references = useMutation(aiMutation(runReferences, "Referências de design sugeridas."));

  const outreach = useMutation({
    mutationFn: () => runOutreach({ data: { leadId: id, channel, step } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Mensagem gerada. Revise antes de enviar.");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar a mensagem."),
  });

  const changeStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Status atualizado.");
    },
  });

  if (isLoading) {
    return (
      <AppShell title="Carregando empresa…">
        <div className="space-y-4">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-32 animate-pulse rounded-2xl bg-soft" />
          ))}
        </div>
      </AppShell>
    );
  }

  const lead = data?.lead;
  if (!lead) {
    return (
      <AppShell title="Empresa não encontrada">
        <EmptyState title="Essa empresa não existe ou foi removida." />
      </AppShell>
    );
  }

  const audit = data?.audit;
  const opportunity = data?.opportunity;
  const breakdown = [
    { key: "investment", value: lead.investment_score },
    { key: "websiteNeed", value: lead.website_need_score },
    { key: "digitalPresence", value: lead.digital_presence_score },
    { key: "salesPotential", value: lead.sales_potential_score },
    { key: "problems", value: lead.problem_score },
  ];

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência.");
  }

  function renderFindings(findings: unknown, emptyLabel: string) {
    const list = Array.isArray(findings)
      ? (findings as Array<{ item: string; status: string; note: string }>)
      : [];
    if (list.length === 0) return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
    return (
      <ul className="space-y-2.5">
        {list.map((entry, index) => (
          <li key={`${entry.item}-${index}`} className="text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-foreground">{entry.item}</span>
              <span className={cn("label-mono", STATUS_BADGE[entry.status] ?? "")}>
                {entry.status === "indisponivel" ? "sem dado" : entry.status}
              </span>
            </div>
            <p className="mt-0.5 text-muted-foreground">{entry.note}</p>
          </li>
        ))}
      </ul>
    );
  }

  const problems = Array.isArray(audit?.problems)
    ? (audit?.problems as Array<{
        problem: string;
        severity: string;
        business_impact: string;
        solution: string;
      }>)
    : [];

  return (
    <AppShell
      title={lead.company_name}
      description={`${orNotAvailable(lead.category)} · ${orNotAvailable(
        [lead.city, lead.state].filter(Boolean).join("/"),
      )}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {lead.is_demo && <Badge className="bg-tier-mid/15 text-tier-mid">DEMO</Badge>}
          <Select value={lead.status} onValueChange={(value) => changeStatus.mutate(value)}>
            <SelectTrigger
              aria-label="Selecionar status do lead"
              className="w-44 border-edge bg-card"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map((stage) => (
                <SelectItem key={stage.key} value={stage.key}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="gap-2" onClick={() => analyze.mutate()} disabled={analyze.isPending}>
            {analyze.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            ANALISAR
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <Tabs defaultValue="overview">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1 border border-edge bg-card p-1">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
            <TabsTrigger value="offer">Oferta</TabsTrigger>
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="prompt">Prompt</TabsTrigger>
            <TabsTrigger value="outreach">Abordagem</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-5 space-y-6">
            <PanelCard title="Dados da empresa">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(
                  [
                    ["Segmento", lead.category],
                    ["Descrição", lead.description],
                    ["Endereço", lead.address],
                    ["Cidade", [lead.city, lead.state].filter(Boolean).join("/")],
                    ["Telefone", lead.phone],
                    ["WhatsApp", lead.whatsapp],
                    ["E-mail", lead.email],
                    ["Website", lead.website],
                    ["Instagram", lead.instagram],
                    ["Avaliação Google", lead.rating],
                    ["Nº de avaliações", lead.review_count],
                    ["Seguidores", lead.followers],
                    ["Origem", lead.source],
                    ["Cadastrado em", formatDate(lead.created_at)],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="label-mono text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words text-sm text-foreground">
                      {orNotAvailable(value == null ? null : String(value))}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {(lead.tags ?? []).map((tag) => (
                  <Tag key={tag} label={tag} />
                ))}
              </div>
            </PanelCard>
          </TabsContent>

          <TabsContent value="audit" className="mt-5 space-y-6">
            {!audit ? (
              <EmptyState
                title="Nenhuma auditoria ainda"
                description="Rode a análise para auditar site, Google e Instagram com base apenas nos dados reais da empresa."
                action={
                  <Button onClick={() => analyze.mutate()} disabled={analyze.isPending}>
                    {analyze.isPending ? "Analisando…" : "ANALISAR AGORA"}
                  </Button>
                }
              />
            ) : (
              <>
                <PanelCard title="Resumo da auditoria" subtitle={formatDate(audit.created_at)}>
                  <p className="text-sm leading-relaxed text-muted-foreground">{audit.summary}</p>
                </PanelCard>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <PanelCard title="Website">
                    {renderFindings(audit.website_findings, "Sem dados de website.")}
                  </PanelCard>
                  <PanelCard title="Google">
                    {renderFindings(audit.google_findings, "Sem dados do Google.")}
                  </PanelCard>
                  <PanelCard title="Instagram">
                    {renderFindings(audit.social_findings, "Sem dados sociais.")}
                  </PanelCard>
                </div>
                <PanelCard title="O que está fazendo essa empresa perder oportunidades?">
                  {problems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum problema registrado.</p>
                  ) : (
                    <ul className="space-y-4">
                      {problems.map((entry, index) => (
                        <li
                          key={`${entry.problem}-${index}`}
                          className="rounded-xl border border-edge bg-card p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium">{entry.problem}</span>
                            <span
                              className={cn(
                                "label-mono",
                                entry.severity === "critica" || entry.severity === "alta"
                                  ? "text-destructive"
                                  : "text-tier-mid",
                              )}
                            >
                              gravidade {SEVERITY_LABEL[entry.severity] ?? entry.severity}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            <span className="text-foreground">Impacto comercial: </span>
                            {entry.business_impact}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            <span className="text-foreground">Solução recomendada: </span>
                            {entry.solution}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </PanelCard>
              </>
            )}
          </TabsContent>

          <TabsContent value="offer" className="mt-5 space-y-6" id="oferta">
            <PanelCard
              title="Oportunidade detectada"
              subtitle="O que vender, por quê e por qual faixa de preço."
              action={
                <Button size="sm" onClick={() => offer.mutate()} disabled={offer.isPending}>
                  {offer.isPending ? "Gerando…" : "GERAR OFERTA"}
                </Button>
              }
            >
              {!opportunity?.service_name ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma oferta gerada. A IA usa o seu catálogo de serviços e a auditoria para
                  recomendar o serviço que resolve o problema real da empresa.
                </p>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="label-mono text-muted-foreground">Serviço recomendado</p>
                    <p className="mt-1 text-lg font-semibold">{opportunity.service_name}</p>
                    <p className="mt-1 font-mono text-sm text-ice">
                      {formatRange(opportunity.price_min, opportunity.price_max)}
                    </p>
                  </div>
                  {opportunity.rationale && (
                    <div>
                      <p className="label-mono text-muted-foreground">Por que este serviço</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {opportunity.rationale}
                      </p>
                    </div>
                  )}
                  {Array.isArray(opportunity.benefits) && opportunity.benefits.length > 0 && (
                    <div>
                      <p className="label-mono text-muted-foreground">Benefícios</p>
                      <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                        {(opportunity.benefits as string[]).map((benefit) => (
                          <li key={benefit} className="flex gap-2">
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ice" />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(opportunity.structure) && opportunity.structure.length > 0 && (
                    <div>
                      <p className="label-mono text-muted-foreground">Estrutura da entrega</p>
                      <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                        {(opportunity.structure as string[]).map((item) => (
                          <li key={item}>· {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {opportunity.sales_argument && (
                    <div>
                      <p className="label-mono text-muted-foreground">Argumento comercial</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {opportunity.sales_argument}
                      </p>
                    </div>
                  )}
                  {opportunity.cta && (
                    <div className="rounded-xl border border-edge bg-card p-4">
                      <p className="label-mono text-muted-foreground">CTA sugerido</p>
                      <p className="mt-1 text-sm">{opportunity.cta}</p>
                    </div>
                  )}
                </div>
              )}
            </PanelCard>
          </TabsContent>

          <TabsContent value="design" className="mt-5">
            <PanelCard
              title="Referências de design"
              subtitle="Inspiração de estrutura, UX e hierarquia — nunca cópia."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  className="border-edge"
                  onClick={() => references.mutate()}
                  disabled={references.isPending}
                >
                  {references.isPending ? "Buscando…" : "Sugerir 3 referências"}
                </Button>
              }
            >
              {(data?.references ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma referência escolhida ainda.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(data?.references ?? []).map((reference) => (
                    <li key={reference.id} className="rounded-xl border border-edge bg-card p-4">
                      <p className="text-sm font-medium">{reference.name}</p>
                      {reference.url && (
                        <a
                          href={reference.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-ice hover:underline"
                        >
                          Abrir referência
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      )}
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {reference.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </PanelCard>
          </TabsContent>

          <TabsContent value="prompt" className="mt-5">
            <PanelCard
              title="Prompt do site"
              subtitle="Prompt detalhado, pronto para criar a demonstração."
              action={
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => prompt.mutate()} disabled={prompt.isPending}>
                    {prompt.isPending ? "Gerando…" : "GERAR PROMPT"}
                  </Button>
                  {opportunity?.website_prompt && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 border-edge"
                        onClick={() => copy(opportunity.website_prompt as string)}
                      >
                        <Copy className="size-3.5" aria-hidden="true" />
                        Copiar
                      </Button>
                    </>
                  )}
                </div>
              }
            >
              {!opportunity?.website_prompt ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum prompt gerado. O prompt usa os dados reais da empresa, a auditoria, a
                  oferta e as referências escolhidas.
                </p>
              ) : (
                <Textarea
                  readOnly
                  value={opportunity.website_prompt as string}
                  className="min-h-[420px] border-edge bg-card font-mono text-xs leading-relaxed"
                />
              )}
            </PanelCard>
          </TabsContent>

          <TabsContent value="outreach" className="mt-5 space-y-6" id="abordagem">
            <PanelCard
              title="Gerar mensagem"
              subtitle="Nada é enviado automaticamente: você revisa, copia e envia."
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Select
                  value={channel}
                  onValueChange={(value) => setChannel(value as typeof channel)}
                >
                  <SelectTrigger
                    aria-label="Selecionar canal de abordagem"
                    className="border-edge bg-card"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="instagram">Instagram DM</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={step} onValueChange={(value) => setStep(value as typeof step)}>
                  <SelectTrigger
                    aria-label="Selecionar etapa da abordagem"
                    className="border-edge bg-card"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primeiro">Primeira abordagem</SelectItem>
                    <SelectItem value="segundo">Segundo contato</SelectItem>
                    <SelectItem value="terceiro">Terceiro contato</SelectItem>
                    <SelectItem value="final">Follow-up final</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => outreach.mutate()} disabled={outreach.isPending}>
                  {outreach.isPending ? "Escrevendo…" : "GERAR MENSAGEM"}
                </Button>
              </div>
            </PanelCard>

            {(data?.messages ?? []).length === 0 ? (
              <EmptyState
                title="Nenhuma mensagem gerada"
                description="A primeira abordagem é curta, humana e mostra que você analisou a empresa antes de vender."
              />
            ) : (
              <ul className="space-y-3">
                {(data?.messages ?? []).map((message) => (
                  <li key={message.id} className="rounded-2xl border border-edge bg-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="label-mono text-muted-foreground">
                        {message.channel} · {message.step} · {formatDate(message.created_at)}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5"
                        onClick={() => copy(message.content)}
                      >
                        <Copy className="size-3.5" aria-hidden="true" />
                        Copiar
                      </Button>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {message.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        <div className="space-y-6">
          <PanelCard title="Lead Score">
            <div className="flex items-center gap-4">
              <ScoreDial score={lead.lead_score} size="lg" />
              <div>
                <TierBadge score={lead.lead_score} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Somente sinais confirmados pontuam. Dados ausentes não geram pontos.
                </p>
              </div>
            </div>
            <ul className="mt-5 space-y-3">
              {SCORE_WEIGHTS.map((weight, index) => {
                const value = breakdown[index]?.value ?? 0;
                return (
                  <li key={weight.key}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{weight.label}</span>
                      <span className="font-mono text-foreground">
                        {value}/{weight.max}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-soft">
                      <div
                        className="h-full rounded-full bg-ice transition-[width] duration-700"
                        style={{ width: `${(value / weight.max) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </PanelCard>

          <PanelCard title="Próximos passos">
            <ol className="space-y-2.5 text-xs text-muted-foreground">
              {[
                "Rodar a auditoria (ANALISAR)",
                "Gerar a oferta com base no problema real",
                "Buscar referências de design",
                "Gerar o prompt do site",
                "Gerar a mensagem de abordagem",
                "Mover no pipeline e marcar follow-up",
              ].map((entry, index) => (
                <li key={entry} className="flex gap-2">
                  <span className="label-mono text-ice">{index + 1}</span>
                  {entry}
                </li>
              ))}
            </ol>
          </PanelCard>
        </div>
      </div>
    </AppShell>
  );
}
