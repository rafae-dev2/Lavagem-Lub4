# Controle de Equipamentos — Apoio

Evoluir o projeto React/Vite fornecido, preservando a seção incorporada Gestão de Ordens Manutenção como primeiro menu e adicionando Controle de Equipamentos — Apoio como segundo menu. Reutilizar o logotipo, os temas, a identidade visual industrial e as bibliotecas PDF existentes.

A fonte pública consultada é https://ti.usinabrancoperes.com.br/ordens-pims/dados/ordens.json. Os campos disponíveis incluem OS, equipamento/frota, modelo, origem, prestador, status, entrada, previsão e narrativa. A leitura foi verificada; não há liberação CORS para outros domínios. A interface do site usa atualização a cada cinco minutos, mas a nova integração deve consultar a fonte a cada minuto, sem prometer que ela produzirá um novo conjunto de dados a cada consulta.

## Estrutura

`src/types/apoio.ts` define o contrato. `src/lib/apoioService.ts` fornece acesso público compartilhado ao Supabase. `src/lib/apoioReport.ts` gera PDF corporativo e planilha filtrados. `src/pages/ControleApoio.tsx` contém acesso, cadastro dos grupos Apoio e frotas, painel e filtros. `supabase/functions/sync-ordens/index.ts` consulta a fonte no servidor. `supabase/APOIO_SETUP.sql` cria tabelas, políticas seguras, função de aplicação transacional dos snapshots e instruções de agendamento de um minuto.

Grupos e classificação das frotas são compartilhados. Somente frotas cadastradas entram no controle próprio. As demais ordens ficam em uma visão para classificação, nunca são automaticamente assumidas como equipamentos próprios. Conforme solicitação explícita do usuário, a nova seção é pública, sem login: visitantes consultam e editam grupos e frotas. As políticas do banco permitem somente leitura das ordens importadas; a chave de serviço permanece no servidor. O acesso da nova seção não altera os módulos antigos.

Ordens preservam os status Programada, Andamento e Aguardando Peça e a origem. Oficina significa Oficina Interna; Terceiro significa Oficina Externa; Campo continua Campo. Origem desconhecida não deve virar oficina por padrão. Prestador é exibido como o nome da oficina externa quando informado, e falta de nome deve ser explícita.

Os registros são carregados por um RPC somente leitura em uma fotografia consistente, sem truncar ou duplicar linhas por paginação concorrente. A consulta ao servidor possui lease e token para que uma falha de consulta antiga não sobrescreva uma sincronização nova.

A lista de abertas segue o último snapshot completo, válido, cronologicamente mais recente e não excessivamente atrasado. O desaparecimento da fonte gera histórico de Não consta mais na fonte, não prova de encerramento nem data de finalização. Uma falha, resposta truncada, inconsistente ou desatualizada não pode remover ordens. Cada ordem usa chave estável frota + OS, e reaparecimento reativa a mesma ordem.

O relatório PDF usa o logotipo local, cabeçalho robusto, resumo quantitativo, filtros, data da fonte, agrupamento Apoio e oficina, status, narrativa e paginação. Relatórios se baseiam exatamente nas ordens filtradas, não apenas na página visível. Datas inconsistentes são sinalizadas e não geram dias negativos.

## Instalação

A implementação será entregue como código-fonte e dist compilado. A integração compartilhada depende de executar SQL, publicar a Edge Function e instalar o agendamento no Supabase existente. Nenhuma implantação remota será alegada sem acesso e confirmação. A sincronização de minuto em minuto pertence ao agendador nativo do Supabase, não ao sandbox de desenvolvimento.

## Automação PCM — Lavagem e Lubrificação

Usar o agendamento Supabase existente, com consulta de minuto em minuto, filtrando obrigatoriamente pelos números de frota cadastrados no Apoio. Identidade frota+OS impede duplicação e mantém lavagem e troca de óleo separadas. Entrada e horário do PCM serão a programação, conforme exemplos autorizados:4508/159329765 lavagem01/11;4508/159330811 ponto99 plano604LUB/604/302 trocaóleo04/11;4588/159331192 lavagem04/11.

Preservar motivo, classe e cdPonto da fonte. Classificação por ponto/setor e serviço explícito ou plano autorizado; preventivas desconhecidas vão à revisão, não são automaticamente troca de óleo. Exceções têm classificação/exclusão por OS. Estrutura: supabase/PCM_AUTOMACAO.sql reconcilia programações e histórico; src/lib/pcmService.ts e src/components/PCMIntegrationPanel.tsx mostram revisão e estado compartilhados; serviço/hook e Programacoes exibem origem,OS,Apoio,semana e bloqueiam alteração acidental das ordens do PCM.

A reconciliação roda no servidor após dados completos válidos e em mudanças no cadastro/classificação. Inicialmente importar somente abertas. Ausência encerra ordens previamente importadas, conservando timestamp de detecção separado da execução desconhecida; reaparecimento reativa. Fonte antiga/truncada/falha não encerra. Remover frota do Apoio suspende visibilidade automática, sem apagar histórico ou afirmar execução. Preservar todos lançamentos manuais sem fusão por aproximação. Carregar todos registros por RPC consistente, evitando truncamento de1000. Estilos e geradores das exportações atuais permanecem preservados; novos metadados são opcionais no contrato Programacao.

Instalar e verificar no Supabase autorizado; entregar novo ZIP compilado para o mesmo Netlify sem alegar publicação da interface. Relatórios premium do Apoio continuam com verde/blur e sem Fonte.

## Exportação diária — atualização de04/11/2026

Lavagem/Lubrificação exporta obrigatoriamente todo o backlog ATRASADO mais PROGRAMADOS do dia atual00:00 até06:00 inclusive do dia seguinte, pelo fusoAmerica/Sao_Paulo. src/lib/dailyExport.ts determina a janela, normaliza PROGRAMADO passado somente no arquivo e calcula os mesmos contadores para PDF e PNG. A tela mantém grupo/serviço/origem, sem filtros concorrentes de semana/status/período. Recalcula no clique e impede baixar imagem do dia anterior. Visual e geradores existentes são preservados; nenhuma migração Supabase é necessária.

## Histórico PCM e organização

