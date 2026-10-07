import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listLeads from "./tools/list-leads";
import getLead from "./tools/get-lead";
import createLead from "./tools/create-lead";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "lead-scout-ai",
  title: "Lead Scout AI",
  version: "0.1.0",
  instructions:
    "Ferramentas de prospecção do usuário. Use list_leads para ver as melhores oportunidades, get_lead para detalhes e create_lead para cadastrar empresas reais. Nunca invente dados.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listLeads, getLead, createLead],
});
