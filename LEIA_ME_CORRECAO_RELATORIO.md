# Correção de Exportar Relatório — Lavagem/Lubrificação

## Causa encontrada

A tela Exportar recebia a lista `visibleSchedules`, que já podia ter removido ordens encerradas pela opção Ocultar Encerradas da programação. Em seguida, a seleção diária aceitava somente ATRASADO e PROGRAMADO. Por isso os contadores e os arquivos ficavam sem ENCERRADO e ANDAMENTO, mesmo quando esses registros estavam no controle.

## Correção

A exportação recebe agora a lista completa carregada pelo aplicativo. O filtro visual Ocultar Encerradas continua funcionando na programação e no painel, mas não reduz a entrada do relatório.

O modo **Completo · Todas as situações** é o padrão. Ele não limita a antiguidade nem as datas programadas e admite ATRASADO, PENDENTE, PROGRAMADO, ANDAMENTO e ENCERRADO. O filtro **Situação** permite Todas ou uma situação específica. Os filtros de serviço, origem e grupo Apoio permanecem disponíveis. A origem inicial continua PCM; selecione **Origem: Todas** para incluir também os lançamentos manuais.

O modo **Diário · Atrasados + Programados** preserva a regra anterior da fila operacional: todo o backlog atrasado mais os programados de hoje e de amanhã até as 06:00, inclusive, no fuso America/Sao_Paulo. Nesse modo, encerradas e em andamento não fazem parte da fila; selecione Completo quando desejar esses estados.

PDF, PNG, contadores e resumo compartilham a mesma seleção. A coluna Realizada do PDF e da imagem no tamanho Original passa a exibir a data, em vez de somente um sinal de conclusão. Os tamanhos compactos mantêm sua estrutura anterior de colunas. Textos técnicos de ausência continuam ocultos e registros manuais arquivados não são duplicados no relatório.

## Como usar

Depois de publicar esta versão, abra Lavagem/Lubrificação → Exportar Relatório e mantenha **Abrangência: Completo** e **Situação: Todas**. Para incluir ordens manuais, escolha **Origem: Todas**. Confira os contadores e gere um novo PDF ou PNG; arquivos já baixados anteriormente não são modificados pela atualização.

## Instalação e validação

Publique o conteúdo integral do ZIP compilado na hospedagem atual, substituindo a versão anterior. O ZIP compilado contém `index.html`, recursos e `assets` na raiz. O ZIP de fontes contém o projeto completo para edição e recompilação.

Esta correção é exclusivamente no frontend: **não precisa executar outra migração SQL**. A migração PCM premium aplicada anteriormente continua válida. Nenhum dado do banco foi alterado e nenhuma nova versão foi publicada automaticamente durante esta correção.

Os testes locais verificam a inclusão de todas as situações, filtros, datas e imutabilidade da entrada, além da preservação do modo diário e da interface premium. O build Vite foi concluído. O TypeScript não apresentou novos diagnósticos; permanecem os três diagnósticos preexistentes na tela ManutencaoEquipamentos, que não faz parte desta alteração.