Supabase conserva encerradas e fornece carregar_pcm_historico. Data real de execução exige confirmação explícita por registrar_execucao_pcm, separada da detecção. Manuais ativos equivalentes a automáticos são arquivados por metadados, nunca apagados. Programacoes e exportação abrem em origemPCM; scheduleOrder fornece ordenação cronológica compartilhada pelo controle e dailyExport, preservando o corte das06:00. Metadados novos usam cachev4, atualizado no evento de confirmação.

## Padronização visual do Apoio — 04/11/2026
Reutilizar a identidade real da Gestão de Ordens em https://ti.usinabrancoperes.com.br/ordens-pims/: verde #1F6B45, títulos #14482F, fundo #F5F9F6, cartões brancos, indicadores com borda verde e ordens com borda lateral por dias observados. Logotipo original no cabeçalho da página. Preservar integração, cadastros, paginação, filtros e arquivos de relatório. Componente src/components/ApoioOrderCard.tsx separa apresentação da ordem; src/styles/apoio.css tem escopo local e modo escuro legível. Tema claro e cabeçalho compartilhado recebem variáveis próprias em src/styles/shell-theme.css. Entrega de fontes e dist, sem implantação remota nem alterações Supabase.

## Lavagem/Lubrificação premium — 04/11/2026
Nova regra solicitada: tratar o desaparecimento no snapshot válido da Gestão de Ordens como encerramento operacional e mostrar em Data realizada o dia de detecção no fuso America/Sao_Paulo, conservando a origem automática da data e a rastreabilidade, sem apresentá-la como confirmação humana. Ocultar a frase técnica de ausência da listagem, não eliminar o histórico. Liberar edição dos campos operacionais das ordens PCM a qualquer momento por RPC auditado e overrides por campo que persistem na sincronização; preservar identidade da OS/frota e bloqueio de exclusão automática. Status da fonte em transição/reaparecimento/ausência prevalece sobre ajustes locais de status. Datas confirmadas/editadas têm precedência. Interface premium com cabeçalho verde/logotipo, resumo operacional com contagens, filtros em painéis, tabela legível e coluna de edição fixa. Estrutura: Programacoes.tsx e styles/lubrificacao.css para apresentação; lib/schedulePresentation.ts para limpeza visual/data; sheetsService/useSchedules para persistência; supabase/PCM_EDICAO_PREMIUM.sql para migração incremental. Entrega arquivos sem publicação nem execução remota do SQL.

## Correção do relatório Lavagem/Lubrificação — 04/11/2026
Exportar Relatório recebe a lista completa de programações, independente de Ocultar Encerradas. Modo Completo passa a ser o padrão e contempla todas as situações, inclusive ENCERRADO e ANDAMENTO, com filtro explícito de situação e mantendo serviço, origem e grupo Apoio. O modo Diário mantém a regra operacional anterior de atrasados e programados até as 06:00 do dia seguinte. PDF, PNG e resumo compartilham uma única seleção e os mesmos contadores. A correção é no frontend e não exige migração SQL nem alteração de dados do banco.

## Janela operacional e virada 07:10 — 05/11/2026
Substitui o Completo padrão: relatório operacional obrigatório, sem exportar programações de todos os dias. Antes de 07:10 Brasília: atrasadas anteriores e andamento aberto, programação de hoje e amanhã até 07:10; encerradas apenas da janela operacional ainda vigente. A partir de 07:10: excluir ENCERRADO do relatório, manter ATRASADO/PROGRAMADO/ANDAMENTO, com programação futura até amanhã 07:00 inclusive. Programados anteriores viram ATRASADO apenas no arquivo; pendentes não entram. Tela de controle continua com todas as datas, ocultação das encerradas de janelas anteriores vira 07:10 com consulta manual preservada. Filtros de origem/serviço/grupo/situação mantidos e PNG/PDF/resumo compartilham a regra; dados não são apagados ou alterados. Arquivos PNG gerados antes da virada não podem ser baixados após a virada sem regeneração.

## Apoio — relatório WhatsApp premium e filtros ocultos — 05/11/2026
Remover descrições dos filtros do PDF e PNG detalhados, preservando rows selecionadas e Excel. Novo relatório independente para cobrança de retorno da manutenção, largura lógica 480px e PNG 2x/3x, cartões verticais de Frota + Oficina real + narrativa da ordem, OS discreta para distinguir ordens da mesma frota. Design editorial verde institucional: cabeçalho com logo existente, fundo claro, grandes números de frota, oficina interna verde e externa petróleo, hierarquia curta para problema e CTA por página pedindo andamento/previsão. Sem KPI denso ou metadados de filtros. Preservar textos completos com continuação identificada e páginas legíveis, sem inventar diagnóstico/resposta. Preview responsivo, download por página e ZIP, compartilhar por ação explícita via Web Share quando suportado; sem envio automático ao WhatsApp. Dados vêm da mesma seleção filtrada do ControleApoio, sem consultas ou mudanças de banco.

## Apoio WhatsApp — imagem única e PDF único — 05/11/2026
Extensão aditiva: manter o modo imagem paginada, filtros ocultos, nome real do prestador externo, preview e compartilhamento. Adicionar Imagem única com todas as ordens da seleção em um PNG vertical de altura natural, sem truncar nem dividir silenciosamente. Para seleções que excedam recursos seguros do navegador, informar limite e orientar PDF ou modo paginado. Adicionar PDF único do resumo WhatsApp com todas as informações em um único arquivo, páginas quando necessário, preservando proporção e legibilidade. Nenhuma alteração no PDF detalhado existente ou na seleção, na lavagem 07:10 ou no banco.

