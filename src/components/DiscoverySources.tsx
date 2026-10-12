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
          OpenStreetMap:{" "}
          {status.isPending
            ? "Verificando…"
            : status.isError
              ? "Não foi possível verificar"
              : status.data?.freeSource
                ? "Disponivel sem chave ou pagamento"
                : "Aguardando configuração"}
        </li>
        <li>Google Maps / Places: desativado para evitar custos</li>
        <li>Google Search: integração ainda não implementada</li>
        <li>Instagram: integração ainda não implementada</li>
        <li>Cadastro manual: disponível</li>
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        A busca utiliza dados publicos colaborativos. A cobertura varia por cidade; avaliacoes do
        Google e seguidores nao fazem parte desta fonte. O servico gratuito pode ficar
        temporariamente ocupado.
      </p>
      <a
        className="mt-3 block text-sm underline"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        Dados: contribuidores do OpenStreetMap (ODbL)
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
