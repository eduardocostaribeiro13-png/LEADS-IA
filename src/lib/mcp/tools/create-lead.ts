import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { calculateLeadScore } from "@/lib/score";

export default defineTool({
  name: "create_lead",
  title: "Cadastrar lead",
  description: "Cadastra manualmente uma empresa real como novo lead do usuário.",
  inputSchema: {
    company_name: z.string().trim().min(1),
    category: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    email: z.string().email().optional(),
    website: z.string().optional(),
    instagram: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Não autenticado.");
    const breakdown = calculateLeadScore(input);
    const { data, error } = await supabaseForUser(ctx)
      .from("leads")
      .insert({
        ...input,
        user_id: ctx.getUserId(),
        source: "manual",
        lead_score: breakdown.total,
        investment_score: breakdown.investment,
        website_need_score: breakdown.websiteNeed,
        digital_presence_score: breakdown.digitalPresence,
        sales_potential_score: breakdown.salesPotential,
        problem_score: breakdown.problems,
      })
      .select("id, company_name")
      .single();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("Não foi possível confirmar o cadastro do lead.");
    return { content: [{ type: "text", text: `Lead criado: ${data.company_name} (${data.id})` }] };
  },
});