## Apoio — escolha por frota nos grupos e Glassy Dashboard V18 — 05/11/2026
Ao clicar em um grupo Apoio, abrir painel de equipamentos cadastrados com números de frota, pesquisa, todas/nenhuma e quantidade de ordens. A seleção continua multi-grupo: união dos grupos escolhidos e restrição independente de frotas dentro de cada grupo. Ausência de restrição significa todas; seleção vazia explícita significa nenhuma. Mesmos filtros de origem/status/prestador/busca intersectam a seleção; tela e todos os relatórios usam rows, nunca só a página visível. Limpar remove grupos e restrições. Sem gravação de cadastros/ordens/banco.
Design adicional a partir do vídeo fornecido: Glassy Dashboard V18, glassmorphism fumê quente, fundo ambiente taupe/âmbar/creme, painéis escuros translúcidos com blur18-24px e bordas claras finas; acentos pervinca/azul e status esmeralda. Tipografia atual com títulos editoriais de hierarquia semelhante ao quadro. Respeitar navegação e conteúdo próprios do aplicativo em vez de criar dados/gráficos fictícios da referência. Tema novo opcional, não substituir os temas anteriores. Seleção disponível no cabeçalho e persistida pelo ThemeContext. CSS scoped à classe theme-glassy-v18/app-shell, evitando mudança de cores nos relatórios exportados; manter verde premium neles. Seletores celulares grandes e panel maxheight rolável, modais legíveis, reduced-motion respeitado. Fidelidade de estilo/material/cor conforme o vídeo, não promessa de identidade pixel a pixel em conteúdo diferente.

## Apoio — correção do seletor local de frotas — 05/11/2026
A referência do usuário evidencia doze grupos empilhados em uma coluna no celular e a lista de frotas aparecendo distante do ponto clicado. Corrigir com mosaico compacto: duas colunas no celular e mais em telas maiores; nomes quebram linhas sem serem cortados. Expansão inline ancorada à linha do grupo clicado, ocupando toda a largura imediatamente depois dessa linha, sem portal/overlay que perca o tema ou cubra controles. Calcular inserção pela quantidade real de colunas no contêiner; atualizar ao redimensionar. Clique no grupo abre/fecha painel; checkbox independente adiciona/remove filtro. Frotas com seleção acessível e alvo de toque inteiro; sem sobreposição de controles invisíveis e sem duplo disparo. Seleção continua imediata, todas/nenhuma no grupo, pesquisa, fechar/concluir preserva valores. Mantidos contratos de dados e todos os relatórios; não alterar banco. Atualização focada nos componentes/estilos do seletor.


## Revisão Glassy V18 — contraste e movimento (05/11/2026)

Manter React/Vite e Supabase existentes. Entregar ZIP estático para Netlify e ZIP de fontes sem publicar remotamente nem escrever no banco.

Referência fornecida: vidro fumê taupe, bordas luminosas, títulos editoriais e pequenos deslocamentos verticais. CSS adicional em src/styles/glassy-v18-refinements.css para material, contraste, transições de navegação e entrada sequencial dos indicadores. Blur somente no fundo, com suporte WebKit e fallback sólido. Movimento reduzido desliga as animações. Não prometer identidade pixel a pixel entre navegadores.

Corrigir regra genérica text-xs que apaga os badges, usar hooks de status e tokens semânticos. Coluna Ações opaca no desktop e sem sticky até719px. Tokens do cabeçalho sobrepostos diretamente no shell e seletor via portal estilizado fora dele. Testes em tests/glassy-v18-legibility-harness.tsx e tests/glassy-v18-legibility-test.py usam apenas dados fictícios e bloqueiam requisições externas. Relatórios mantêm suas cores próprias.

## Modo TV — emergências do Apoio (05/11/2026)

Monitor gerencial próprio integrado ao menu, sem depender do iframe da Gestão. Reutilizar Apoio/Supabase e cadastro de grupos/frotas. Regra padrão estrita: ativo + frota cadastrada + classe oficial CORRET EMERGENCIAL + status Andamento. Fonte oficial JSON confirmou o campo em 05/11; emergência jamais inferida por narrativa ou motivo.

Design de sala de controle premium: carvão/petróleo escuro, vidro discreto, hierarquia editorial curta, número de frota grande com tabular numerals, sinal vermelho coral exclusivamente para emergência e verde para conexão. Cartões consistentes com OS, categoria, equipamento, responsável/oficina, setor/ponto, motivo, entrada e previsão; texto integral em detalhes. Sem ilustrações decorativas. Os temas globais continuam fora do monitor, cuja paleta própria mantém contraste em TV.

Estrutura: lib/tvOrders.ts seleção/datas/ordenação; hooks/useTVOrders.ts leitura RPC/realtime/fallback; components/TVMonitor.tsx exibição/filtros/persistência/rodízio; styles/tv-monitor.css layout responsivo; pages/ModoTV.tsx ligação ao hook. SQL incremental TV_MONITOR.sql habilita publicação realtime das tabelas existentes, sem mudança de registros. Cron Supabase existente continua consultando fonte, monitor não instala agendamento paralelo.

Filtros multi-categoria, busca frota/OS/narrativa, origem, prestador, setor, motivo e dias; default em andamento/emergencial, expansão de escopo explicitamente identificada. Configuração local por monitor. Apresentação sem shell em portal, fullscreen por ação explícita, paginação automática com pausa/intervalo e quantidade de cartões; navegação não descarta seleção nas atualizações. Avisos de conexão/falha e idade da fonte distinguem recepção em tempo real da atualização efetiva do PIMS. Nenhuma escrita nos dados nos testes.

## Correção de encerradas na exportação — 05/11/2026

O usuário solicita que o relatório de Lavagem/Lubrificação inclua também encerradas. A seleção de exportação não deve herdar a ocultação de tela nem excluir encerradas ao passar de07:10. Preservar a janela operacional de abertas e acrescentar todas as encerradas disponíveis não arquivadas, sem duplicação; aplicar depois os filtros explícitos de situação/tipo/origem/Apoio. PNG, PDF e WhatsApp já compartilham helper. Manter a ocultação de encerradas da Programação/Dashboard e os dados do banco intactos. UI informa que o relatório inclui histórico de encerradas, oferece Encerrado todo horário e não reseta esse filtro. Reutilizar design existente; correção de seleção, sem refazer relatório.

### Retificação explícita do usuário — encerradas do dia desde07:00

O usuário esclareceu: não quer histórico completo; somente ordens encerradas HOJE a partir das07:00. Substitui a decisão anterior sobre todas as encerradas. Seleção fechada:[hoje07:00 Brasília,agora], usando referência de encerramento do módulo (PCM:timestamp oficial de detecção; manual legado:data realizada+horário registrado). Excluir dias anteriores,antes07:00,instantes futuros,arquivadas e PCM sem referência; não inventar data de encerramento a partir da programação antiga PCM. Limite07:00 inclusive. Antes07:00 nenhum encerramento futuro é antecipado. Corte07:10 de visualização não se aplica a esta seleção. Abertas e demais filtros permanecem iguais. UI explica a limitação de horário de manuais legados.

