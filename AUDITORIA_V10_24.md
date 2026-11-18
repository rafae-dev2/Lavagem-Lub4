# Auditoria v10.24 — Escopos separados para Dolly Canavieiros

## Correção

`Dolly Canavieiros` foi incluído nos grupos ocultos da projeção geral de Lavagem/Lubrificação (`lavagemEquipmentScope`). A regra é aplicada às listas geral/manual/PCM que já usavam este helper e não altera nem elimina registros na fonte. O aviso de escopo dessa tela também lista o novo grupo oculto.

A classificação das páginas `preventivas` e `lubrificacao` em `maintenanceTracking` não foi alterada: Dolly segue permitido nesses menus quando a ordem é classificada para o serviço. Carreta tanque Vinhaça continua visível na programação geral, conforme teste positivo.

## Validação

`npm run test:escopo-lavagem` passou cobrindo variações de singular, plural, caixa e nome compacto de Dolly; matrizes PCM/manual e aberto/encerrado; e a permanência de Carreta tanque Vinhaça entre grupos visíveis. `node tests/maintenanceTracking.test.mjs` passou preservando Dolly nos dois menus específicos. `npm run check` passou.

A regra de escopo muda somente a exibição, sem gravação, exclusão ou sincronização de dados.
