import type { Json } from "@/integrations/supabase/types";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAi } from "@/lib/ai-gateway.server";

const leadInput = z.object({ leadId: z.string().uuid() });

const BASE_RULES = `Você é um agente de inteligência comercial que ajuda um profissional a vender websites,
landing pages, redesign, e-commerce e automação para pequenas e médias empresas no Brasil.
REGRAS ABSOLUTAS:
- Use SOMENTE os dados fornecidos sobre a empresa.
- NUNCA invente seguidores, avaliações, faturamento, serviços, sites ou nomes de pessoas.
- Quando um dado não existir, escreva exatamente "Dado não disponível".
- Se a empresa já tiver um bom site, recomende outra oportunidade (landing page, redesign, SEO, conversão, agendamento, integração WhatsApp) em vez de um site novo.
- Escreva em português do Brasil, direto e profissional.`;

function leadFacts(lead: Record<string, unknown>): string {
  const fields: Array<[string, unknown]> = [
    ["Empresa", lead["company_name"]],
    ["Segmento", lead["category"]],
    ["Descrição", lead["description"]],
    ["Cidade", lead["city"]],
    ["Estado", lead["state"]],
    ["Endereço", lead["address"]],
    ["Telefone", lead["phone"]],
    ["WhatsApp", lead["whatsapp"]],
    ["E-mail", lead["email"]],
    ["Website", lead["website"]],
    ["Instagram", lead["instagram"]],
    ["Google Maps", lead["google_maps_url"]],
    ["Avaliação Google", lead["rating"]],
    ["Número de avaliações", lead["review_count"]],
    ["Seguidores", lead["followers"]],
    ["Lead Score", lead["lead_score"]],
  ];
  return fields
    .map(
      ([label, value]) =>
        `${label}: ${value === null || value === undefined || value === "" ? "Dado não disponível" : String(value)}`,
    )
    .join("\n");
}

async function loadLead(supabase: SupabaseClient<Database>, leadId: string) {
  const { data, error } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lead não encontrado.");
  return data as Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* AGENTE AUDITOR — auditoria digital + problemas + oportunidade       */
/* ------------------------------------------------------------------ */

const auditSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "website_findings",
    "google_findings",
    "social_findings",
    "problems",
    "opportunity_summary",
  ],
  properties: {
    summary: { type: "string" },
    opportunity_summary: { type: "string" },
    website_findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "status", "note"],
        properties: {
          item: { type: "string" },
          status: { type: "string", enum: ["ok", "atencao", "critico", "indisponivel"] },
          note: { type: "string" },
        },
      },
    },
    google_findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "status", "note"],
        properties: {
          item: { type: "string" },
          status: { type: "string", enum: ["ok", "atencao", "critico", "indisponivel"] },
          note: { type: "string" },
        },
      },
    },
    social_findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "status", "note"],
        properties: {
          item: { type: "string" },
          status: { type: "string", enum: ["ok", "atencao", "critico", "indisponivel"] },
          note: { type: "string" },
        },
      },
    },
    problems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["problem", "severity", "business_impact", "solution"],
        properties: {
          problem: { type: "string" },
          severity: { type: "string", enum: ["baixa", "media", "alta", "critica"] },
          business_impact: { type: "string" },
          solution: { type: "string" },
        },
      },
    },
  },
} as const;

