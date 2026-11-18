# Revisão de manutenção — 08/11/2026

- [x] Ordens anteriormente presentes e ausentes de snapshot posterior válido devem ser vistas como Encerrado nos três novos módulos, filtros, indicadores e relatórios; preservar encerramento detectado versus execução confirmada, reabrir no reaparecimento e não encerrar por falha/atraso da fonte ou remoção do cadastro.
- [x] Visual dos módulos recentes deve ser igual ou melhor que Controle de Equipamentos — Apoio, reutilizando identidade premium verde/dourado/marfim, fundo de faixas, cabeçalho, cartões, informação organizada e layouts computador/celular/tablet.
- [x] Revisar e auditar status, classificação, sincronização, filtros/navegação, relatórios, segurança e responsividade; corrigir problemas confirmados e entregar evidências e limitações, sem garantir perfeição absoluta.
- [x] Conectar acesso autorizado ao Supabase do projeto existente, inspecionar configuração real e configurar somente mudanças incrementais necessárias; não apagar ordens, recriar projeto ou reduzir segurança existente.
- [x] Entregar código-fonte e compilado revisados, instruções e auditoria; informar separadamente o que foi realmente aplicado no Supabase e o que depende de publicação da interface.

## Fechamento

Duas migrações e sync-ordens v4 aplicadas no Supabase; testes de código, SQL, relatórios e 54 cenários visuais aprovados. Publicação da interface ainda depende da hospedagem do usuário. Permissões públicas legadas permanecem documentadas como pendência de segurança.
