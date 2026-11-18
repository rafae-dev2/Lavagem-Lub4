# v10.25 — Carreta Tanque Vinhaça fora da programação geral de Lavagem/Lubrificação
O grupo **Carreta Tanque Vinhaça** não aparece mais na visualização geral de **Lavagem e Lubrificação**, assim como já ocorria com Carretas Canavieiras, Trator Transbordo, Colhedoras, Carretas Rodomuda e Dolly Canavieiros. O aviso **Controle dos demais equipamentos** passa a listar o grupo entre os ocultos.
O filtro é apenas de exibição: as ordens e programações continuam preservadas na origem, sem exclusão, encerramento ou migração de dados. A ocultação vale para ordens PCM e manuais, abertas ou encerradas, e também para os painéis de integração/histórico PCM que usam a mesma opção de esconder os demais equipamentos.
A alteração é específica ao módulo geral de Lavagem/Lubrificação. A Carreta Tanque Vinhaça continua reconhecida nos menus **Preventivas — Carretas Canavieiras** e **Lubrificação — Carretas Canavieiras** quando a ordem atende aos critérios do serviço.
## Regra aplicada
São reconhecidas as variações reais do Apoio: `Carreta Tanque Vinhaça`, `Carretas Tanque Vinhaça`, `Carreta Tanque de Vinhaça`, maiúsculas/minúsculas, acentuação da fonte e o nome compacto `CarretaTanqueVinhaça`. O par tanque + vinhaça é obrigatório, portanto **Caminhão Pipa**, tanques de água e demais grupos continuam visíveis.
## Publicação
Publique no Netlify todo o conteúdo do ZIP compilado da **v10.25**, com `index.html` na raiz; depois, faça uma recarga forçada e confirme `v10.25` no menu lateral. A criação do ZIP não atualiza o site automaticamente.
## Verificação
`npm run test:escopo-lavagem` confirma que a Carreta Tanque Vinhaça some da projeção geral em ordens PCM ou manuais, abertas ou encerradas, nas variações de singular, plural, "de" e nome compacto, e que o aviso de escopo lista o grupo. `node tests/maintenanceTracking.test.mjs` confirma que Preventivas e Lubrificação — Carretas Canavieiras continuam reconhecendo a Carreta Tanque Vinhaça. `npm run check` e `npm run build` passaram.