export const analyzeLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => leadInput.parse(data))
  .handler(async ({ data, context }) => {
    const lead = await loadLead(context.supabase, data.leadId);

    const result = await callAi<{
      summary: string;
      opportunity_summary: string;
      website_findings: Json[];
      google_findings: Json[];
      social_findings: Json[];
      problems: Json[];
    }>({
      system: `${BASE_RULES}\nVocê é o AGENTE AUDITOR. Faça a auditoria da presença digital com base apenas nos dados informados. Para cada verificação sem informação, use status "indisponivel" e a nota "Dado não disponível".`,
      prompt: `Dados da empresa:\n${leadFacts(lead)}\n\nAuditar: website (existência, HTTPS, CTA, WhatsApp, clareza dos serviços, mobile), Google (avaliações, quantidade, categoria, telefone, endereço) e presença social (Instagram, seguidores, link na bio). Depois liste os problemas que fazem a empresa perder oportunidades comerciais.`,
      jsonSchema: auditSchema as unknown as Record<string, unknown>,
      schemaName: "auditoria",
    });

    const { data: savedAudit, error: auditError } = await context.supabase
      .from("lead_audits")
      .insert({
        user_id: context.userId,
        lead_id: data.leadId,
        summary: result.summary,
        website_findings: result.website_findings,
        google_findings: result.google_findings,
        social_findings: result.social_findings,
        problems: result.problems,
        sources: [{ source: "dados_do_lead", connected: true }],
      })
      .select("id")
      .single();
    if (auditError) throw new Error(auditError.message);
    if (!savedAudit) throw new Error("Não foi possível salvar a auditoria.");

    const firstProblem = (result.problems?.[0] ?? null) as { problem?: string } | null;

    const { data: updatedLead, error: updateError } = await context.supabase
      .from("leads")
      .update({
        status: lead["status"] === "novo" ? "analisado" : (lead["status"] as string),
        main_problem: firstProblem?.problem ?? null,
      })
      .eq("id", data.leadId)
      .select("id")
      .single();
    if (updateError) throw new Error(updateError.message);
    if (!updatedLead) throw new Error("Não foi possível confirmar a atualização do lead.");

    return result;
  });

/* ------------------------------------------------------------------ */
/* AGENTE COMERCIAL — oferta recomendada                               */
/* ------------------------------------------------------------------ */

const offerSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "opportunity_summary",
    "service_name",
    "rationale",
    "benefits",
    "structure",
    "price_min",
    "price_max",
    "sales_argument",
    "urgency",
    "cta",
  ],
  properties: {
    opportunity_summary: { type: "string" },
    service_name: { type: "string" },
    rationale: { type: "string" },
    benefits: { type: "array", items: { type: "string" } },
    structure: { type: "array", items: { type: "string" } },
    price_min: { type: "number" },
    price_max: { type: "number" },
    sales_argument: { type: "string" },
    urgency: { type: "string" },
    cta: { type: "string" },
  },
} as const;

