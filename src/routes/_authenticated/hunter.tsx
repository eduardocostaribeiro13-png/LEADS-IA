import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, PlugZap, Radar, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { PanelCard } from "@/components/PanelCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { buildDemoLeads } from "@/lib/demo";
import { calculateLeadScore } from "@/lib/score";
import { cn } from "@/lib/utils";
import {
  COMMERCIAL_SIGNALS,
  DISCOVERY_SOURCES,
  QUANTITIES,
  SEGMENTS,
  huntLeads,
} from "@/services/leadHunterService";

export const Route = createFileRoute("/_authenticated/hunter")({
  head: () => ({
    meta: [
      { title: "Lead Hunter | Lead Hunter AI" },
      {
        name: "description",
        content:
          "Defina localização, segmento e sinais comerciais para encontrar empresas com necessidade real de site e capacidade de investir.",
      },
      { property: "og:title", content: "Lead Hunter | Lead Hunter AI" },
      {
        property: "og:description",
        content: "Cace empresas por cidade, segmento e sinais de oportunidade.",
      },
    ],
  }),
  component: Hunter,
});

function Hunter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [country, setCountry] = useState("Brasil");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [segment, setSegment] = useState(SEGMENTS[0]);
  const [customSegment, setCustomSegment] = useState("");
  const [quantity, setQuantity] = useState(25);
  const [signals, setSignals] = useState<string[]>(["Sem site"]);
  const [notice, setNotice] = useState<string | null>(null);

  const [manual, setManual] = useState({
    company_name: "",
    category: "",
    city: "",
    state: "",
    phone: "",
    whatsapp: "",
    email: "",
    website: "",
    instagram: "",
    google_maps_url: "",
  });

  const hunt = useMutation({
    mutationFn: () =>
      huntLeads({
        country,
        state,
        city,
        neighborhood,
        segment: customSegment.trim() || segment || "",
        signals,
        quantity,
      }),
    onSuccess: (result) => {
      setNotice(result.message);
      if (!result.connected) {
        toast.info("Fonte não conectada — nenhuma empresa foi inventada.");
      }
    },
    onError: () => toast.error("Não foi possível executar a caça agora."),
  });

  const seedDemo = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getUser();
      const userId = session.user?.id;
      if (!userId) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("leads").insert(buildDemoLeads(userId));
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("6 empresas DEMO adicionadas (identificadas como DEMO).");
      navigate({ to: "/leads" });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao criar demo."),
  });

  const addManual = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getUser();
      const userId = session.user?.id;
      if (!userId) throw new Error("Sessão expirada.");
      const breakdown = calculateLeadScore(manual);
      const { data, error } = await supabase
        .from("leads")
        .insert({
          ...manual,
          country,
          user_id: userId,
          source: "manual",
          lead_score: breakdown.total,
          investment_score: breakdown.investment,
          website_need_score: breakdown.websiteNeed,
          digital_presence_score: breakdown.digitalPresence,
          sales_potential_score: breakdown.salesPotential,
          problem_score: breakdown.problems,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries();
      toast.success("Empresa cadastrada. Abrindo para análise.");
      navigate({ to: "/leads/$id", params: { id: data.id } });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Falha ao cadastrar empresa."),
  });

  function toggleSignal(signal: string) {
    setSignals((current) =>
      current.includes(signal) ? current.filter((entry) => entry !== signal) : [...current, signal],
    );
  }

  return (
    <AppShell
      title="Lead Hunter"
      description="Escolha onde caçar, em qual segmento e quais sinais indicam oportunidade real."
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <PanelCard title="Localização" subtitle="Quanto mais específico, melhor a qualidade.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="country">País</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  className="border-edge bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={state}
                  onChange={(event) => setState(event.target.value)}
                  placeholder="SC"
                  className="border-edge bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Florianópolis"
                  className="border-edge bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro / região</Label>
                <Input
                  id="neighborhood"
                  value={neighborhood}
                  onChange={(event) => setNeighborhood(event.target.value)}
                  placeholder="Centro"
                  className="border-edge bg-card"
                />
              </div>
            </div>
          </PanelCard>

          <PanelCard title="Segmento" subtitle="Escolha da lista ou digite um segmento próprio.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Segmento</Label>
                <Select value={segment ?? ""} onValueChange={setSegment}>
                  <SelectTrigger aria-label="Selecionar segmento" className="border-edge bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map((entry) => (
                      <SelectItem key={entry} value={entry}>
                        {entry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customSegment">Segmento personalizado</Label>
                <Input
                  id="customSegment"
                  value={customSegment}
                  onChange={(event) => setCustomSegment(event.target.value)}
                  placeholder="Ex.: clínicas de fertilidade"
                  className="border-edge bg-card"
                />
              </div>
            </div>
          </PanelCard>

          <PanelCard
            title="Sinais comerciais"
            subtitle="O que indica que essa empresa precisa e pode pagar."
          >
            <div className="flex flex-wrap gap-2">
              {COMMERCIAL_SIGNALS.map((signal) => {
                const active = signals.includes(signal);
                return (
                  <button
                    key={signal}
                    type="button"
                    onClick={() => toggleSignal(signal)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-colors",
                      active
                        ? "border-ice/50 bg-ice/15 text-ice"
                        : "border-edge bg-card text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={active}
                  >
                    {signal}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2">
                <Label>Quantidade de leads</Label>
                <Select value={String(quantity)} onValueChange={(value) => setQuantity(Number(value))}>
                  <SelectTrigger aria-label="Selecionar quantidade de leads" className="w-32 border-edge bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUANTITIES.map((entry) => (
                      <SelectItem key={entry} value={String(entry)}>
                        {entry} leads
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="lg"
                className="gap-2"
                onClick={() => hunt.mutate()}
                disabled={hunt.isPending}
              >
                {hunt.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Radar className="size-4" aria-hidden="true" />
                )}
                CAÇAR LEADS
              </Button>
            </div>

            {notice && (
              <div className="mt-5 rounded-xl border border-edge bg-card p-4">
                <div className="flex items-start gap-3">
                  <PlugZap className="mt-0.5 size-4 shrink-0 text-tier-mid" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Fonte não conectada</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{notice}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Enquanto isso você pode cadastrar empresas manualmente ou carregar as empresas
                      DEMO para conhecer o fluxo completo.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </PanelCard>
        </div>

        <div className="space-y-6">
          <PanelCard title="Fontes de dados" subtitle="Nada é inventado: fontes desconectadas ficam explícitas.">
            <ul className="space-y-3">
              {DISCOVERY_SOURCES.map((source) => (
                <li
                  key={source.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-edge bg-card px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-foreground">{source.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{source.description}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 border-edge text-[11px]",
                      source.connected ? "text-tier-good" : "text-muted-foreground",
                    )}
                  >
                    {source.connected ? "Conectada" : "Não conectada"}
                  </Badge>
                </li>
              ))}
            </ul>
          </PanelCard>

          <PanelCard
            title="Cadastrar empresa manualmente"
            subtitle="Encontrou uma empresa por conta própria? Traga para cá e analise."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  ["company_name", "Nome da empresa"],
                  ["category", "Segmento"],
                  ["city", "Cidade"],
                  ["state", "Estado"],
                  ["phone", "Telefone"],
                  ["whatsapp", "WhatsApp"],
                  ["email", "E-mail"],
                  ["website", "Website"],
                  ["instagram", "Instagram"],
                  ["google_maps_url", "Google Maps"],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className="space-y-1.5">
                  <Label htmlFor={field} className="text-xs">
                    {label}
                  </Label>
                  <Input
                    id={field}
                    value={manual[field]}
                    onChange={(event) =>
                      setManual((current) => ({ ...current, [field]: event.target.value }))
                    }
                    className="h-9 border-edge bg-card"
                  />
                </div>
              ))}
            </div>
            <Button
              className="mt-4 w-full gap-2"
              disabled={!manual.company_name || addManual.isPending}
              onClick={() => addManual.mutate()}
            >
              {addManual.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              ANALISAR LEAD
            </Button>
          </PanelCard>

          <PanelCard title="Conhecer o fluxo" subtitle="Empresas fictícias, sempre marcadas como DEMO.">
            <Button
              variant="outline"
              className="w-full gap-2 border-edge"
              onClick={() => seedDemo.mutate()}
              disabled={seedDemo.isPending}
            >
              {seedDemo.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              Carregar 6 empresas DEMO
            </Button>
          </PanelCard>
        </div>
      </div>
    </AppShell>
  );
}
