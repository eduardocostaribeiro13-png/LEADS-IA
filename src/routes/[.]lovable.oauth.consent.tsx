import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface OAuthResult {
  data: { redirect_url?: string; redirect_to?: string; client?: { name?: string } } | null;
  error: { message: string } | null;
}
interface OAuthApi {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
}
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Autorizar acesso | Lead Hunter AI" },
      { name: "description", content: "Autorize um assistente de IA a acessar seus leads." },
      { property: "og:title", content: "Autorizar acesso | Lead Hunter AI" },
      { property: "og:description", content: "Conecte um assistente de IA à sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Pedido de autorização ausente.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ href: `/auth?next=${encodeURIComponent(next)}` });
    }
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id") ?? "";
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="grid min-h-screen place-items-center p-6 text-sm text-muted-foreground">
      Não foi possível carregar a autorização: {error instanceof Error ? error.message : String(error)}
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = details?.client?.name ?? "Um aplicativo";

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error: err } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    const target = data?.redirect_url ?? data?.redirect_to;
    if (err || !target) {
      setBusy(false);
      setError(err?.message ?? "O servidor não devolveu o redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-edge bg-panel p-6">
        <h1 className="font-display text-xl text-foreground">Conectar {name} à sua conta</h1>
        <p className="text-sm text-muted-foreground">
          {name} poderá ver e cadastrar leads em seu nome no Lead Hunter AI.
        </p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button disabled={busy} onClick={() => decide(true)}>Autorizar</Button>
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>Recusar</Button>
        </div>
      </div>
    </main>
  );
}
