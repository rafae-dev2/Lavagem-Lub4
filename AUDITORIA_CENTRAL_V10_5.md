# Auditoria — Central Gerencial v10.5

Revisão08/11/2026. Escopo: a nova central, fonte integral de ordens/grupos, filtros/indicadores/gráficos/consulta/relatórios, rota/menu e preservação dos módulos v10.4. A central é de consulta; nenhuma ordem ou cadastro foi alterado no Supabase.

## Evidências de validação

| Área | Evidência |
|---|---|
| Tipos e compilação | TypeScript sem erro e build de produção. |
| Domínio gerencial | Testes da fonte integral, grupos cadastrados e da fonte, pendentes/programadas, andamento, encerramento por fonte/ausência e inativos sem prova. |
| Tempos | Média/mediana/P90 com datas válidas; datas ausentes/futuras/inválidas não viram zero; idade aberta e de fila separadas; entrada ausente não desfaz prova de saída. |
| Datas/seleção | Período inclusivo de Entrada em Brasília; caso UTC próximo da meia-noite; idade decimal, faixa por dias completos e contagem igual entre gráfico/consulta. |
| Relatórios | PDF multipágina com cabeçalho/rodapé, alerta, narrativa integral e horários de Entrada; Excel com três abas, dados numéricos, população completa e texto protegido contra fórmulas. |
| Navegador isolado | Computador1366px, tablet1024px e celular390px, usando fixtures de teste claramente identificadas e bloqueando qualquer serviço externo. |
| Interações | Oito KPIs/oito gráficos, multisseleção de grupos, busca/Enter, detalhes, idade inválida bloqueando relatório, filtro de faixa, heatmap grupo+faixa inclusive clique repetido, paginação e downloads PDF/Excel. |
| Preservação | Passaram regressões de escopo Lavagem, encerradas07:10, acompanhamento, novos controles de reforma e tabela Apoio. |

## Achados corrigidos

A revisão read-only encontrou alinhamento do heatmap ainda em quatro faixas, contraste insuficiente em células de baixa intensidade, série temporal descartando dias de zero, perda do horário original na exportação e rótulo de idade aberta confundido com fila. Todos foram corrigidos, com testes ampliados. A distribuição mantém as seis faixas, inclusive contagem zero; o heatmap usa texto escuro em fundos claros. A série mantém90pontos diários quando existem ocorrências, sem ligar apenas dias não consecutivos.

Também corrigidas a consistência de contagem ao selecionar faixas com idades fracionárias, a manutenção do grupo no clique repetido do heatmap, o filtro por idade aberta para ordens em andamento, locais/oficinas detalhados por ponto/prestador e a separação entre inativo sem prova e encerrado. Casos sem Entrada não geram média de idade, mas não anulam uma prova temporal válida de saída da fonte.

A consulta está organizada em Painel gerencial/Consulta de ordens/Metodologia. No celular, Mais filtros revela os controles completos para que os indicadores não fiquem abaixo de um bloco inicial excessivo. Não houve alteração do tema global.

## Limites que permanecem explícitos

A fonte não fornece início efetivo do reparo ou conclusão real confirmada. Portanto, a central apresenta **idade da fila desde a Entrada** e ciclo observado, não espera líquida, MTTR, disponibilidade ou tempo real de execução. A evolução é da fotografia conhecida e não um ledger histórico completo de transições.

Os contadores e percentis representam a seleção atual; gráficos que exigem data usam a base válida explicitada. Inativos sem prova temporal de saída ficam em Outros e não são considerados carteira aberta, fila ou previsão vencida. Frotas sem cadastro seguem o grupo da fonte, sem classificação por narrativa.

Fixtures e capturas de testes não representam números operacionais reais. A produção não importa essas fixtures. A configuração de leitura já instalada é reutilizada; não é necessária migração SQL. O build manteve os avisos conhecidos de tamanho de bundle/imports de PDF/XLSX; não são erros de compilação, mas há oportunidade futura de melhorar carregamento por divisão de código.

Esta auditoria não promete ausência absoluta de falhas nem certificação de segurança completa. A publicação do compilado no site do usuário é etapa separada; os arquivos não alteram automaticamente a hospedagem Netlify. Também não modifica a recuperação de cache de Lavagem citada na auditoria anterior, pois não fazia parte desta solicitação.
