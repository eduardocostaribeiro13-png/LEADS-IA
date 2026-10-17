# Busca diária

O workflow `Daily lead hunting` executa no GitHub, independentemente do navegador e do servidor Render. Usa Node 24, OpenStreetMap e Supabase. Não exige Google Cloud, API paga ou cobrança de IA.

## Ativação

1. Aplicar `drizzle/migrations/0001_daily_hunting.sql` no Supabase.
2. Nas **Actions secrets** do repositório, configurar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. A segunda é uma credencial administrativa: nunca colocar no código, em variável `VITE_*`, logs, frontend ou MCP. Somente mantenedores confiáveis devem poder alterar o workflow que recebe esse segredo. O worker precisa desse acesso para atender contas que habilitaram a busca sem depender de sessão aberta.
3. Publicar a aplicação. Em Configurações > Busca diária automática, salvar cidade, estado, segmento e ativar a busca.
4. Executar o workflow manualmente na aba Actions e confirmar o histórico no site e os registros na lista de leads.

O agendamento ocorre às 12h17 UTC (9h17 Brasília), com recuperações às 13h17 e 14h17 UTC. Sucessos, inclusive resultados vazios, não repetem no mesmo dia. Falhas podem tentar novamente até três vezes. Execuções interrompidas podem ser retomadas depois de 40 minutos. O workflow tem limite de 30 minutos e concorrência única. Para mais usuários, será necessário dividir o processamento em lotes e revisar limites da fonte.

## Integridade e limites

- RLS isola configurações e histórico por conta. O histórico só pode ser escrito pelo worker. A função de reserva só é executável por `service_role`.
- Índice único `(user_id, source, external_id)` impede duplicações. A gravação ignora duplicados sem sobrescrever anotações, status ou qualificação existentes.
- A pontuação usa apenas os dados encontrados. Telefone e website são opcionais; ausência não prova que a empresa não tem site. O link da fonte e a atribuição ficam nas notas.
- A consulta é limitada a 200 empresas num raio de 10 km. Em cada dia são escolhidas até 10 ou 20 ainda não cadastradas; não há garantia de novas empresas quando esse conjunto se esgota. A cidade salva é o filtro de busca; confirme o endereço da empresa, pois o raio pode incluir cidades vizinhas.
- Consultas sequenciais com pausa de 6 segundos. O worker mantém cache durante a execução; a fonte pública não oferece SLA. Não usar para varredura indiscriminada de regiões.
- GitHub pode atrasar ou descartar execuções agendadas em períodos de carga. Em repositórios públicos, desativa agendamentos após 60 dias sem atividade. Verificar Actions e reativar quando necessário: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
- A gratuidade do GitHub Actions depende de runners padrão em repositório público. O projeto Supabase continua sujeito aos limites do plano gratuito.

## Verificação

`npm test`, `npm run typecheck`, `npm run build` e lint nos arquivos alterados. Os testes cobrem pontuação, repetição no dia, falhas de leitura/gravação, pausa durante execução e retorno vazio. Para validar isolamento no banco, usar duas contas e conferir que nenhuma consegue ler ou alterar configurações/histórico da outra, nem executar `claim_daily_hunt`.
