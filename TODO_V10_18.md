# v10.18 — Planos LUB

- [x] Reconhecer códigos numéricos de plano com sufixo LUB, inclusive20.004LUB, sem whitelist de números.
- [x] Não confundir setor Lubrificação ou ponto Lub Lavador com código de plano; não classificar preventiva genérica sem LUB como óleo.
- [x] Aplicar no Supabase e confirmar OS159330818/6597; preservar lavagem semanal separada e OS4585/4626 de óleo.
- [x] Preservar overrides, encerramentos, datas e demais recursos; validar testes e entregar versão completa.

Resultado real: quatro OS conferidas no Supabase; óleo 6597/159330818 importado, lavagem semanal 6597/159333053 preservada, 4585 e4626 continuam óleo; sem duplicação. Migração aplicada e build concluído. Regra geral evita futuras listas de códigos.
