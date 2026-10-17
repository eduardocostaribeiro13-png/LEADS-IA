import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../integrations/supabase/types";
import type { searchOpenStreetMap } from "./osm.server";
import type { calculateLeadScore } from "./score";

/** The worker runs outside the web process, including while Render is asleep. */
export async function runDailyHunts(
  db: SupabaseClient<Database>,
  search: typeof searchOpenStreetMap,
  score: typeof calculateLeadScore,
  wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
) {
  const summary = { completed: 0, failed: 0, skipped: 0 };
  const schedules: Database["public"]["Tables"]["hunt_schedules"]["Row"][] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from("hunt_schedules")
      .select("*")
      .eq("enabled", true)
      .order("user_id")
      .range(offset, offset + 499);
    if (error || !data) throw new Error("Não foi possível carregar as buscas diárias.");
    schedules.push(...data);
    if (data.length < 500) break;
  }
  for (const schedule of schedules) {
    const { data: claimed, error: claimError } = await db.rpc("claim_daily_hunt", {
      p_user_id: schedule.user_id,
    });
    if (claimError || !claimed) {
      summary.failed++;
      continue;
    }
    const run = claimed[0];
    if (!run) {
      summary.skipped++;
      continue;
    }
    try {
      // A bounded pool avoids repeatedly selecting only the first already-saved companies.
      const excludeIds: string[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data: existing, error: existingError } = await db
          .from("leads")
          .select("external_id")
          .eq("user_id", schedule.user_id)
          .eq("source", "openstreetmap")
          .not("external_id", "is", null)
          .order("id")
          .range(offset, offset + 499);
        if (existingError || !existing)
          throw new Error("Não foi possível verificar os leads existentes.");
        excludeIds.push(...existing.map((p) => p.external_id!));
        if (existing.length < 500) break;
      }
      const places = await search({ ...schedule, neighborhood: "", excludeIds });
      // Re-read before saving: a user may have paused or edited the search while it was running.
      const { data: current, error: currentError } = await db
        .from("hunt_schedules")
        .select("*")
        .eq("user_id", schedule.user_id)
        .single();
      if (
        currentError ||
        !current ||
        !current.enabled ||
        current.updated_at !== schedule.updated_at
      )
        throw new Error("Busca pausada ou alterada durante a execução.");
      const rows = places.map((place) => {
        const lead = {
          user_id: schedule.user_id,
          company_name: place.name,
          category: schedule.segment,
          address: place.address,
          city: schedule.city,
          state: schedule.state,
          country: schedule.country,
          source: "openstreetmap",
          external_id: place.id,
          phone: place.phone ?? null,
          website: place.website ?? null,
          notes: `Fonte: OpenStreetMap contributors (ODbL). ${place.mapsUrl}. Localização pesquisada: ${schedule.city}; confirme o endereço.`,
        };
        const points = score(lead);
        return {
          ...lead,
          lead_score: points.total,
          investment_score: points.investment,
          website_need_score: points.websiteNeed,
          digital_presence_score: points.digitalPresence,
          sales_potential_score: points.salesPotential,
          problem_score: points.problems,
        };
      });
      let inserted = 0;
      if (rows.length) {
        const { data, error: insertError } = await db
          .from("leads")
          .upsert(rows, { onConflict: "user_id,source,external_id", ignoreDuplicates: true })
          .select("id");
        if (insertError || !data) throw new Error("Não foi possível salvar os leads encontrados.");
        // Empty is valid here: concurrent duplicate inserts are deliberately ignored.
        inserted = data.length;
      }
      const { data: finished, error: finishError } = await db
        .from("hunt_runs")
        .update({
          status: "completed",
          finished_at: new Date().toISOString(),
          inserted_count: inserted,
        })
        .eq("id", run.id)
        .eq("lease_token", run.lease_token)
        .select("id")
        .single();
      if (finishError || !finished)
        throw new Error("Não foi possível registrar a conclusão da busca.");
      summary.completed++;
    } catch (cause) {
      summary.failed++;
      const { error: recordError } = await db
        .from("hunt_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error: cause instanceof Error ? cause.message : "Falha na busca diária.",
        })
        .eq("id", run.id)
        .eq("lease_token", run.lease_token);
      if (recordError) throw new Error("Não foi possível registrar a falha da busca diária.");
    } finally {
      // Public geocoding/Overpass endpoints require moderate, sequential traffic.
      await wait(6000);
    }
  }
  return summary;
}
