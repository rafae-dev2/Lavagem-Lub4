# Auditoria v10.7 — desempenho, Apoio e navegação

## Diagnóstico e correções da Central

A hipótese de sincronismo era parte do problema: a implementação anterior fazia Edge+READ a cada60 segundos e atualizava clock antes e depois do ciclo. A normalização temporal recriava Intl.DateTimeFormat para cada data, além de buscas lineares/varreduras repetidas de ordens, grupos e90 dias. Os gráficos e a página também recebiam renders das atualizações globais de Lavagem em App.

Central agora usa READ inicial/automático em 5 minutos, manual Edge+READ, bloqueio de concorrência, última base válida em falha, retry limitado e limpeza de timers/listeners. Visibility respeita a cadência. Relógio atualiza uma vez por ciclo. Índices/agregações e formatadores reutilizados reduzem trabalho; página e gráficos foram memoizados e animações repetitivas desligadas. Não se alterou App/useSchedules nem o cron do Supabase.

O benchmark sintético de1.000 ordens registrou medianas de780,37ms na referência original equivalente,571,32ms na primeira otimização e60,21ms após reutilizar também o formatador compartilhado da validação temporal. São medições locais de buildBIRows+buildBIModel, não latência do site, nem garantia para todos os dispositivos. A regressão específica valida200 datas UTC/Brasília contra um formatador independente e impede novas instanciações por data, preservando rejeição de calendário inválido.

## Apoio e menu

Filtros permitem OR dentro de origem/status/prestador e AND entre eixos, pesquisa sem dependência de acento, seleção de visíveis, limpeza e chips removíveis. Grupo/frota, recência, encerradas e coleção completa dos relatórios permanecem. Foi corrigida a contagem de Em andamento e unificado o resumo de frotas nos metadados; não se desfaz a ocultação de descrições nos relatórios visuais anteriormente solicitada.

Cartões medidos em até360 px. Borda verde normal e vermelha para previsão vencida de ordem aberta; idade crítica não define atraso. Encerradas nunca recebem a borda/badge de atraso. Tabela usa paleta local opaca verde/neutra, colunas com largura legível, primeira coluna fixa e rolagem interna. A inspeção visual identificou heranças douradas ainda no cabeçalho/células da tabela; corrigidas com regras locais explícitas e nova execução dos testes.

Rotina de Frotas está imediatamente após Operação & Manutenção. As7 seções são contíguas, sem duplicação, com títulos h2, contraste/peso próprios e seção atual destacada. O tema Claro padrão e as preferências posteriores continuam preservados.

## Evidências

Passaram testes de domínio Central/PDF/Excel, hook de atualização automática/manual/concorrência/erro/timers, cache de formatador temporal, filtros/frotas Apoio, tabela, encerradas, tema Claro, menu, reformas e escopo Lavagem. TypeScript e build de produção foram executados. Permanecem os avisos conhecidos de tamanho do bundle/imports PDF/XLSX, sem erro de compilação.

Navegador isolado: Central em 1366/1024/390px com8 KPIs/8 gráficos, pesquisa, filtros cruzados, detalhes, idade inválida, paginação e downloads; menu em 1366/390px; cartões em5 combinações incluindo escolhas manuais de tema; filtros/tabela em 1366/390px com seleção/desseleção, contagens, pesquisa, chips, ausência de overflow e zero gravações. Serviços externos foram bloqueados e fixtures não são importadas pela aplicação de produção.

Uma revisão independente read-only confirmou lógica de previsão date-only, encerradas sem atraso, filtros/coleção de exportação, cadência e menu. O achado de metadado de frota foi ajustado e a versão de package/menu foi alinhada. O risco de dropdown exceder a coluna foi tratado por largura limitada ao campo no desktop e validado em navegador.

## Limites

Esta revisão não promete eliminação absoluta de travamentos ou certificação de segurança. Quantidade real de dados, navegador, dispositivo, rede e disponibilidade de Supabase/fonte influenciam o uso. A central mantém fotografia e metodologia; a fonte não fornece início efetivo do reparo, portanto idade da fila não é espera líquida/MTTR. Publicação Netlify é etapa separada e não foi feita automaticamente. Não houve alteração de ordens/cadastros, credenciais, permissões, SQL ou agendamento servidor.
