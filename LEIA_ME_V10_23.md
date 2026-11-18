# v10.23 — Equipamentos especiais nas Carretas Canavieiras

As telas **Preventivas — Carretas Canavieiras** e **Lubrificação — Carretas Canavieiras** agora reconhecem também as descrições **Carreta tanque Vinhaça** e **Dolly Canavieiros** em Grupo/Modelo da ordem ou no cadastro próprio. A identificação ignora acentos e diferenças de caixa. Os critérios de serviço continuam os mesmos: uma preventiva precisa ser explicitamente identificada como preventiva e uma lubrificação precisa conter sinal de lubrificação.

Carretas-tanque genéricas e Dolly sem identificação canavieira continuam fora do escopo para evitar inclusão indevida.

## Publicação

Publique no Netlify todo o conteúdo do ZIP compilado da **v10.23**, deixando `index.html` na raiz. Faça uma recarga forçada e confirme `v10.23` no menu lateral. O site não é atualizado automaticamente ao gerar o ZIP.

Não é necessária migração do Supabase nem edição dos cadastros existentes.

## Verificação

A suíte `npm run test:acompanhamento` valida os dois equipamentos nos módulos Preventivas e Lubrificação, confirma que equipamentos genéricos permanecem fora e executa os testes de ciclo de vida, interface, relatórios e contrato da fonte.
