# Correção de encerradas e conexão — v10.2

## Diagnóstico da conexão

O usuário confirmou `https://controlelogisticalub.netlify.app`. A origem já constava no Vault do projeto `qcpnnyqzosnomvvytmfi`; não foi necessária alteração de allowlist, segredo, RLS ou implantação de Edge Function nesta revisão. Site HTTP200, preflight204 com origem permitida e POST200/ok=true. O teste Chromium390px carregou Lubrificação e recebeu HTTP200 na função, sem alerta. O `throttled=true` observado é a proteção normal contra sincronizações concorrentes, não falha.

As capturas mostram outro endereço Netlify. Esse tipo de origem não autorizada recebe403 sem cabeçalho CORS, explicando a mensagem genérica FunctionsFetchError. Não foi autorizado um domínio adivinhado nem liberado wildcard. Para acessar o aplicativo, usar o endereço principal confirmado. O cliente v10.2 explica falha de conexão/autorização em português sem ocultar problemas reais.

## Encerramento e visibilidade

Apoio e os novos acompanhamentos compartilham `getMaintenanceOrderClosure`, que deriva situação operacional pela mesma evidência de saída da fonte usada pela integração PCM. Status bruto e execução manual permanecem separados. A falta de prova não se transforma em encerramento e o reaparecimento reabre. Não foram alteradas ordens reais durante os testes de estados.

Os novos módulos reutilizam `scheduleVisibility` e o corte07:10Brasília, não uma cópia de política. A preferência é compartilhada com Lavagem. Encerradas anteriores ao corte ficam ocultas; recentes continuam visíveis; sem data de detecção não se usa entrada/previsão como conclusão. Botão Mostrar encerradas e aba Encerrado permitem acesso a todas, com seleção e informação de visibilidade nos relatórios. Ao mostrar o arquivo pelo botão, um filtro de atraso incompatível é removido.

Os cartões/tabela dos novos módulos apresentam faixa ENCERRADA, motivo/origem, detecção, última presença e ausência de alerta de prazo. ControleApoio tem botão externo de encerradas, histórico de ausências sem prova separado das encerradas, KPIs e relatórios com status operacional e bruto preservado.

Dashboard, Programações, Calendário e Exportação têm controle global de visibilidade no cabeçalho. Calendário e Exportação usam a mesma seleção operacional. A TV exclui status explicitamente encerrado na fonte. O botão de atualização do cabeçalho do Controle Apoio foi conectado ao refresh correto.

## Evidências

`npm run check`, `npm run test:encerradas`, `npm run test:acompanhamento` e `npm run test:sql` passaram. Testes de encerradas cobrem corte antes/exato07:10, recentes, datas ausentes, preferência manual/reset, reabertura, origem explícita, prova inválida, filtros operacionais e erro de rede/CORS. PDF10páginas/Excel76ordens preservam seleção integral, cabeçalhos, textos longos e proteção de texto.

As revisões delegadas validaram54cenários dos novos módulos (3módulos×3temas×6larguras,320–1920px) e8combinações responsivas do ControleApoio com dados sintéticos. Testes de interação do arquivo complementam a evidência. `npm audit --omit=dev` registrou zero vulnerabilidades conhecidas. Isso não equivale a garantia de segurança absoluta.

## Limites

Esta revisão não publica automaticamente o compilado no Netlify. O site verificado ainda servia os assets da v10.1; é necessário publicar o compilado v10.2 para receber novos botões/cards/regras de visibilidade. Não reexecutar SQLs antigos. As permissões públicas legadas continuam sendo pendência de autenticação/perfis, detalhada na auditoria anterior incluída nas fontes.