## Modo TV — Emergências/Externas e tema claro (05/11/2026)

Segundo menu e acesso direto #modo-tv-externas, reutilizando monitor, leitura Supabase e Realtime. Painel externo: exclusivamente oficinas externas, ordens abertas de todas as classes e frotas cadastradas exatamente no Apoio. Perfis de filtros independentes para emergências/externas. Alternância automática padrão12s em apresentação TV/tela cheia, configurável5–60s, pausa em filtros/detalhes; a cada troca avança a página do painel que saiu, para visitar todas as ordens sem monopolizar uma lista. Fora de apresentação permanece o rodízio de páginas existente. Preferências persistidas e migração de configuração anterior. Densidade auto6/8/12cards conforme seleção e viewport, opção manual. Tema claro perolado de alto contraste e escuro atual, inclusive portais/modal. Nenhuma mudança de dados/permissões/cron Supabase. Manter exportação de encerradas do dia desde07:00. CSS e seleção/menu em responsabilidades independentes.

Revisão final: quantidades escolhidas na versão anterior são preservadas; novos perfis usam Automático. Usuário pode ativar Automático nos filtros. Corrigida a interpretação de previsão só com data: hoje não é vencido à meia-noite; datas sem horário não exibem horário fictício. Medição de densidade12 confirma narrativa de uma linha e botão de detalhes dentro do card. Menus testados com Layout/TVMonitor reais e dados isolados; validação estática confirma hash/case App.

## Correção robusta dos cards e redimensionamento (05/11/2026 à noite)

A captura1236x629 mostra rodapé atravessando a primeira linha e cards excedendo a largura. As regras anteriores de altura flex/grid só protegiam TVs comaltura>=800 e acumulavam muitos overrides. Substituir por uma fonte de layout: viewport próprio da grade, com flex min-height0 e rolagem contida na apresentação; cabeçalho e paginação não encolhem e nunca entram na grade. Modo normal usa fluxo natural, sem altura mínima800 ou tracks flexíveis que derrubem o footer.

ResizeObserver mede a largura/altura reais do viewport da grade (inclui sidebar, barras do navegador, janela e visualViewport). getTVLayout decide colunas, limite de cards por página e densidade segundo esse espaço, inclusive ao escolher12. Paginação percorre todas as ordens e redimensionar remapeia a posição pelo primeiro índice. Fontes e textolongo têm limites por card; frota adapta ao tamanho do número. Tema claro/escuro e aparência premium existentes preservados. Sem nova migração ou operação no Supabase. Fontes e compilado Netlify completos como entrega.

Entrega final: fonte da frota calculada em TypeScript pelo track real, sem dependência de cqi, com guard para ResizeObserver ausente. Matriz de telas, paginação, alternância, menus, âncora de resize e regressões de exportação aprovadas.

## Diagnóstico de sincronização Lavagem/Lubrificação — 06/11/2026

Banco somente leitura: frotas6608/OS159331210 e4626/OS159331208 ausentes no Apoio e ENCERRADO na tabela e RPC, detecção05/11 às23:11 Brasília. Ainda aguardar usuário confirmar se são seus casos. Nenhuma divergência de automática ausente/aberta foi encontrada. Fonte consulta00:20, origem00:10, semerro. Lavagem não está na publicação Realtime (apenas quatro tabelas Apoio). Habilitar só tabela lavagem_lubrificacao, sem tocar dados/RLS. A configuração era insuficiente para atualização instantânea mas não prova atraso prolongado: polling15s já existente. Hook descarta pedidos quando há leitura em andamento e não busca ao recuperar foco/rede/assinatura. Corrigir fila de atualização, limpeza de callbacks/unmount e retomada fresca, preservar merge6s de writes e fallback15s. Testes somente com mocks e assinatura/read público, jamais editar ordens reais durante testes. Entregar diagnóstico e nova compilação; publicação do site atual não disponível/URL ainda não fornecida.

## Apoio premium verde e dourado —06/11/2026
Referência fornecida pelo usuário: marfim com fitas curvas institucionais verde-esmeralda e dourado metálico, cabeçalho verde escuro, molduras douradas, cards brancos com frota em destaque e quadrantes de informação. Aplicação exclusiva a Controle de Equipamentos — Apoio; tema local claro consistente mesmo se tema global for escuro/Glassy. Dados e callbacks de relatórios/cadastro/sincronização preservados. Estilo adaptado a largura real, altura natural; detalhes expansíveis reproduzem uma linha do tempo usando somente fatos reais de entrada, previsão e observações. Não duplicar relógio/sistema do celular nem copiar erros tipográficos da imagem. Diagnóstico gerenciado indisponível porque este projeto é fornecido como ZIP; usar TypeScript e testes locais existentes.

Validação final Apoio premium:8 combinações de viewport/tema,320–1920px, cards opacos também no Glassy, datas Brasília, ações e filtros com mocks. Fonte limpa TypeScript; regressões Apoio/exportação/TV preservadas. Scripts Supabase atuais são somente referência; nenhuma migração ou escrita em produção exigida para o tema.

## Retificação visual explícita — Apoio,06/11 às17:58
Usuário solicita desenho idêntico à referência, sobretudo curvas verdes/douradas no fundo claro. Substituir os anéis pouco visíveis por paths vetoriais contínuos em fundo marfim no canvas inteiro do módulo e margens do main. Hero verde com recorte ondulado dourado. Cards centrados com proporção da referência; todos controles/relatórios/cadastros/indicadores preservados em painéis nativos expansíveis, evitando competir com o layout dos cards. Dados seguem reais e responsivos; não prometer equivalência pixel-a-pixel entre larguras diferentes.

Revisão entregue: fundo contínuo Bézier sem repetição em mosaico, header ondulado, painéis de controles expansíveis e botão de histórico com narrativa integral.8 combinações de tema/tela passaram com mocks, sem alterações de banco. Paginação e rodapé com superfície opaca para manter contraste sobre faixas verdes. Assets SVG incluídos no compilado para Netlify.

