import { discoverPlaces } from "@/lib/discovery.functions";
import type { PlaceResult } from "@/lib/places.server";

export type DiscoverySourceId =
  "openstreetmap" | "google_places" | "google_search" | "instagram" | "manual";

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
  leads: PlaceResult[];
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
  "Advocacia",
  "Imobiliárias",
  "Restaurantes",
  "Hotéis",
  "Pousadas",
  "Academias",
  "Salões",
  "Barbearias",
  "Lojas",
];

export const QUANTITIES = [10, 20];

/**
 * Executa a caça. Enquanto a fonte não estiver conectada, devolve o estado
 * explícito para a interface — sem dados fabricados.
 */
export async function huntLeads(filters: HuntFilters): Promise<HuntResult> {
  return discoverPlaces({ data: filters });
}
