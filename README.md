# LEADS — Lead Hunter AI

Aplicação React/TypeScript com TanStack Start, Tailwind CSS e Supabase.
O desenvolvimento e o servidor Node funcionam sem o editor ou a hospedagem Lovable.

## Executar localmente

Requisitos: Node.js 22.12+ e npm.

1. Execute `npm ci`.
2. Se ainda não houver configuração, copie `.env.example` para `.env.local` e configure seu Supabase.
3. Execute `npm run dev` e abra `http://localhost:3000`.

As variáveis `VITE_*` são públicas e incorporadas ao navegador durante o build.
Nunca coloque chaves privadas em variáveis com esse prefixo. `.env` e `.env.local` são ignorados pelo Git.
As operações da aplicação e do MCP usam o JWT do usuário e RLS, sem service role.

## Produção Node

```sh
npm run build
npm start
```

O resultado fica em `.output`. `npm start` carrega os arquivos locais de ambiente, quando existem;
em produção, também é possível fornecer as variáveis pelo ambiente do processo.
Configure `PORT` e `HOST` conforme sua hospedagem. Refaça o build ao mudar as variáveis públicas.

## Publicar no Render

O arquivo `render.yaml` configura um serviço Node no plano gratuito, mantendo o banco no Supabase.
É necessário colocar este código em um repositório Git acessível ao Render e conectar a conta de hospedagem.
No painel do Render, crie um Blueprint a partir desse repositório e informe as cinco variáveis Supabase solicitadas,
usando os valores correspondentes do ambiente local. Não envie arquivos `.env` para o repositório.

O endereço público será fornecido pelo Render após a publicação; nenhum domínio está reservado por este arquivo.
Depois de obter o endereço, adicione `/dashboard` e `/auth?recovery=1` nessa origem às URLs permitidas no Supabase Auth.
No plano gratuito, o serviço pode suspender após inatividade e demorar no primeiro acesso seguinte.
Os recursos de IA continuam dependendo da migração e configuração do provedor.

## Autenticação

- E-mail/senha e recuperação de senha usam Supabase Auth.
- Para login Google, habilite o provedor Google no seu Supabase e configure as credenciais OAuth ali.
- Cadastre a origem local e a origem de produção na lista de URLs de redirecionamento do Supabase, incluindo `/dashboard` e `/auth?recovery=1`.
- A rota de consentimento OAuth existente é preservada para não interromper clientes MCP já configurados.

## Validação

```sh
npm test
npm run typecheck
npm run build
```

Os testes usam substitutos locais para autenticação e banco: não enviam e-mails, não consomem IA e não modificam o Supabase.

## Migração e funcionalidades pendentes

- Build, login Google, armazenamento de sessão e tratamento de erros não dependem mais dos serviços do editor Lovable.
- O MCP mantém o SDK `@lovable.dev/mcp-js` como biblioteca local, sem seu plugin de geração de rotas. Os endpoints continuam em `/mcp` e `/.well-known/oauth-protected-resource`.
- O módulo de IA ainda aponta para o gateway antigo, aguardando a escolha de um provedor direto. Sem credenciais, os recursos de IA exibem erro de configuração; não produzem resultados fictícios.
- Google Places, busca e Instagram ainda não estão conectados. O cadastro manual está disponível.
- O banco existente foi preservado. Para outro projeto Supabase, aplique a migração de `drizzle/migrations/0000_lead_hunter_ai_core.sql` antes de usar a aplicação.

## Fonte gratuita ativa: OpenStreetMap

A busca usa Nominatim para localizar a cidade e Overpass para consultar empresas
em até 10 km do centro encontrado (3 km quando um bairro é informado).
Não precisa de chave, cartão ou faturamento. A cobertura é colaborativa, pode
incluir municípios vizinhos e não contém avaliações do Google ou seguidores.
Os resultados têm atribuição e links para OpenStreetMap, sem gravação automática.

O servidor mantém cache limitado de localidades por 24 horas e resultados por
15 minutos, processa uma busca externa por vez e limita a frequência. A configuração
atual pressupõe uma instância do servidor; antes de escalar, use um limitador e
cache compartilhados ou outro provedor. Endpoints podem ser trocados pelo administrador
com `OSM_GEOCODING_URL` e `OSM_OVERPASS_URL`, sem alterar o código.

## Google Maps / Places (inativo)

O fluxo de busca atual não chama o Google, mesmo que exista uma chave no ambiente.
O adaptador está preservado para uma eventual ativação futura autorizada.

A busca usa Places API (New), no servidor e apenas para usuários autenticados.
Habilite essa API em um projeto Google Cloud com faturamento e configure
`GOOGLE_PLACES_API_KEY` no ambiente do Render. Restrinja a chave à Places API (New)
e defina cotas no Google Cloud; não use prefixo `VITE_` para essa chave.
A configuração não prova que a chave é válida: erros de permissão, faturamento
ou cota são apresentados ao executar a consulta.

A primeira versão consulta até 20 empresas por localização e segmento, exibindo
nome, endereço e link para conferência no Google Maps. Não persiste os resultados
automaticamente nem filtra por sinais comerciais que ainda não foram verificados.
Google Search e Instagram ainda não possuem integração.
Antes de ativar a fonte para usuários, publique os termos e a política de privacidade
do seu serviço conforme as políticas do Google Maps Platform.