export const generateOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => leadInput.parse(data))
  .handler(async ({ data, context }) => {
    const lead = await loadLead(context.supabase, data.leadId);

    const [
      { data: services, error: servicesError },
      { data: settings, error: settingsError },
      { data: audits, error: auditsError },
    ] = await Promise.all([
      context.supabase.from("services").select("*").eq("active", true),
      context.supabase.from("settings").select("*").maybeSingle(),
      context.supabase
        .from("lead_audits")
        .select("*")
        .eq("lead_id", data.leadId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    if (servicesError) throw new Error(servicesError.message);
    if (settingsError) throw new Error(settingsError.message);
    if (auditsError) throw new Error(auditsError.message);

    const catalog = (services ?? [])
      .map((s) => `- ${s.name}: R$ ${s.price_min} a R$ ${s.price_max}. ${s.description ?? ""}`)
      .join("\n");

    const result = await callAi<z.infer<typeof offerResult>>({
      system: `${BASE_RULES}\nVocê é o AGENTE COMERCIAL. Escolha o serviço mais adequado do catálogo do vendedor e monte a oferta. Respeite a faixa de preço do catálogo (ticket mínimo R$ ${settings?.ticket_min ?? 1000}, máximo R$ ${settings?.ticket_max ?? 6000}).`,
      prompt: `Empresa:\n${leadFacts(lead)}\n\nCatálogo de serviços do vendedor:\n${catalog || "Nenhum serviço cadastrado"}\n\nAuditoria mais recente:\n${audits?.[0] ? JSON.stringify(audits[0]) : "Sem auditoria registrada"}`,
      jsonSchema: offerSchema as unknown as Record<string, unknown>,
      schemaName: "oferta",
    });

    const { data: savedOffer, error } = await context.supabase
      .from("lead_opportunities")
      .insert({
        user_id: context.userId,
        lead_id: data.leadId,
        opportunity_summary: result.opportunity_summary,
        service_name: result.service_name,
        rationale: result.rationale,
        benefits: result.benefits,
        structure: result.structure,
        price_min: result.price_min,
        price_max: result.price_max,
        sales_argument: result.sales_argument,
        urgency: result.urgency,
        cta: result.cta,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (!savedOffer) throw new Error("Não foi possível salvar a oferta.");

    const { data: updatedLead, error: updateError } = await context.supabase
      .from("leads")
      .update({
        recommended_offer: result.service_name,
        potential_value_min: result.price_min,
        potential_value_max: result.price_max,
        status: ["novo", "analisado"].includes(String(lead["status"]))
          ? "qualificado"
          : (lead["status"] as string),
      })
      .eq("id", data.leadId)
      .select("id")
      .single();
    if (updateError) throw new Error(updateError.message);
    if (!updatedLead) throw new Error("Não foi possível confirmar a atualização do lead.");

    return result;
  });

const offerResult = z.object({
  opportunity_summary: z.string(),
  service_name: z.string(),
  rationale: z.string(),
  benefits: z.array(z.string()),
  structure: z.array(z.string()),
  price_min: z.number(),
  price_max: z.number(),
  sales_argument: z.string(),
  urgency: z.string(),
  cta: z.string(),
});

/* ------------------------------------------------------------------ */
/* AGENTE PROMPT ENGINEER — prompt para o Lovable                      */
/* ------------------------------------------------------------------ */

export const generateWebsitePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => leadInput.parse(data))
  .handler(async ({ data, context }) => {
    const lead = await loadLead(context.supabase, data.leadId);

    const [
      { data: opportunity, error: opportunityError },
      { data: references, error: referencesError },
    ] = await Promise.all([
      context.supabase
        .from("lead_opportunities")
        .select("*")
        .eq("lead_id", data.leadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      context.supabase.from("design_references").select("*").eq("lead_id", data.leadId),
    ]);

    if (opportunityError) throw new Error(opportunityError.message);
    if (referencesError) throw new Error(referencesError.message);

    const prompt = await callAi<string>({
      system: `${BASE_RULES}\nVocê é o AGENTE PROMPT ENGINEER. Gere um prompt EXTREMAMENTE detalhado, em português, pronto para colar no Lovable e criar o site desta empresa. Estruture com títulos em maiúsculas e listas. Cubra: empresa, segmento, localização, público, objetivo, posicionamento, problemas encontrados, oportunidades, estrutura da página seção por seção, textos sugeridos, CTA, WhatsApp, SEO, mobile, acessibilidade, animações, UX, UI, cores, tipografia, imagens, componentes, formulário e conversão. Não invente dados da empresa: onde faltar informação, escreva "Dado não disponível — confirmar com o cliente". Responda apenas com o prompt.`,
      prompt: `Empresa:\n${leadFacts(lead)}\n\nOferta recomendada:\n${opportunity ? JSON.stringify(opportunity) : "Sem oferta gerada"}\n\nReferências de design escolhidas:\n${(references ?? []).map((r) => `${r.name} (${r.url ?? "sem URL"}) — ${r.reason ?? ""}`).join("\n") || "Nenhuma"}`,
    });

    if (opportunity) {
      const { data: saved, error } = await context.supabase
        .from("lead_opportunities")
        .update({ website_prompt: prompt })
        .eq("id", opportunity.id)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (!saved) throw new Error("Não foi possível salvar o prompt.");
    } else {
      const { data: saved, error } = await context.supabase
        .from("lead_opportunities")
        .insert({
          user_id: context.userId,
          lead_id: data.leadId,
          website_prompt: prompt,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (!saved) throw new Error("Não foi possível salvar o prompt.");
    }

    return { prompt };
  });

/* ------------------------------------------------------------------ */
/* AGENTE DESIGNER — referências visuais                               */
/* ------------------------------------------------------------------ */

const referencesSchema = {
  type: "object",
  additionalProperties: false,
  required: ["references"],
  properties: {
    references: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "url", "reason"],
        properties: {
          name: { type: "string" },
          url: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

export const findDesignReferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => leadInput.parse(data))
  .handler(async ({ data, context }) => {
    const lead = await loadLead(context.supabase, data.leadId);

    const result = await callAi<{
      references: Array<{ name: string; url: string; reason: string }>;
    }>({
      system: `${BASE_RULES}\nVocê é o AGENTE DESIGNER. Sugira exatamente 3 referências visuais reais e conhecidas (sites de empresas ou estúdios) adequadas ao segmento. As referências servem apenas como inspiração de estrutura, UX e hierarquia — nunca para copiar. Explique o motivo de cada escolha.`,
      prompt: `Empresa:\n${leadFacts(lead)}`,
      jsonSchema: referencesSchema as unknown as Record<string, unknown>,
      schemaName: "referencias",
    });

    const { error: deleteError } = await context.supabase
      .from("design_references")
      .delete()
      .eq("lead_id", data.leadId)
      .eq("used", false);
    if (deleteError) throw new Error(deleteError.message);

    const rows = (result.references ?? []).slice(0, 3).map((reference) => ({
      user_id: context.userId,
      lead_id: data.leadId,
      name: reference.name,
      url: reference.url,
      reason: reference.reason,
    }));

    if (rows.length > 0) {
      const { data: savedReferences, error } = await context.supabase
        .from("design_references")
        .insert(rows)
        .select("id");
      if (error) throw new Error(error.message);
      if (savedReferences?.length !== rows.length)
        throw new Error("Não foi possível salvar todas as referências.");
    }

    return result;
  });

/* ------------------------------------------------------------------ */
/* AGENTE COPYWRITER / FOLLOW-UP — mensagens de abordagem              */
/* ------------------------------------------------------------------ */

const outreachInput = z.object({
  leadId: z.string().uuid(),
  channel: z.enum(["whatsapp", "instagram", "email", "linkedin"]),
  step: z.enum(["primeiro", "segundo", "terceiro", "final"]),
});

export const generateOutreach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => outreachInput.parse(data))
  .handler(async ({ data, context }) => {
    const lead = await loadLead(context.supabase, data.leadId);

    const [
      { data: settings, error: settingsError },
      { data: opportunity, error: opportunityError },
      { data: previous, error: previousError },
    ] = await Promise.all([
      context.supabase.from("settings").select("*").maybeSingle(),
      context.supabase
        .from("lead_opportunities")
        .select("*")
        .eq("lead_id", data.leadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      context.supabase
        .from("outreach_messages")
        .select("content, step")
        .eq("lead_id", data.leadId)
        .order("created_at", { ascending: true }),
    ]);

    if (settingsError) throw new Error(settingsError.message);
    if (opportunityError) throw new Error(opportunityError.message);
    if (previousError) throw new Error(previousError.message);

    const stepBrief: Record<string, string> = {
      primeiro:
        "Primeira abordagem: curta, humana, sem cara de spam. Comece mostrando que você analisou a empresa e cite um ponto positivo real. Depois apresente a oportunidade em uma frase e feche com um convite leve para mostrar uma ideia.",
      segundo:
        "Segundo contato: retomada leve, sem pressão, lembrando a ideia preparada e oferecendo mostrar em poucos minutos.",
      terceiro:
        "Terceiro contato: traga um ângulo novo de valor (resultado prático) e pergunte se faz sentido conversar.",
      final:
        "Follow-up final: educado, encerra o ciclo, deixa a porta aberta para o futuro. Nunca agressivo.",
    };

    const content = await callAi<string>({
      system: `${BASE_RULES}\nVocê é o AGENTE COPYWRITER. Tom desejado: ${settings?.message_tone ?? "consultivo"}. Canal: ${data.channel}. ${stepBrief[data.step]}\nNunca cite números que não estejam nos dados. Nunca comece vendendo site. Responda apenas com a mensagem final, sem explicações.`,
      prompt: `Empresa:\n${leadFacts(lead)}\n\nOferta recomendada:\n${opportunity ? `${opportunity.service_name} — ${opportunity.opportunity_summary ?? ""}` : "Sem oferta gerada"}\n\nMensagens anteriores:\n${(previous ?? []).map((m) => `[${m.step}] ${m.content}`).join("\n---\n") || "Nenhuma"}`,
    });

    const { data: inserted, error } = await context.supabase
      .from("outreach_messages")
      .insert({
        user_id: context.userId,
        lead_id: data.leadId,
        channel: data.channel,
        step: data.step,
        content,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (!inserted) throw new Error("Não foi possível salvar a mensagem.");
    return inserted;
  });
