import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_leads",
  title: "Listar leads",
  description: "Lista os leads do usuário, ordenados por Lead Score, com filtros opcionais.",
  inputSchema: {
    min_score: z.number().int().min(0).max(100).optional().describe("Score mínimo."),
    status: z.string().optional().describe("Status do pipeline (ex.: novo, qualificado)."),
    city: z.string().optional().describe("Cidade."),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ min_score, status, city, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Não autenticado.");
    let query = supabaseForUser(ctx)
      .from("leads")
      .select("id, company_name, category, city, state, status, lead_score, main_problem, recommended_offer, is_demo")
      .order("lead_score", { ascending: false })
      .limit(limit);
    if (min_score !== undefined) query = query.gte("lead_score", min_score);
    if (status) query = query.eq("status", status);
    if (city) query = query.ilike("city", city);
    const { data, error } = await query;
    if (error) throw new ToolError(error.message);
    const leads = (data ?? []).map((l) => ({
      id: String(l.id),
      company_name: String(l.company_name),
      category: l.category ? String(l.category) : null,
      city: l.city ? String(l.city) : null,
      state: l.state ? String(l.state) : null,
      status: String(l.status),
      lead_score: Number(l.lead_score ?? 0),
      main_problem: l.main_problem ? String(l.main_problem) : null,
      recommended_offer: l.recommended_offer ? String(l.recommended_offer) : null,
      is_demo: Boolean(l.is_demo),
    }));
    return { content: [{ type: "text", text: JSON.stringify(leads) }], structuredContent: { leads } };
  },
});
