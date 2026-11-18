# v10.24 — Dolly fora da programação geral de Lavagem/Lubrificação

O grupo **Dolly Canavieiros** não aparece mais na visualização geral de **Lavagem e Lubrificação**. O filtro é apenas de exibição: as ordens e programações continuam preservadas na origem.

Esta alteração é específica ao módulo geral de Lavagem/Lubrificação. O Dolly continua reconhecido nos menus **Preventivas — Carretas Canavieiras** e **Lubrificação — Carretas Canavieiras** quando a ordem atende aos critérios do serviço. **Carreta tanque Vinhaça** permanece visível na área geral de Lavagem/Lubrificação.

## Publicação

Publique no Netlify todo o conteúdo do ZIP compilado da **v10.24**, com `index.html` na raiz; depois, faça uma recarga forçada e confirme `v10.24` no menu lateral. A criação do ZIP não atualiza o site automaticamente.

Não há exclusão nem migração de dados no Supabase.

## Verificação

`npm run test:escopo-lavagem` verifica que Dolly Canavieiros não aparece em ordens PCM ou manuais, abertas ou encerradas, e que Carreta tanque Vinhaça continua visível. `node tests/maintenanceTracking.test.mjs` confirma que os menus canavieiros específicos continuam reconhecendo Dolly em Preventivas e Lubrificação.
