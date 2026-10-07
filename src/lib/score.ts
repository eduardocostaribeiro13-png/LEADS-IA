import type { Tables } from "@/integrations/supabase/types";

export type Lead = Tables<"leads">;

export interface ScoreBreakdown {
  investment: number;
  websiteNeed: number;
  digitalPresence: number;
  salesPotential: number;
  problems: number;
  total: number;
}

export type Tier = "low" | "mid" | "good" | "high" | "atk";

export interface TierInfo {
  tier: Tier;
  label: string;
  className: string;
  dotClassName: string;
  strokeClassName: string;
}

export const TIERS: Record<Tier, TierInfo> = {
  low: {
    tier: "low",
    label: "Baixa prioridade",
    className: "bg-tier-low/15 text-tier-low",
    dotClassName: "bg-tier-low",
    strokeClassName: "stroke-tier-low",
  },
  mid: {
    tier: "mid",
    label: "Prioridade moderada",
    className: "bg-tier-mid/15 text-tier-mid",
    dotClassName: "bg-tier-mid",
    strokeClassName: "stroke-tier-mid",
  },
  good: {
    tier: "good",
    label: "Boa oportunidade",
    className: "bg-tier-good/15 text-tier-good",
    dotClassName: "bg-tier-good",
    strokeClassName: "stroke-tier-good",
  },
  high: {
    tier: "high",
    label: "Alta oportunidade",
    className: "bg-tier-high/15 text-tier-high",
    dotClassName: "bg-tier-high",
    strokeClassName: "stroke-tier-high",
  },
  atk: {
    tier: "atk",
    label: "Ataque imediato",
    className: "bg-tier-atk/15 text-tier-atk",
    dotClassName: "bg-tier-atk",
    strokeClassName: "stroke-tier-atk",
  },
};

export function tierForScore(score: number): TierInfo {
  if (score >= 90) return TIERS.atk;
  if (score >= 75) return TIERS.high;
  if (score >= 60) return TIERS.good;
  if (score >= 40) return TIERS.mid;
  return TIERS.low;
}

/** Segments where a premium ticket and high demand are typical. */
const PREMIUM_SEGMENTS = [
  "clínica",
  "clinica",
  "odonto",
  "dermatolog",
  "estética",
  "estetica",
  "advocacia",
  "advogado",
  "imobiliária",
  "imobiliaria",
  "hotel",
  "pousada",
  "arquitet",
  "medicina",
  "psicolog",
];

const CONVERSION_HUNGRY_SEGMENTS = [
  "restaurante",
  "academia",
  "salão",
  "salao",
  "barbearia",
  "turismo",
  "loja",
  "pet",
  "escola",
];

function matches(value: string | null, list: string[]): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return list.some((entry) => normalized.includes(entry));
}

/**
 * Lead Score 0–100.
 * Only signals actually present on the lead are rewarded — missing data never
 * invents points, it simply does not score.
 */
export function calculateLeadScore(
  lead: { [K in keyof Lead]?: Lead[K] | undefined } = {},
): ScoreBreakdown {
  const hasText = (value: string | null | undefined) => Boolean(value?.trim());
  // 1. Capacidade de investimento — 25
  let investment = 0;
  if (matches(lead.category ?? null, PREMIUM_SEGMENTS)) investment += 8;
  else if (matches(lead.category ?? null, CONVERSION_HUNGRY_SEGMENTS)) investment += 4;
  if ((lead.review_count ?? 0) >= 100) investment += 6;
  else if ((lead.review_count ?? 0) >= 30) investment += 3;
  if ((lead.rating ?? 0) >= 4.5) investment += 3;
  if (hasText(lead.website)) investment += 2;
  if ((lead.followers ?? 0) >= 5000) investment += 2;
  investment = Math.min(25, investment);

  // 2. Necessidade de website — 25
  let websiteNeed = 0;
  // A missing URL does not prove that the company has no website.
  if (hasText(lead.website)) {
    try {
      const site = new URL(lead.website!.trim());
      if (site.protocol === "http:") websiteNeed += 8;
      if (
        ["http:", "https:"].includes(site.protocol) &&
        ["wixsite.com", "negocio.site", "blogspot.com"].some(
          (host) => site.hostname === host || site.hostname.endsWith(`.${host}`),
        )
      ) {
        websiteNeed += 10;
      }
    } catch {
      // An incomplete URL provides no evidence about HTTPS or hosting.
    }
  }
  websiteNeed = Math.min(25, websiteNeed);

  // 3. Presença digital — 20
  let digitalPresence = 0;
  if (hasText(lead.instagram)) digitalPresence += 5;
  if ((lead.followers ?? 0) >= 1000) digitalPresence += 4;
  if ((lead.followers ?? 0) >= 10000) digitalPresence += 3;
  if (hasText(lead.google_maps_url)) digitalPresence += 3;
  if ((lead.review_count ?? 0) >= 50) digitalPresence += 3;
  if ((lead.rating ?? 0) >= 4.3) digitalPresence += 2;
  digitalPresence = Math.min(20, digitalPresence);

  // 4. Potencial comercial — 20
  let salesPotential = 0;
  if (matches(lead.category ?? null, PREMIUM_SEGMENTS)) salesPotential += 8;
  if (matches(lead.category ?? null, CONVERSION_HUNGRY_SEGMENTS)) salesPotential += 5;
  if (hasText(lead.phone) || hasText(lead.whatsapp)) salesPotential += 3;
  if (hasText(lead.email)) salesPotential += 2;
  if ((lead.review_count ?? 0) >= 100) salesPotential += 3;
  salesPotential = Math.min(20, salesPotential);

  // 5. Problemas detectáveis — 10
  let problems = 0;
  if (lead.rating != null && lead.rating > 0 && lead.rating < 4) problems += 1;
  problems = Math.min(10, problems);

  const total = Math.max(
    0,
    Math.min(100, investment + websiteNeed + digitalPresence + salesPotential + problems),
  );

  return { investment, websiteNeed, digitalPresence, salesPotential, problems, total };
}

export const SCORE_WEIGHTS = [
  { key: "investment", label: "Capacidade de investimento", max: 25 },
  { key: "websiteNeed", label: "Necessidade de website", max: 25 },
  { key: "digitalPresence", label: "Presença digital", max: 20 },
  { key: "salesPotential", label: "Potencial comercial", max: 20 },
  { key: "problems", label: "Problemas detectados", max: 10 },
] as const;

export const PIPELINE_STAGES = [
  { key: "novo", label: "Novo" },
  { key: "analisado", label: "Analisado" },
  { key: "qualificado", label: "Qualificado" },
  { key: "contatado", label: "Contatado" },
  { key: "respondeu", label: "Respondeu" },
  { key: "interessado", label: "Interessado" },
  { key: "proposta", label: "Proposta" },
  { key: "negociacao", label: "Negociação" },
  { key: "fechado", label: "Fechado" },
  { key: "perdido", label: "Perdido" },
] as const;

export type LeadStatus = (typeof PIPELINE_STAGES)[number]["key"];

export const FUNNEL_STAGES = PIPELINE_STAGES.filter((stage) => stage.key !== "perdido");
