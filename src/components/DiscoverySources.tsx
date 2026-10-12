import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getDiscoveryConfiguration } from "@/lib/discovery.functions";
import { PanelCard } from "@/components/PanelCard";

export function DiscoverySources() {
  const { user } = useAuth();
  const status = useQuery({
    queryKey: ["discovery-configuration", user?.id],
    queryFn: () => getDiscoveryConfiguration(),
    enabled: Boolean(user),
    staleTime: 30000,
  });
  return (
    <PanelCard title="Fontes de dados" subtitle="Disponibilidade das integrações de busca.">
      <ul className="space-y-3 text-sm">
        <li>
          Google Maps / Places:{" "}
          {status.isPending
            ? "Verificando…"
            : status.isError
              ? "Não foi possível verificar"
              : status.data?.googlePlacesConfigured
                ? "Configurado — pronto para consultar"
                : "Aguardando configuração"}
        </li>
        <li>Google Search: integração ainda não implementada</li>
        <li>Instagram: integração ainda não implementada</li>
        <li>Cadastro manual: disponível</li>
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        O administrador precisa habilitar Places API (New) no Google Cloud e configurar a chave no
        servidor. Ter uma conta Google não conecta essa fonte automaticamente.
      </p>
      <a
        className="mt-3 block text-sm underline"
        href="https://console.cloud.google.com/google/maps-apis/overview"
        target="_blank"
        rel="noreferrer"
      >
        Abrir configuração do Google Maps
      </a>
      <button
        type="button"
        className="mt-3 text-sm underline"
        onClick={() => void status.refetch()}
        disabled={status.isFetching}
      >
        Verificar configuração novamente
      </button>
    </PanelCard>
  );
}
