/**
 * Camada de descoberta de leads.
 *
 * IMPORTANTE: nenhuma fonte externa está conectada neste momento.
 * Este módulo é a única fronteira com APIs externas (Google Places, Google
 * Search, Instagram, etc.). Enquanto não houver integração, ele responde
 * `connected: false` e NUNCA inventa empresas, avaliações ou seguidores.
 */

export type DiscoverySourceId = "google_places" | "google_search" | "instagram" | "manual";

export interface DiscoverySource {
  id: DiscoverySourceId;
  label: string;
  connected: boolean;
  description: string;
}

export const DISCOVERY_SOURCES: DiscoverySource[] = [
  {
    id: "google_places",
    label: "Google Maps / Places",
    connected: false,
    description: "Busca de empresas por localização, segmento e avaliações.",
  },
  {
    id: "google_search",
    label: "Google Search",
    connected: false,
    description: "Descoberta de sites e presença digital.",
  },
  {
    id: "instagram",
    label: "Instagram",
    connected: false,
    description: "Seguidores, frequência de posts e bio.",
  },
  {
    id: "manual",
    label: "Importação manual",
    connected: true,
    description: "Cadastro de empresas encontradas por você.",
  },
];

export interface HuntFilters {
  country: string;
  state: string;
  city: string;
  neighborhood: string;
  segment: string;
  signals: string[];
  quantity: number;
}

export interface HuntResult {
  connected: boolean;
  source: DiscoverySourceId;
  message: string;
  leads: never[];
}

export const COMMERCIAL_SIGNALS = [
  "Sem site",
  "Site ruim",
  "Site antigo",
  "Site lento",
  "Site não responsivo",
  "Sem CTA",
  "Sem WhatsApp",
  "Instagram forte",
  "Muitas avaliações",
  "Muitos seguidores",
  "Negócio premium",
  "Alta demanda",
  "Ticket alto",
];

export const SEGMENTS = [
  "Clínicas",
  "Odontologia",
  "Estética",
  "Dermatologia",
  "Psicologia",
  "Advocacia",
  "Imobiliárias",
  "Restaurantes",
  "Hotéis",
  "Pousadas",
  "Turismo",
  "Academias",
  "Salões",
  "Barbearias",
  "Lojas",
  "Empresas B2B",
  "Profissionais liberais",
  "Serviços premium",
];

export const QUANTITIES = [10, 25, 50, 100, 250];

/**
 * Executa a caça. Enquanto a fonte não estiver conectada, devolve o estado
 * explícito para a interface — sem dados fabricados.
 */
export async function huntLeads(filters: HuntFilters): Promise<HuntResult> {
  const source = DISCOVERY_SOURCES.find((entry) => entry.id === "google_places");

  if (!source?.connected) {
    return {
      connected: false,
      source: "google_places",
      message:
        "Fonte não conectada. Conecte o Google Maps / Places nas Configurações para caçar empresas reais em " +
        [filters.city, filters.state].filter(Boolean).join("/") +
        ".",
      leads: [],
    };
  }

  // Ponto de substituição pela API real (placesService.searchNearby).
  return { connected: true, source: "google_places", message: "OK", leads: [] };
}
