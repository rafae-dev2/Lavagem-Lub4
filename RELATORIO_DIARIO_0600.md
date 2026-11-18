# Relatório diário — Atrasados + Programados até as 06:00

A exportação de Lavagem e Lubrificação passa a usar uma seleção obrigatória, igual para PDF e todos os formatos de imagem. O visual, logotipo, tabelas, cards e temas existentes foram preservados.

O relatório inclui todos os registros classificados como ATRASADO, sem limite de antiguidade, além dos PROGRAMADOS desde as 00:00 do dia atual até as 06:00 inclusive do dia seguinte. A data atual é determinada pelo horário de Brasília, mesmo que o aparelho esteja em outro fuso. A seleção utiliza a data e o horário programados, não a previsão de saída da ordem.

Por exemplo, ao exportar em 04/11/2026 entram todos os atrasados anteriores, todos os programados de 04/11 e os programados de 05/11 entre 00:00 e 06:00. Uma programação de 05/11 às 06:00 entra; às 06:01 não entra. Programados posteriores ao corte, em andamento, pendentes e encerrados ficam fora. Um PROGRAMADO com data passada é tratado como ATRASADO no relatório, sem alterar o banco. Amanhã sem horário válido não é presumido dentro do corte; a informação precisa ser conferida.

Os filtros de grupo Apoio, serviço e origem continuam disponíveis. Os filtros de semana, status e período foram retirados da exportação diária para não ocultarem atrasados nem ampliarem a janela obrigatória. A programação continua oferecendo seus próprios filtros normalmente.

A janela é atualizada automaticamente e recalculada no instante de gerar o PDF ou a imagem. Uma imagem de um dia anterior precisa ser gerada novamente antes do download. Os totais refletem a mesma seleção usada nas linhas exportadas.

## Publicação

Esta alteração é somente do aplicativo. O Supabase e a automação PCM já instalada não precisam de nova configuração. Extraia o ZIP Netlify e publique no mesmo site a pasta que contém o index.html. O ZIP de código-fonte contém a versão completa atualizada.

## Verificação

Os testes isolados cobrem o limite exato das 06:00, horários ausentes ou inválidos, atrasados antigos, normalização sem alterar os dados originais, mudança de data, virada de mês/ano e fuso de Brasília. O teste de regressão compara os geradores PNG e todo o corpo visual do PDF, permitindo apenas a atualização da seleção dos dados. Execute node tests/daily-export.test.cjs e node tests/pcm-report-regression.cjs para repetir as verificações.
