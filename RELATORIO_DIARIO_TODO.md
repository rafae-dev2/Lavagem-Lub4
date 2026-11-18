# Relatório diário até06:00

- [x] PDF e todas as imagens de Lavagem/Lubrificação devem incluir sempre todos os atrasados, sem corte por antiguidade, mais programados de00:00 do dia atual até06:00 inclusive do dia seguinte, usando horário de Brasília e data/horário programados.
- [x] Excluir programados do dia seguinte após06:00, de dias posteriores, encerrados, em andamento e pendentes. Programado com data passada será tratado como atrasado no relatório mesmo que cache/servidor não tenha recalculado. Programado de amanhã sem horário válido não será presumido dentro do corte.
- [x] Filtros opcionais por grupo Apoio, serviço e origem continuam funcionando; filtros de semana, status ou período não podem ocultar atrasados nem ultrapassar a janela diária obrigatória. A janela renova ao mudar a data e no momento de gerar o arquivo.
- [x] Preservar visual, logotipo e geradores atuais e aplicar a mesma seleção aos contadores, PDF e PNG. Entregar versão compilada Netlify e fonte atualizadas sem alterar a automação do Supabase.
