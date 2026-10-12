import type { PlaceResult } from "./places.server";

const categories: Record<string, string[]> = {
  clinicas: ['["amenity"="clinic"]', '["healthcare"="clinic"]'],
  odontologia: ['["amenity"="dentist"]'],
  advocacia: ['["office"="lawyer"]'],
  imobiliarias: ['["office"="estate_agent"]'],
  restaurantes: ['["amenity"="restaurant"]'],
  hoteis: ['["tourism"="hotel"]'],
  pousadas: ['["tourism"="guest_house"]'],
  academias: ['["leisure"="fitness_centre"]'],
  saloes: ['["shop"="hairdresser"]', '["shop"="beauty"]'],
  barbearias: ['["shop"="hairdresser"]["male"="yes"]'],
  lojas: ['["shop"]'],
};

export function osmCategory(segment: string): string[] {
  const normalized = segment
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const tags = categories[normalized];
  if (!tags)
    throw new Error(
      "Este segmento ainda não tem correspondência na fonte gratuita. Escolha um dos segmentos da lista.",
    );
  return tags;
}

type Location = { lat: number; lon: number };
const locations = new Map<string, { value: Location; expires: number }>();
const results = new Map<string, { value: PlaceResult[]; expires: number }>();
let running = false;
let nextRequestAt = 0;
const headers = {
  "User-Agent": "LEADS-IA/1.0 (+https://leads-ia.onrender.com)",
  Accept: "application/json",
};

function remember<T>(
  cache: Map<string, { value: T; expires: number }>,
  key: string,
  value: T,
  ttl: number,
) {
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(key, { value, expires: Date.now() + ttl });
}

export async function searchOpenStreetMap(
  input: {
    city: string;
    state: string;
    country: string;
    neighborhood: string;
    segment: string;
    quantity: number;
  },
  request: typeof fetch = fetch,
): Promise<PlaceResult[]> {
  const tags = osmCategory(input.segment);
  const locationName = [input.neighborhood, input.city, input.state, input.country]
    .filter(Boolean)
    .join(", ");
  const cacheKey = `${locationName.toLowerCase()}|${tags.join("|")}`;
  const cached = results.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value.slice(0, input.quantity);
  // The public endpoints are for moderate usage. This app runs one server instance.
  if (running || Date.now() < nextRequestAt)
    throw new Error(
      "A fonte gratuita está atendendo outra consulta. Aguarde alguns segundos e tente novamente.",
    );
  running = true;
  nextRequestAt = Date.now() + 5000;
  try {
    let location = locations.get(locationName);
    if (!location || location.expires <= Date.now()) {
      const url = new URL(
        process.env["OSM_GEOCODING_URL"] || "https://nominatim.openstreetmap.org/search",
      );
      url.search = new URLSearchParams({
        q: locationName,
        format: "jsonv2",
        limit: "1",
      }).toString();
      const response = await request(url, { headers, signal: AbortSignal.timeout(12000) });
      if (!response.ok)
        throw new Error(
          "Não foi possível localizar a cidade na fonte gratuita. Tente novamente mais tarde.",
        );
      const entries = (await response.json()) as Array<{ lat: string; lon: string }>;
      const lat = Number(entries[0]?.lat),
        lon = Number(entries[0]?.lon);
      if (
        !entries.length ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        Math.abs(lat) > 90 ||
        Math.abs(lon) > 180
      )
        throw new Error(
          "Localização não encontrada. Confira cidade, estado e país; tente deixar o bairro vazio.",
        );
      remember(locations, locationName, { lat, lon }, 86400000);
      location = locations.get(locationName)!;
    }
    const radius = input.neighborhood ? 3000 : 10000;
    const area = `(around:${radius},${location.value.lat},${location.value.lon})`;
    const query = `[out:json][timeout:20];(${tags.map((tag) => `nwr${tag}["name"]${area};`).join("")});out tags 20;`;
    const response = await request(
      process.env["OSM_OVERPASS_URL"] || "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(25000),
      },
    );
    if (!response.ok)
      throw new Error(
        "A fonte gratuita está temporariamente ocupada. Tente novamente em alguns minutos.",
      );
    const body = (await response.json()) as {
      remark?: string;
      elements?: Array<{ type: string; id: number; tags?: Record<string, string> }>;
    };
    if (body.remark || !Array.isArray(body.elements))
      throw new Error("A fonte gratuita não concluiu a consulta. Tente novamente mais tarde.");
    const seen = new Set<string>();
    const places = body.elements
      .filter(
        (p) =>
          ["node", "way", "relation"].includes(p.type) &&
          Number.isSafeInteger(p.id) &&
          p.tags?.["name"],
      )
      .flatMap((p) => {
        const id = `${p.type}/${p.id}`;
        if (seen.has(id)) return [];
        seen.add(id);
        const t = p.tags!;
        return [
          {
            id,
            name: t["name"]!,
            address:
              [t["addr:street"], t["addr:housenumber"], t["addr:suburb"], t["addr:city"]]
                .filter(Boolean)
                .join(", ") || "Endereço não informado",
            mapsUrl: `https://www.openstreetmap.org/${id}`,
          },
        ];
      })
      .slice(0, 20);
    remember(results, cacheKey, places, 900000);
    return places.slice(0, input.quantity);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError" || error instanceof TypeError)
    )
      throw new Error("A fonte gratuita não respondeu a tempo. Tente novamente mais tarde.");
    throw error;
  } finally {
    running = false;
    nextRequestAt = Math.max(nextRequestAt, Date.now() + 1100);
  }
}
