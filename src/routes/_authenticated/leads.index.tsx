import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Download, Radar, Users } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";

import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PanelCard } from "@/components/PanelCard";
import { ScoreDial } from "@/components/ScoreDial";
import { Tag, TierBadge } from "@/components/TierBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatRange, orNotAvailable } from "@/lib/format";
import { PIPELINE_STAGES } from "@/lib/score";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  status: fallback(z.string(), "todos").default("todos"),
  order: fallback(z.string(), "score").default("score"),
  minScore: fallback(z.number(), 0).default(0),
});

export const Route = createFileRoute("/_authenticated/leads/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Leads | Lead Hunter AI" },
      {
        name: "description",
        content:
          "Todas as empresas encontradas, com score, status, oferta recomendada e valor potencial.",
      },
      { property: "og:title", content: "Leads | Lead Hunter AI" },
      {
        property: "og:description",
        content: "Filtre por score, cidade, segmento e status para atacar as melhores empresas.",
      },
    ],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("lead_score", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const leads = useMemo(() => {
    const term = search.q.trim().toLowerCase();
    const filtered = (data ?? []).filter((lead) => {
      if (search.status !== "todos" && lead.status !== search.status) return false;
      if (lead.lead_score < search.minScore) return false;
      if (!term) return true;
      return [
        lead.company_name,
        lead.category,
        lead.city,
        lead.state,
        lead.phone,
        lead.whatsapp,
        lead.email,
        lead.status,
        lead.tags?.join(" "),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });

    return [...filtered].sort((a, b) => {
      if (search.order === "potencial")
        return Number(b.potential_value_max ?? 0) - Number(a.potential_value_max ?? 0);
      if (search.order === "data")
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (search.order === "avaliacao") return Number(b.rating ?? 0) - Number(a.rating ?? 0);
      if (search.order === "reviews") return Number(b.review_count ?? 0) - Number(a.review_count ?? 0);
      return b.lead_score - a.lead_score;
    });
  }, [data, search]);

  function exportCsv() {
    const header = [
      "Empresa",
      "Segmento",
      "Cidade",
      "Telefone",
      "WhatsApp",
      "Website",
      "Instagram",
      "Score",
      "Status",
      "Oferta",
      "Valor potencial",
    ];
    const rows = leads.map((lead) => [
      lead.company_name,
      lead.category ?? "",
      [lead.city, lead.state].filter(Boolean).join("/"),
      lead.phone ?? "",
      lead.whatsapp ?? "",
      lead.website ?? "",
      lead.instagram ?? "",
      String(lead.lead_score),
      lead.status,
      lead.recommended_offer ?? "",
      lead.potential_value_max ? String(lead.potential_value_max) : "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "leads-lead-hunter-ai.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      title="Leads"
      description={`${leads.length} empresa(s) na sua base.`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-edge" onClick={exportCsv}>
            <Download className="size-4" aria-hidden="true" />
            Exportar CSV
          </Button>
          <Button asChild className="gap-2">
            <Link to="/hunter">
              <Radar className="size-4" aria-hidden="true" />
              Caçar leads
            </Link>
          </Button>
        </div>
      }
    >
      <PanelCard bodyClassName="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Input
            value={search.q}
            onChange={(event) =>
              navigate({ search: (prev) => ({ ...prev, q: event.target.value }) })
            }
            placeholder="Buscar empresa, cidade, telefone…"
            className="border-edge bg-card"
            aria-label="Buscar leads"
          />
          <Select
            value={search.status}
            onValueChange={(value) => navigate({ search: (prev) => ({ ...prev, status: value }) })}
          >
            <SelectTrigger aria-label="Filtrar por status" className="border-edge bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {PIPELINE_STAGES.map((stage) => (
                <SelectItem key={stage.key} value={stage.key}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(search.minScore)}
            onValueChange={(value) =>
              navigate({ search: (prev) => ({ ...prev, minScore: Number(value) }) })
            }
          >
            <SelectTrigger aria-label="Filtrar por score" className="border-edge bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 40, 60, 75, 90].map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value === 0 ? "Qualquer score" : `Score ${value}+`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={search.order}
            onValueChange={(value) => navigate({ search: (prev) => ({ ...prev, order: value }) })}
          >
            <SelectTrigger aria-label="Selecionar ordenação" className="border-edge bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Ordenar por score</SelectItem>
              <SelectItem value="potencial">Maior potencial</SelectItem>
              <SelectItem value="data">Mais recentes</SelectItem>
              <SelectItem value="avaliacao">Melhor avaliação</SelectItem>
              <SelectItem value="reviews">Mais avaliações</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PanelCard>

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-20 animate-pulse rounded-2xl bg-soft" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Você ainda não possui leads."
            description="Cace empresas por cidade e segmento, ou cadastre manualmente uma empresa que você já conhece."
            action={
              <Button asChild>
                <Link to="/hunter">CAÇAR MEUS PRIMEIROS LEADS</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {leads.map((lead) => (
              <li key={lead.id}>
                <Link
                  to="/leads/$id"
                  params={{ id: lead.id }}
                  className="rise flex items-center gap-4 rounded-2xl border border-edge bg-card px-5 py-4 transition-colors hover:border-ice/40"
                >
                  <ScoreDial score={lead.lead_score} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{lead.company_name}</span>
                      <TierBadge score={lead.lead_score} />
                      {lead.is_demo && <Tag label="DEMO" />}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {orNotAvailable(lead.category)} ·{" "}
                      {orNotAvailable([lead.city, lead.state].filter(Boolean).join("/"))} ·{" "}
                      {PIPELINE_STAGES.find((stage) => stage.key === lead.status)?.label ??
                        lead.status}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(lead.tags ?? []).slice(0, 4).map((tag) => (
                        <Tag key={tag} label={tag} />
                      ))}
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-xs text-muted-foreground">
                      {orNotAvailable(lead.recommended_offer)}
                    </p>
                    <p className="mt-1 font-mono text-sm">
                      {formatRange(lead.potential_value_min, lead.potential_value_max)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
