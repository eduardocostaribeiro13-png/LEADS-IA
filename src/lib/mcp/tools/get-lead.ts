import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_lead",
  title: "Ver lead",
  description: "Retorna os detalhes completos de um lead do usuário pelo id.",
  inputSchema: { id: z.string().uuid().describe("Id do lead.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Não autenticado.");
    const { data, error } = await supabaseForUser(ctx).from("leads").select("*").eq("id", id).maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("Lead não encontrado.");
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});
