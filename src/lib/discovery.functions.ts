import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { searchPlaces } from "@/lib/places.server";

export const getDiscoveryConfiguration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    googlePlacesConfigured: Boolean(process.env["GOOGLE_PLACES_API_KEY"]?.trim()),
  }));

export const discoverPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      country: z.string().trim().min(1).max(100),
      state: z.string().trim().max(100),
      city: z.string().trim().min(1, "Informe a cidade.").max(100),
      neighborhood: z.string().trim().max(100),
      segment: z.string().trim().min(1, "Informe o segmento.").max(150),
      quantity: z.number().int().min(1).max(20),
      signals: z
        .array(z.string())
        .max(
          0,
          "A busca inicial usa localização e segmento. Os sinais comerciais precisam de análise posterior.",
        ),
    }),
  )
  .handler(async ({ data }) => {
    const leads = await searchPlaces({
      query: [data.segment, data.neighborhood, data.city, data.state, data.country]
        .filter(Boolean)
        .join(", "),
      quantity: data.quantity,
    });
    return {
      connected: true,
      source: "google_places" as const,
      message: `${leads.length} empresas encontradas no Google Maps. Confira os resultados antes de cadastrar uma empresa.`,
      leads,
    };
  });
