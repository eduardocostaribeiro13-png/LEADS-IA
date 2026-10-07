import type { TablesUpdate } from "@/integrations/supabase/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { PanelCard } from "@/components/PanelCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DISCOVERY_SOURCES } from "@/services/leadHunterService";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Configurações | Lead Hunter AI" },
      {
        name: "description",
        content:
          "Serviços oferecidos, faixas de preço, ticket, cidades e segmentos prioritários, tom das mensagens e integrações.",
      },
      { property: "og:title", content: "Configurações | Lead Hunter AI" },
      {
        property: "og:description",
        content: "Ajuste a máquina de prospecção ao seu negócio.",
      },
    ],
  }),
  component: SettingsPage,
});

type Draft = Record<string, string>;

function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>({});

  const { data } = useQuery({
    queryKey: ["settings-page"],
    queryFn: async () => {
      const [settings, services] = await Promise.all([
        supabase.from("settings").select("*").maybeSingle(),
        supabase.from("services").select("*").order("priority"),
      ]);
      if (settings.error) throw new Error(settings.error.message);
      return { settings: settings.data, services: services.data ?? [] };
    },
  });

  const settings = data?.settings;
  const value = (key: string, fallback: unknown) => draft[key] ?? String(fallback ?? "");
  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));

  const save = useMutation({
    mutationFn: async () => {
      if (!settings) throw new Error("Configurações não encontradas.");
      const list = (raw: string | undefined, current: string[]) =>
        raw === undefined ? current : raw.split(",").map((item) => item.trim()).filter(Boolean);
      const num = (raw: string | undefined, current: number) =>
        raw === undefined || raw === "" || Number.isNaN(Number(raw)) ? current : Number(raw);
      const { error } = await supabase
        .from("settings")
        .update({
          ticket_min: num(draft["ticket_min"], settings.ticket_min),
          ticket_max: num(draft["ticket_max"], settings.ticket_max),
          avg_ticket: num(draft["avg_ticket"], settings.avg_ticket),
          message_tone: draft["message_tone"] ?? settings.message_tone,
          priority_cities: list(draft["priority_cities"], settings.priority_cities),
          priority_segments: list(draft["priority_segments"], settings.priority_segments),
        })
        .eq("id", settings.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      setDraft({});
      await queryClient.invalidateQueries();
      toast.success("Configurações salvas.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao salvar."),
  });

  const updateService = useMutation({
    mutationFn: async (input: { id: string; patch: TablesUpdate<"services"> }) => {
      const { error } = await supabase.from("services").update(input.patch).eq("id", input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const addService = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("services").insert({
        user_id: user.id,
        name: "Novo serviço",
        price_min: 1000,
        price_max: 3000,
        priority: (data?.services.length ?? 0) + 1,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const removeService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (
    <AppShell title="Configurações" description="Ajuste a prospecção ao seu negócio.">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PanelCard title="Comercial" subtitle="Usado na geração de ofertas e mensagens.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              ["ticket_min", "Ticket mínimo (R$)", settings?.ticket_min],
              ["ticket_max", "Ticket máximo (R$)", settings?.ticket_max],
              ["avg_ticket", "Ticket médio (R$)", settings?.avg_ticket],
            ].map(([key, label, current]) => (
              <div key={String(key)} className="space-y-1.5">
                <Label htmlFor={String(key)} className="text-xs">
                  {String(label)}
                </Label>
                <Input
                  id={String(key)}
                  value={value(String(key), current)}
                  onChange={set(String(key))}
                  className="h-9 border-edge bg-card"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tone" className="text-xs">
                Tom das mensagens
              </Label>
              <Input
                id="tone"
                value={value("message_tone", settings?.message_tone)}
                onChange={set("message_tone")}
                className="h-9 border-edge bg-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cities" className="text-xs">
                Cidades prioritárias (separe por vírgula)
              </Label>
              <Input
                id="cities"
                value={value("priority_cities", settings?.priority_cities?.join(", "))}
                onChange={set("priority_cities")}
                className="h-9 border-edge bg-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="segments" className="text-xs">
                Segmentos prioritários (separe por vírgula)
              </Label>
              <Input
                id="segments"
                value={value("priority_segments", settings?.priority_segments?.join(", "))}
                onChange={set("priority_segments")}
                className="h-9 border-edge bg-card"
              />
            </div>
          </div>
          <Button className="mt-5" onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar configurações
          </Button>
        </PanelCard>

        <PanelCard title="Integrações" subtitle="Chaves ficam guardadas com segurança no servidor.">
          <ul className="space-y-2">
            {DISCOVERY_SOURCES.map((source) => (
              <li
                key={source.id}
                className="flex items-center justify-between rounded-lg border border-edge bg-card px-3 py-2.5 text-sm"
              >
                <span>{source.label}</span>
                <span className="label-mono text-muted-foreground">
                  {source.connected ? "Conectada" : "Fonte não conectada"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Para ativar Google Maps, busca ou Instagram, peça no chat para conectar a fonte desejada.
          </p>
        </PanelCard>
      </div>

      <PanelCard
        className="mt-6"
        title="Serviços oferecidos"
        subtitle="A IA só recomenda serviços ativos, dentro das faixas definidas aqui."
      >
        <div className="space-y-3">
          {(data?.services ?? []).map((service) => (
            <div
              key={service.id}
              className="grid grid-cols-1 items-center gap-3 rounded-xl border border-edge bg-card p-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto_auto]"
            >
              <Input
                defaultValue={service.name}
                aria-label="Nome do serviço"
                onBlur={(event) =>
                  updateService.mutate({ id: service.id, patch: { name: event.target.value } })
                }
                className="h-9 border-edge bg-panel"
              />
              <Input
                defaultValue={service.price_min}
                aria-label="Preço mínimo"
                onBlur={(event) =>
                  updateService.mutate({
                    id: service.id,
                    patch: { price_min: Number(event.target.value) || 0 },
                  })
                }
                className="h-9 border-edge bg-panel"
              />
              <Input
                defaultValue={service.price_max}
                aria-label="Preço máximo"
                onBlur={(event) =>
                  updateService.mutate({
                    id: service.id,
                    patch: { price_max: Number(event.target.value) || 0 },
                  })
                }
                className="h-9 border-edge bg-panel"
              />
              <Input
                defaultValue={service.delivery_days ?? ""}
                aria-label="Prazo em dias"
                placeholder="Prazo (dias)"
                onBlur={(event) =>
                  updateService.mutate({
                    id: service.id,
                    patch: { delivery_days: Number(event.target.value) || null },
                  })
                }
                className="h-9 border-edge bg-panel"
              />
              <Switch
                checked={service.active}
                aria-label="Serviço ativo"
                onCheckedChange={(checked) =>
                  updateService.mutate({ id: service.id, patch: { active: checked } })
                }
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remover serviço"
                onClick={() => removeService.mutate(service.id)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          className="mt-4 gap-2 border-edge"
          onClick={() => addService.mutate()}
        >
          <Plus className="size-4" aria-hidden="true" />
          Adicionar serviço
        </Button>
      </PanelCard>
    </AppShell>
  );
}