## Apoio multidispositivo e logotipo —06/11 às18:37
Logotipo existente logo.png reativado no hero; grade baseada na largura útil real do módulo:1 coluna até859px,2 a partir de860px e3 a partir de1420px. Container queries respeitam sidebar e cards estreitos ajustam campos e ações sem cortes. Preservar fundo vetorial verde/dourado e correção offline de Modo TV. Testes com dados fictícios em celular/tablet/notebook/desktop, sem alterações do Supabase.

## Lavagem/Lubrificação premium —06/11 às18:54
Mesmo visual verde/dourado/marfim Apoio em Programações,Dashboard,Importar,Exportar: wrapper local compartilhado com logo,fundo ribbons,hero curvo,sync e abas. Mantém tabela/status semânticos, ações, filtros, dados brutos de exportação, janela07h–07h e hook sincronização. Outros módulos não mudam. CSS local independente de tema global; ajuste responde a celular/tablet/desktop, scroller horizontal preservado.

## Apoio recência —06/11 às19:10
Ordenação organizada/recentes/antigas e períodos1h/6h/24h/hoje Brasília/7d/personalizado por entrada ou primeira detecção. Atalhos Programadas+Andamento,Programadas,Andamento. Mesma seleção antes da paginação e relatórios. Última vista nunca é data de criação. Datas inválidas/futuras não entram nos períodos recentes, não inferir status pelo timestamp; estado filtros ativos explicativo, clear reset.

Revisão final recência: clamp de paginação ao variar capacidade de páginas; avisos usam base temporal selecionada no conjunto pré-recência; PDF/imagens preservam ordem global por agrupamento apenas adjacente quando recentes/antigas, organizado mantém comportamento antigo. Testes helper e interface fictícia, filtros/prestador e relatórios existentes aprovados.

## Acompanhamento integrado — 07/11/2026

Modificar as fontes React/TypeScript/Vite enviadas e entregar fontes e compilado para a hospedagem atual; não recriar o aplicativo, publicar remotamente nem alterar dados Supabase/PIMS. Remover as telas e rotas Manutenção Equipamentos, Dashboard Carretas, Programação Carretas, Importar Carretas e Exportar Carretas e interromper suas consultas legadas na aplicação principal. Preservar os demais módulos e todos os temas.

Criar Preventivas Carretas Canavieiras, Lubrificação Carretas Canavieiras e Reformas Equipamentos Apoio usando a fotografia do RPC carregar_apoio_controle e a sincronização existente. Biblioteca maintenanceTracking seleciona equipamentos, serviços, status e filtros; maintenanceTrackingReport exporta todas as ordens selecionadas para PDF A4 paisagem e Excel, com logo, cabeçalho, filtros, resumo, datas e alertas. Hook useMaintenanceTracking coordena atualização e retenção da última fotografia em falha. Página AcompanhamentoManutencao e CSS escopado compõem cards, tabela, indicadores, busca, grupo, local, prestador, período, prazo, ordenação e paginação. App/Layout organizam navegação por contexto.

Direção visual: acabamento industrial premium alinhado ao tema escolhido, superfícies em camadas, bordas sutis, destaque da marca, status textuais e hierarquia de frota/OS/serviço/prazo. Usar logo, tipografia e variáveis do aplicativo. Container queries respondem à largura útil real: grade ampla no computador, duas colunas intermediárias e uma no celular; filtros recolhíveis e controles táteis. Respeitar movimento reduzido. Sem gráficos ou dados fictícios.

Gestão de Ordens é iframe externo: dados vêm da integração existente, não da leitura direta do iframe. Ausência não confirma encerramento. Não inventar periodicidade, percentuais de reforma ou data de execução. Diagnósticos gerenciados indisponíveis para projeto ZIP, usar TypeScript e testes determinísticos locais, mais uma revisão independente somente leitura. Documentar classificação, dependências e instalação.

## Revisão autorizada — 08/11/2026

Substitui a regra anterior: uma ordem já observada no snapshot válido da Gestão de Ordens que deixou de constar em snapshot posterior válido é ENCERRADA operacionalmente. Preservar status bruto, data da detecção, última presença e origem do encerramento, sem inventar execução confirmada. Fotografia inválida, antiga, falha ou perda de cadastro não pode causar encerramento; reaparecimento reabre segundo o status atual. A regra vale nos três acompanhamentos recentes e seus filtros, indicadores e relatórios.

Alinhar o visual dos três módulos ao Controle de Equipamentos — Apoio: mesma identidade premium marfim, faixas curvas verdes/douradas, cabeçalho institucional, cartões brancos opacos com moldura metálica, destaque de frota, quadrantes de informação, narrativa legível e histórico expansível. Preservar tema global e aplicar identidade local tal como o Apoio. Reutilizar os SVGs, logo e paleta existentes, com grade pela largura útil, ações táteis e texto ampliado. Não inventar gráficos/percentuais.

Auditar status/ciclo de vida, leitura/sincronização, classificação, filtros/navegação, relatórios, responsividade/acessibilidade e segurança/permissões; executar testes isolados e verificações de integração somente leitura. Usar fan-out de auditoria após implementação, incorporar defeitos confirmados e registrar limitações. Para Supabase, conectar pela autorização de conta da sessão ou painel do projeto existente; verificar estado real antes de qualquer migração incremental e evitar alterações destrutivas de dados, RLS ou rotinas legadas. Não prometer ausência absoluta de falhas. Entregar nova fonte/compilado e auditoria; implantação remota deve ser distinguida da atualização da interface na hospedagem.

## Correção v10.2 — erro de sincronização e encerradas

As capturas mostram falha de envio à Edge Function apesar da leitura da fotografia compartilhada continuar funcionando. A configuração real do Vault autoriza somente o site antigo e o domínio da usina; o novo domínio Netlify precisa ser confirmado pelo usuário antes de adicioná-lo à allowlist. Não liberar wildcard nem adivinhar domínio quando a transcrição da captura responde 404. Manter os segredos privados e os endereços já autorizados.

Uniformizar Controle Apoio e os três acompanhamentos com a mesma derivação operacional de encerramento da integração PCM: ausência validada, data de detecção separada de execução manual e reabertura no reaparecimento. Reutilizar o utilitário existente de Lavagem/Lubrificação para corte às 07:10 e preferência de ocultação nos novos módulos, sem duplicar a regra. O botão Mostrar encerradas revela todas, inclusive anteriores ao corte; retorno à operação mantém filtros coerentes. Cartões encerrados devem ter faixa explícita, motivo, detecção e última presença, preservando o tema premium e a leitura móvel. Relatórios incluem a seleção efetiva e conservam o status bruto.

