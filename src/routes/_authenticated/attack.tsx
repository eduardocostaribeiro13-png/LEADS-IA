import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Crosshair } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PanelCard } from "@/components/PanelCard";
import { ScoreDial } from "@/components/ScoreDial";
import { TierBadge } from "@/components/TierBadge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatRange, orNotAvailable } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/attack")({
  head: () => ({
    meta: [
      { title: "Attack Queue | Lead Hunter AI" },
      {
        name: "description",
        content:
          "Fila de ataque: apenas empresas com score alto, com problema identificado, oferta recomendada e valor potencial.",
      },
      { property: "og:title", content: "Attack Queue | Lead Hunter AI" },
      {
        property: "og:description",
        content: "As empresas mais prováveis de comprar, em ordem de prioridade.",
      },
    ],
  }),
  component: AttackPage,
});

function AttackPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["attack-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .gte("lead_score", 75)
        .not("status", "in", '("fechado","perdido")')
        .order("lead_score", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const leads = data ?? [];

  return (
    <AppShell
      title="Attack Queue"
      description="Somente empresas altamente promissoras. Ataque de cima para baixo."
    >
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-28 animate-pulse rounded-2xl bg-soft" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Crosshair}
          title="Nenhuma empresa pronta para ataque"
          description="Empresas com score 75 ou mais aparecem aqui. Cace novos leads e rode a análise para preencher a fila."
          action={
            <Button asChild>
              <Link to="/hunter">Caçar leads agora</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {leads.map((lead) => (
            <PanelCard key={lead.id} bodyClassName="p-5">
              <div className="flex items-start gap-4">
                <ScoreDial score={lead.lead_score} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-semibold">{lead.company_name}</h3>
                    <TierBadge score={lead.lead_score} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {orNotAvailable(lead.category)} ·{" "}
                    {orNotAvailable([lead.city, lead.state].filter(Boolean).join("/"))}
                  </p>
                  <dl className="mt-4 space-y-2 text-xs">
                    <div>
                      <dt className="label-mono text-muted-foreground">Principal problema</dt>
                      <dd className="mt-0.5 text-foreground">{orNotAvailable(lead.main_problem)}</dd>
                    </div>
                    <div>
                      <dt className="label-mono text-muted-foreground">Oferta recomendada</dt>
                      <dd className="mt-0.5 text-foreground">
                        {orNotAvailable(lead.recommended_offer)}
                      </dd>
                    </div>
                    <div>
                      <dt className="label-mono text-muted-foreground">Valor potencial</dt>
                      <dd className="mt-0.5 font-mono text-foreground">
                        {formatRange(lead.potential_value_min, lead.potential_value_max)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link to="/leads/$id" params={{ id: lead.id }}>
                    Abrir empresa
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="border-edge">
                  <Link to="/leads/$id" params={{ id: lead.id }} hash="oferta">
                    Gerar oferta
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="border-edge">
                  <Link to="/leads/$id" params={{ id: lead.id }} hash="abordagem">
                    Abordar
                  </Link>
                </Button>
              </div>
            </PanelCard>
          ))}
        </div>
      )}
    </AppShell>
  );
}
