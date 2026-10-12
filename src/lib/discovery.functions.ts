import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { searchOpenStreetMap } from "@/lib/osm.server";

export const getDiscoveryConfiguration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    freeSource: "openstreetmap" as const,
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
    const leads = await searchOpenStreetMap(data);
    return {
      connected: true,
      source: "openstreetmap" as const,
      message: `${leads.length} empresas encontradas no OpenStreetMap, em até ${data.neighborhood ? 3 : 10} km do centro da localização informada. A cobertura varia e pode incluir municípios vizinhos.`,
      leads,
    };
  });
