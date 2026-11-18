# Acompanhamento de manutenção — entregas

- [x] Remover Manutenção Equipamentos, Exportar Carretas, Importar Carretas, Programação Carretas e Dashboard Carretas da navegação, rotas e código de telas; desativar consultas legadas de carretas na aplicação principal sem apagar registros existentes.
- [x] Criar módulos para acompanhamento das preventivas e lubrificação das carretas canavieiras, com dados da integração de Gestão de Ordens Manutenção, seleção defensiva dos equipamentos e status da fonte.
- [x] Criar módulo de reformas dos equipamentos apoio com filtros Andamento, Programado e Encerrado; ausência da fonte deve permanecer identificada, sem falsa confirmação de encerramento.
- [x] Oferecer relatórios PDF e Excel com cabeçalho institucional, filtros, indicadores, dados das ordens, atualização da fonte e avisos de inconsistência; incluir todas as páginas da seleção, não só a página visível.
- [x] Aplicar visual robusto e cards premium conforme o tema; organizar navegação, filtros e apresentação para computador, celular e tablet, com busca, detalhes, paginação e estados claros de atualização/erro/vazio.
- [x] Revisão técnica independente e documentação de instalação, regras de classificação e limites da integração.

Evidências: verificação TypeScript e compilação concluídas; testes de classificação, interface SSR, PDF de 10 páginas/76 ordens e Excel de 76 ordens, mais regressões Apoio, aprovados. Revisão independente incorporada. Veja VALIDACAO_ACOMPANHAMENTO.md para limites da validação.
