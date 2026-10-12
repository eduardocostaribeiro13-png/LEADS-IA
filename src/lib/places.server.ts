export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  mapsUrl: string;
}

export async function searchPlaces(
  input: { query: string; quantity: number },
  apiKey = process.env["GOOGLE_PLACES_API_KEY"],
  request: typeof fetch = fetch,
): Promise<PlaceResult[]> {
  if (!apiKey?.trim()) throw new Error("Google Maps ainda não foi configurado pelo administrador.");
  let response: Response;
  try {
    response = await request("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.googleMapsUri",
      },
      body: JSON.stringify({
        textQuery: input.query,
        pageSize: Math.min(input.quantity, 20),
        languageCode: "pt-BR",
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Google Maps não respondeu. Tente novamente em instantes.");
  }
  if (!response.ok) {
    if (response.status === 429)
      throw new Error(
        "Limite de consultas do Google Maps atingido. Verifique a cota no Google Cloud.",
      );
    if (response.status === 400 || response.status === 401 || response.status === 403)
      throw new Error(
        "Google Maps recusou a consulta. Verifique a chave, a API Places (New), as restrições e o faturamento no Google Cloud.",
      );
    throw new Error("Google Maps está indisponível. Tente novamente em instantes.");
  }
  const body = (await response.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      googleMapsUri?: string;
    }>;
  };
  return (body.places ?? [])
    .filter((p) => p.id && p.displayName?.text)
    .map((p) => ({
      id: p.id!,
      name: p.displayName!.text!,
      address: p.formattedAddress ?? "Endereço não informado",
      mapsUrl: p.googleMapsUri?.startsWith("https://")
        ? p.googleMapsUri
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.displayName!.text!)}&query_place_id=${encodeURIComponent(p.id!)}`,
    }));
}