### URL confirmado e fechamento do diagnóstico

O usuário confirmou https://controlelogisticalub.netlify.app, já autorizado. SiteHTTP200, preflight204 e POST200/ok=true; teste em Chromium390px recebeu200 semalerta. Não alterar allowlist nem segredos: domínio diferente dascapturas não deve serusado. Correção deinterfacev10.2 exigepublicação separada.

## Evolução v10.3 — tabela Apoio, cartões compactos e reformas especializadas

Manter o tema premium e a arquitetura atual. Controle Apoio terá barra de pesquisa sempre visível por frota/OS/narrativa e escolha Cartões/Tabela, usando a mesma seleção para relatórios, detalhes e encerradas. Compactar cartões operacionais, espaçamentos, ícones e títulos, preservando legibilidade, áreas de toque e informação completa nos detalhes; monitor TV mantém escala apropriada ao uso à distância.

Criar quatro controles separados por categoria: reformas-rodomuda, reformas-colhedoras, reformas-trator-transbordo, reformas-trator-reboque. Reutilizar AcompanhamentoManutencao, maintenanceTracking, manutençãoVisibility, serviço Supabase e relatórios, sem criar fontes de dados paralelas. Expandir contratos de módulo e metadados, adicionar rotas reais e seção Reformas por equipamento no menu. A classificação usa as frotas conhecidas de Rodomuda/Colhedoras e identificação explícita de equipamento/cadastro; uma menção na narrativa não identifica o tipo de equipamento, e a lista Trator Geral não será arbitrariamente dividida. Onde a fonte não diferencia transbordo de reboque, o cadastro compartilhado permite especificar o grupo de frota.

Fontes continuam em src/lib (classificação/visibilidade/relatórios), src/pages (telas integradas), src/components (cartões/tabela), src/styles (compactação e responsividade), public/manus-routes.json (rotas). Preservar encerramento por ausência validada e corte07:10, filtros/estatísticas/cartões/tabela/relatórios PDF e Excel, sincronização, cabeçalhos e estado bruto. Entregar nova versão em fontes/compilado com regras e limitações documentadas; publicação Netlify é etapa separada.

### Fechamento v10.3

A revisão read-only confirmou integração e encontrou a região de tabela sem foco/label; corrigida localmente. Validações visuais aprovaram126cenários de sete módulos e7Apoio; inspeção também corrigiu contraste ativo e opacidade da tabela. Todos módulos compartilham fonte e regras; nenhuma configuração Supabase nova foi necessária. Entrega em fontes/compilado10.3; não publicada automaticamente.

## Visibilidade v10.4 — Lavagem/Lubrificação dos demais equipamentos

Adicionar helper puro em src/lib/lavagemEquipmentScope.ts, aplicado no limite do conjunto de Lavagem em App, sem filtrar useSchedules nem alterar dados compartilhados do banco. Os quatro grupos ocultos são Carretas Canavieiras, Trator Transbordo, Colhedoras e Carretas Rodomuda. Nome de grupo do cadastro/metadata tem prioridade e os mapas conhecidos exatos complementam registros legados sem grupo; Trator Geral não equivale a Transbordo e Trator Reboque permanece visível. Reusar a seleção em Programacoes, Dashboard/alertas, calendário, Exportar e revisão/histórico PCM de Lavagem. A camada de ocultação de encerradas continua independente, portanto Mostrar encerradas não desfaz a exclusão dos grupos. Não aplicar a regra aos módulos específicos, Apoio, Gestão ou TV. Sem SQL/DML/migração.

## Central Gerencial v10.5 — BI premium de todos os equipamentos

Reutilizar a consulta de ordens/manutenção e o tema de marca em uma central clara própria, sem filtro de ocultação de Lavagem. Fonte/cadastro e não cadastrados, ordens abertas/fechadas, histórico de observação atual e dados de qualidade alimentam indicadores, oito gráficos cruzados, filtros gerenciais e uma tabela pesquisável/ordenável/paginada. Contrato CENTRAL_GERENCIAL_SPEC.md coordena analytics, gráficos, relatórios e a página. Visuais seguem BI corporativo: gelo/branco, verde da marca, ouro discreto, hierarquia compacta de fontes/indicadores/análises/explorer, sem ilustrações decorativas nem hero de altura exagerada. Modo claro é escopado à central e não troca o tema dos outros módulos.

Espera real até início do reparo não está na fonte: a métrica apresentada será idade da fila desde a Entrada, com médias, mediana/P90 e denominadores válidos; ciclo encerrado é observado, não MTTR/reparo executado. Datas inconsistentes não são convertidas em zero e encerramento por ausência deve manter sua evidência. Gráficos mostram carteira por grupo, situação, histograma de fila, dispersão fila/volume, entradas/saídas detectadas90dias, Pareto, oficinas/pontos e matriz de idades. Click gera os mesmos filtros de todos gráficos/KPIs/tabela/relatórios; presets e validação de período/idade impedem consultas inválidas. Exportações PDF/Excel com cabeçalho/filtros/emissão/metodologia/alerta e todas ordens selecionadas, não só página.

Estrutura: managementAnalytics.ts (domínio), ManagementCharts.tsx/CSS (visualização), managementReport.ts (relatórios), CentralGerencial.tsx (estado/filtros/explorer), CSS da central, rota/menu/manifesto. Preservar layout multidispositivo e os demais módulos; nenhuma migração ou gravação de ordem nova no Supabase. Validar os contratos em testes isolados, uma revisão read-only e dados de teste claramente identificados, sem escrever no banco de produção.

## Refinamento v10.6 — cartões Apoio e modo claro padrão

Preservar a Central Gerencial v10.5 e todos os módulos/dados. No Controle Apoio, substituir o excesso de dourado ornamental dos cartões por fundo do tema, borda fina neutra e sombra leve; eliminar pseudo-elementos/ombra lateral metálica, separar frota/idade da linha de badges, equilibrar espaços e tipografia, suavizar campos/narrativa e manter encerradas evidentes por sinal verde discreto. Acrescentar camada CSS exclusivamente escopada aos cartões Apoio, sem alterar tabela, filtros, fonte ou encerramentos. Reutilizar o layout e assets da marca.

