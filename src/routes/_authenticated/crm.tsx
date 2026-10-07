import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { KanbanSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatRange, orNotAvailable } from "@/lib/format";
import { PIPELINE_STAGES } from "@/lib/score";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({
    meta: [
      { title: "Pipeline | Lead Hunter AI" },
      {
        name: "description",
        content:
          "Pipeline visual do primeiro contato ao fechamento: arraste empresas entre as etapas e acompanhe o valor em negociação.",
      },
      { property: "og:title", content: "Pipeline | Lead Hunter AI" },
      {
        property: "og:description",
        content: "Kanban comercial com 10 etapas, valor da oportunidade e próximo contato.",
      },
    ],
  }),
  component: CrmPage,
});

function CrmPage() {
  const queryClient = useQueryClient();
  const [dragging, setDragging] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["crm-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, company_name, category, city, state, status, lead_score, recommended_offer, potential_value_min, potential_value_max, next_contact_at",
        )
        .order("lead_score", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
    onError: () => toast.error("Não foi possível mover a empresa."),
  });

  const leads = data ?? [];

  if (!isLoading && leads.length === 0) {
    return (
      <AppShell title="Pipeline" description="Do primeiro contato ao fechamento.">
        <EmptyState
          icon={KanbanSquare}
          title="Seu pipeline está vazio."
          description="Cace leads e qualifique empresas: elas aparecem aqui para você acompanhar até o fechamento."
          action={
            <Button asChild>
              <Link to="/hunter">CAÇAR MEUS PRIMEIROS LEADS</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Pipeline"
      description="Arraste as empresas entre as etapas para atualizar o status."
    >
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
        <div className="flex min-w-max gap-4">
          {PIPELINE_STAGES.map((stage) => {
            const items = leads.filter((lead) => lead.status === stage.key);
            const total = items.reduce((sum, lead) => sum + Number(lead.potential_value_max ?? 0), 0);
            return (
              <section
                key={stage.key}
                onDragOver={(event) => {
                  event.preventDefault();
                  setHover(stage.key);
                }}
                onDragLeave={() => setHover((current) => (current === stage.key ? null : current))}
                onDrop={() => {
                  if (dragging) move.mutate({ id: dragging, status: stage.key });
                  setDragging(null);
                  setHover(null);
                }}
                className={cn(
                  "w-72 shrink-0 rounded-2xl border bg-panel p-3 transition-colors",
                  hover === stage.key ? "border-ice/60" : "border-edge",
                )}
              >
                <header className="flex items-center justify-between px-1 pb-3">
                  <span className="text-sm font-medium">{stage.label}</span>
                  <span className="label-mono text-muted-foreground">{items.length}</span>
                </header>
                {total > 0 && (
                  <p className="px-1 pb-3 font-mono text-[11px] text-muted-foreground">
                    {formatRange(0, total).replace("Até ", "")}
                  </p>
                )}
                <ul className="space-y-2">
                  {isLoading
                    ? [0, 1].map((row) => (
                        <li key={row} className="h-20 animate-pulse rounded-xl bg-soft" />
                      ))
                    : items.map((lead) => (
                        <li
                          key={lead.id}
                          draggable
                          onDragStart={() => setDragging(lead.id)}
                          onDragEnd={() => setDragging(null)}
                          className={cn(
                            "cursor-grab rounded-xl border border-edge bg-card p-3 active:cursor-grabbing",
                            dragging === lead.id && "opacity-50",
                          )}
                        >
                          <Link
                            to="/leads/$id"
                            params={{ id: lead.id }}
                            className="block text-sm font-medium hover:text-ice"
                          >
                            {lead.company_name}
                          </Link>
                          <p className="mt-1 truncate text-[11px] text-muted-foreground">
                            {orNotAvailable(lead.category)} ·{" "}
                            {orNotAvailable([lead.city, lead.state].filter(Boolean).join("/"))}
                          </p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="label-mono text-muted-foreground">
                              score {lead.lead_score}
                            </span>
                            <span className="font-mono text-[11px] text-foreground">
                              {formatRange(lead.potential_value_min, lead.potential_value_max)}
                            </span>
                          </div>
                        </li>
                      ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
