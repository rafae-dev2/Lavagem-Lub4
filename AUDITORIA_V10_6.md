# Validação v10.6 — Apoio refinado e modo Claro padrão

Escopo restrito ao acabamento dos cartões Controle Apoio e ao tema padrão. Não foram modificados dados de ordens, consultas Supabase, encerramentos, tabelas ou regras dos módulos anteriores.

A borda lateral ornamental foi substituída por1px, pseudo-elementos metálicos removidos e sombra deslocada eliminada. Cabeçalho com frota/idade e linha separada de status/evidências reduz disputa de largura. Campos, narrativa, botões e detalhes receberam espaços e tipografia equilibrados. Encerradas mantêm selo e destaque verde discreto, com origem/detecção disponíveis.

O contexto inicia com light/isDarkfalse, migra uma única vez a preferência antiga e preserva escolhas posteriores. Foram testados primeira instalação, preferência dark antiga, preferência manual após migração, valor inválido, armazenamento com exceções, SSR, classes genéricas, API/lista de temas e escolha manual antes do primeiro efeito.

TypeScript e testes de tabela Apoio/encerradas passaram. A regressão visual existente de tabela passou em sete combinações de largura e preferências antigas. A nova regressão específica dos cartões mediu borda1px, pseudo-elemento oculto, sombra sem deslocamento negativo, separação da idade/badges, quatro campos, ausência de overflow, encerradas preservadas e zero gravações em5combinações, incluindo Claro390/1366/1920px e escolhas manuais Dark/Glassy390px. As capturas foram inspecionadas; são fixtures locais, não números operacionais atuais.

Central Gerencial, escopo Lavagem e controles de reforma continuam incluídos na versão. O build mantém apenas os avisos já conhecidos de tamanho de bundle/imports PDF/XLSX. Não foi feita publicação automática no Netlify ou migração SQL. Essa validação cobre os cenários descritos, não constitui garantia de ausência absoluta de falhas ou certificação completa de segurança.

O acabamento final usa tokens locais neutros, evitando que o dourado herdado retorne em bordas/campos/narrativa. Cartões recolhidos alinham seus rodapés na linha; uma expansão não força os vizinhos a adquirir a altura do histórico. Build e regressão visual específica foram reexecutados após esse ajuste e passaram.