Modo Claro passa a padrão do aplicativo: primeira abertura v10.6 migra a preferência antiga uma única vez para light, mantendo outros temas disponíveis e permitindo que a escolha manual posterior persista. Falhas de armazenamento ou valor inválido usam light. Contexto/flags e classes do DOM devem refletir o modo claro. Validar as regressões de cartões/tabela, encerradas e escolha de tema; produzir nova fonte/compilado com instruções de publicação, sem alteração SQL.

## Revisão v10.7 — desempenho, Apoio e menu

Central Gerencial: investigar custo de normalização temporal/modelos e re-renderização dos oito gráficos, pois o hook atual sincroniza e recalcula mais de uma vez a cada minuto. Adotar leitura inicial/automática da fotografia compartilhada a cada cinco minutos para a central, com sincronização manual preservada e cadência respeitada ao recuperar visibilidade; não alterar o cron do Supabase. Reduzir recomposição/formatadores/animações quando comprovadamente desnecessários. Fonte, métricas, alertas e exportações continuam completos e coerentes.

Controle Apoio: cartões com largura útil contida e acabamento verde premium, borda vermelha condicionada à previsão vencida da ordem aberta (não à idade em dias); encerradas não recebem atraso. Refinar tabela e filtros com multisseleção pesquisável, seleção/desseleção e resumo removível, preservando controle próprio, escolha de frotas nos grupos, recência, ordenação, relatórios e detalhes. Reutilizar código do projeto, mantendo escopo CSS local.

Navegação: Rotina de Frotas vem após Operação & Manutenção, antes das reformas. Títulos de todas as seções usam peso/contraste/superfície próprios e destaque da seção atual. Demais módulos, modo Claro padrão e assets da marca permanecem. Não modificar registros, credenciais, SQL ou hospedagem; entregar fontes e compilado completos.

## Retificação v10.8 — Apoio com o visual de Reformas

Substitui a direção de cartões/tabela v10.7 para Controle Apoio: reutilizar MaintenanceOrderCard e estilos maintenance-tracking/maintenance-premium/operational-compact, sem duplicar um desenho semelhante. Mesmo cabeçalho, cores, quadrantes, badges, tipografia, densidade da grade, filtros e barra de resultados de Reformas Equipamentos Apoio. Adaptar somente dados próprios do Apoio e preservar suas funções/cadastros/relatórios; alteração de grupo permanece acessível nos detalhes para não aumentar a altura fechada do cartão. Não filtrar Apoio por classe Reforma.

Remover classes de referência antigas que impõem largura própria ou margem negativa em Apoio. Layout aplica a mesma margem externa de conteúdo de Reformas; grade e controles seguem a largura útil do módulo e não encostam no menu. Não mudar o desenho da referência nem outros módulos, fonte, encerramentos, cadência Central ou Supabase. Entregar fontes/compilado10.8 com prévia usando fixtures locais.

## v10.9 — interação dos cartões inspirada no vídeo

Aplicar ao componente compartilhado de cartões (Controle Apoio e acompanhamentos) inclinação 3D acompanhando o cursor, elevação/escala discretas, reflexo radial e sombra suave. Preservar o desenho de Reformas em repouso, fundo branco e leitura, marcas de atraso/encerramento, filtros e dados. Não tornar a superfície transparente como na demonstração, pois o painel operacional precisa de contraste estável. Usar requestAnimationFrame e variáveis CSS locais, sem atualizações React por movimento. Desativar em touch/reduced-motion; suspender inclinação sobre controles, restaurar posição ao sair/rolar/perder foco e limpar callbacks. Não alterar tabela, navegação, Supabase ou publicação Netlify. Entregar fontes e compilado10.9.

Retificação v10.9 após conferência dos quadros e confirmação expressa do usuário: a referência é Glassy Sidebar, não efeito 3D dos cartões. A proposta de inclinação dos cartões foi cancelada antes de alterar esse componente. Implementar exclusivamente trilho compacto no desktop com ponteiro fino, expansão por hover/foco, ícones destacados e submenu flutuante dos módulos da mesma seção. Reservar largura estável no Layout para evitar recompor gráficos durante animação. Celular/tablet por toque mantêm drawer existente. Cartões10.8 intactos. Não alterar Supabase nem publicar. Entregar fontes/compilado10.9 e prévia da barra.

## v10.10 — imagens ilustrativas por tipo de equipamento

Usar as 13 imagens fornecidas, convertidas para PNG com transparência preservada e nomes estáveis, sem recortar/deformar. Resolver central por identidade estruturada/cadastro e mapa exato de frota; não usar narrativa de serviços para inferir tipo, não inventar imagem de coleta ou equipamento não identificado. Miniaturas ao lado da identificação em cartões, tabelas e consultas dos módulos nativos. PDF/PNG com as mesmas imagens, metadados por tipo em relatórios e Excel com ilustrações incorporadas. Preservar campos, filtros, encerramento e paginação. Imagens são ilustrativas do tipo, não fotos de cada frota. Gestão de Ordens Manutenção é um iframe de site externo; não modificar seu DOM ou afirmar integração interna impossível por origem cruzada. Informar limite e disponibilizar catálogo no aplicativo próprio sem alterar fonte. Manter barra lateral10.9, tema claro e cadência da Central. Nenhuma alteração Supabase; entregar fontes/compilado10.10.

## v10.11 — fundos transparentes, filtros responsivos e imagens editáveis

Auditar as 13 imagens locais, remover fundos reais remanescentes sem mudar o tipo do equipamento; conservar as já transparentes e otimizar arquivos. Corrigir a distribuição dos filtros Apoio (sem colunas altas/estreitas em celular ou modo desktop), mantendo seleção e pesquisa. Lavagem deve permitir tabela real com cabeçalho e rolagem horizontal no celular além dos cartões/quadro.

Adicionar Configurações > Imagens dos grupos: escolher grupo, preparar e comprimir imagem antes do upload, prévia e tamanhos, salvar/substituir/restaurar padrão. Até640px, até180000bytes, PNG/WebP com transparência preservada. Original nunca vai para o banco/Storage; somente objeto otimizado, com metadados leves. SupabaseStoragepublicread, escrita só e-mail autorizado autenticado; preservar consulta pública atual. Identidade por grupo/frota usa imagem personalizada antes da padrão, com cache e atualização por evento em cartões/tabelas/PDF/PNG/Excel. Configuração de autorização depende do e-mail solicitado ao usuário. Não abrir novos uploads anônimos; não alterar permissões dos módulos antigos. Manter rotina/encerramento e cadência existentes. Publicação Netlify permanece manual.

