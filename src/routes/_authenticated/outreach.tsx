import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PanelCard } from "@/components/PanelCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/outreach")({
  head: () => ({
    meta: [
      { title: "Abordagens | Lead Hunter AI" },
      {
        name: "description",
        content:
          "Todas as mensagens geradas por WhatsApp, Instagram, e-mail e LinkedIn — revisadas por você antes do envio.",
      },
      { property: "og:title", content: "Abordagens | Lead Hunter AI" },
      {
        property: "og:description",
        content: "Mensagens personalizadas e follow-ups, sempre com confirmação antes de enviar.",
      },
    ],
  }),
  component: OutreachPage,
});

function OutreachPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["outreach"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outreach_messages")
        .select("*, leads(company_name)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const messages = data ?? [];

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Mensagem copiada.");
  }

  return (
    <AppShell
      title="Abordagens"
      description="Nenhuma mensagem é enviada automaticamente. Você revisa, copia e envia."
    >
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-28 animate-pulse rounded-2xl bg-soft" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Nenhuma mensagem gerada ainda"
          description="Abra uma empresa qualificada e gere a primeira abordagem: curta, humana e mostrando que você analisou o negócio antes de vender."
          action={
            <Button asChild>
              <Link to="/attack">Ver fila de ataque</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {messages.map((message) => (
            <PanelCard key={message.id} bodyClassName="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link
                    to="/leads/$id"
                    params={{ id: message.lead_id }}
                    className="text-sm font-medium hover:text-ice"
                  >
                    {(message.leads as { company_name?: string } | null)?.company_name ??
                      "Empresa removida"}
                  </Link>
                  <p className="label-mono mt-1 text-muted-foreground">
                    {message.channel} · {message.step} · {formatDate(message.created_at)} ·{" "}
                    {message.sent_at ? "enviada" : "não enviada"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 border-edge"
                  onClick={() => copy(message.content)}
                >
                  <Copy className="size-3.5" aria-hidden="true" />
                  Copiar
                </Button>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {message.content}
              </p>
            </PanelCard>
          ))}
        </div>
      )}
    </AppShell>
  );
}
