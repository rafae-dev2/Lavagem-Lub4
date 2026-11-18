# Validação — manutenção integrada v10.1

A documentação vigente desta revisão está em `LEIA_ME_ACOMPANHAMENTO.md`, `REGRAS_ACOMPANHAMENTO.md` e `AUDITORIA_REVISAO_MANUTENCAO.md`. Materiais antigos mantidos nas fontes são históricos e não devem ser usados para reexecutar instaladores no projeto configurado.

Foram verificados classificação conservadora e suas regressões, encerramento operacional por saída validada, reaparecimento, preservação de status bruto, datas válidas e inválidas em Brasília, filtros, métricas, paginação de 24 ordens e exportação de toda a seleção. O cenário de relatórios inclui 76 ordens, textos longos e PDF com dez páginas.

A interface foi renderizada em Chromium com ordens sintéticas, combinando três módulos, três temas e seis larguras (320 a 1920px): 54 cenários. Verificaram-se logo, cartões opacos, uma/duas/três colunas, sidebar, detalhes e ausência de overflow. As interações incluem status de encerradas, busca, paginação, limpar filtros e tabela em celular. Nenhuma ordem real foi criada para testes.

O PostgreSQL de testes usa PGlite em memória para validar snapshots, guard de campos obrigatórios, saída/reaparecimento, permissão de leitura, bloqueio de escrita e fotografia superior a 1.000 registros. O Supabase real foi consultado e recebeu as duas migrações documentadas e a função de sincronização v4. Uma fotografia incompleta foi rejeitada no banco antes de modificar qualquer ordem.

Comandos reproduzíveis:

```bash
npm ci
npm run check
npm run test:acompanhamento
npm run test:sql
npm run test:visual
npm run build
```

O teste visual requer Python Playwright e Chromium. O harness `maintenance-import-compat-harness.ts` e o teste correspondente validam extração PDF/worker e parsers preservados com arquivos sintéticos. PDF.js 6.2.108 e SheetJS 0.20.3 estão fixados; `npm audit --omit=dev` reportou zero vulnerabilidades conhecidas na verificação final.

Persistem riscos de permissões públicas herdadas em Lavagem/PCM/cadastros Apoio, descritos no relatório. A interface não foi publicada na hospedagem atual. Os testes não constituem garantia de funcionamento perfeito em qualquer dispositivo físico ou eliminação de todos os riscos de segurança.