## v10.12 — rolagem de Lavagem / Lubrificação

Investigar o congelamento relatado ao subir/descer a página, preservando layout premium, tabela móvel, cartões, quadro, ações e regras de encerramento. Verificar negociação de gesto touch na tabela, contenção de rolagem, efeitos visuais e listeners/timers que afetem o fluxo. Reproduzir com gestos reais de toque usando o componente da aplicação e dados simulados, sem gravar ordens no Supabase. Aplicar somente correções confirmadas e entregar build/fontes atualizados; publicação Netlify permanece do usuário.

Causas verificadas no código: Programações e o estado global de ocultação de encerradas atualizavam relógios React a cada1segundo, reavaliando seis blocos de cálculos, filtros e toda a tabela mesmo sem alteração de ordens. Substituir ambos por relógio alinhado ao início do minuto, suspenso enquanto oculto, com retomada imediata por foco/visibilidade. O corte07:10 permanece exato por agendamento no início do minuto, e não depende da sincronização. A tabela móvel usa `touch-action: pan-x`, restringindo gestos verticais sobre o contêiner; liberar negociação dos dois eixos sem bloquear as colunas horizontais. O escopo inclui App.tsx apenas para o relógio global que também provocava as renderizações de Lavagem.

## v10.13 — zoom por pinça e tabela compacta padrão no celular

Permitir pinch-zoom no contêiner da tabela de Lavagem, preservando gestos verticais e horizontais corrigidos na v10.12 e sem impor limites artificiais no viewport. No celular, iniciar em tabela com cabeçalho de resumo reduzido, seguindo a referência fornecida; migrar essa configuração uma única vez e depois respeitar escolhas manuais de Cartões/Quadro ou Expandir. Separar preferências móveis das de computador para não alterar a visualização já escolhida no desktop. Detectar celular também em orientação horizontal por ponteiro coarse e largura de tela, sem recompor a preferência durante zoom. Preservar ações, filtros, status, imagens, relógio por minuto e encerramentos. Entregar fontes/build completos para republicação Netlify, sem alterações de banco.

Retificação do usuário às22:06:36: “Modo lista não cabeçalho reduzido”. O ajuste v10.13 é somente lista/tabela padrão no celular e pinch-zoom. Não modificar preferência `bp_prog_compact`, nem ocultar resumo/cabeçalho. A nova chave móvel de modo inicia em tabela sem herdar Cartões/Quadro do computador; escolhas manuais posteriores ficam salvas. A referência é a lista tabular com colunas e ações, sem mudança visual do cabeçalho.

## v10.14 — Tabela padrão em cada abertura móvel

O visual solicitado se chama modo Tabela ou lista tabular. A nova solicitação exige esse padrão sempre que abrir Lavagem no celular em pé/deitado, não só na primeira visita. Ignorar preferências móveis antigas na inicialização e não persistir mudanças móveis de modo, preservando Cartões/Quadro como opções da sessão e a preferência persistida no computador. Não alterar cabeçalho, escala automática, zoom por pinça ou rolagem. Testar com chaves móveis antigas em Cartões/Quadro para garantir reabertura em Tabela; entregar build/fontes para republicação.

## v10.15 — conflito de CSS no retrato do site real

Verificação no site publicado confirmou v10.14 e opção Tabela selecionada, porém `operational-compact.css` contém conversão legada de tabela em grid/cartões abaixo de720px. Seus seletores com `.lavagem-premium .lub-module` e regras importantes sobrepunham os estilos novos. Corrigir os seletores desse bloco e de360px para excluir `.lub-operations-v1011`, preservando a tabela atual e o modo Cartões explícito. A validação precisa incluir o contêiner real `.lavagem-premium`, além de todos os CSS carregados no aplicativo, pois os harnesses simplificados anteriores não reproduziam essa cascata. Confirmar thead visível, células na mesma linha e rolagem/zoom, sem alterar outros módulos, cabeçalho ou banco.


## v10.16 — pesquisa Apoio sempre visível e login de imagens

Mover a busca do Apoio para abaixo dos filtros, fora do painel recolhível, com fixação durante rolagem abaixo do cabeçalho. Preservar query, limpeza e relatórios. Capturas do login mostram fallback localhost:3000 e erro otp_expired: conferir Site URL/Redirect URLs no Supabase, mantendo proteção por e-mail autorizado. Implementar tratamento claro de links expirados e alternativa de confirmação por código de e-mail quando viável, sem remover autorização ou aumentar permissões. Não alterar ordens nem as demais telas.

## v10.17 — Plano 302LUB no Lavador

Corrigir classificação automática após comparação real das OS4585/159332724 e4626/159332726: a segunda já entra pelo trecho604/302; a primeira tem302LUB sem regra conhecida. Adicionar correspondência exata de302LUB no ponto Lavador e sincronizar classificação no servidor, sem criar override manual nem alterar reconciliador/encerramentos. Preservar planos anteriores, frotas ocultas e demais telas.

## v10.18 — Regra geral de plano LUB

Userconfirma OS159330818/6597 (20.004LUB) comoóleo e orienta identificação porLUB. Substituirwhitelist302/604 por código numérico comsufixoLUB noscamposserviço, inclusivenúmeroscomseparadorponto. Planoexplícito prevalece sobre ponto; mero setorLubrificação não classifica. Preservar604/302 legado noLavador, overrides, encerramentos,visibilidadefrotase relatórios.

## v10.19 — Pesquisa Apoio permanentemente ancorada

O usuário informa que a busca ainda se mexe durante a rolagem. Substituir a fixação sticky no fluxo por uma faixa permanente logo abaixo do cabeçalho, fora do main rolável, com espaço próprio no Layout somente do Apoio. Portal React mantém um único campo controlado, foco, pesquisa, limpeza e contagem; nenhum listener de scroll ou cálculo por frame. Filtros e resultados rolam independentemente. Não alterar dados, ordens, encerramentos ou outros módulos.
