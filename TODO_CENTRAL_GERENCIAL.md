# Central Gerencial v10.5

- [x] Central separada, estilo BI profissional, modo claro premium e identidade Branco Peres, organizada para computador/tablet/celular e com acesso no menu.
- [x] Consultar todos os grupos de equipamentos e ordens da fonte/cadastro, inclusive grupos ocultos somente em Lavagem, sem excluir dados ou alterar módulos anteriores.
- [x] Indicadores gerenciais de carteira, fila, andamento, previsões vencidas, encerradas, frotas e idade da fila com média/mediana/P90, sem inventar tempo líquido de espera ou execução.
- [x] Oito análises com variáveis/gráficos de grupo/situação/idade/volume/evolução/Pareto/oficinas/mapa de calor, filtros cruzados e estados vazios/qualidade de base.
- [x] Barra de pesquisa por frota/OS/narrativa/equipamento e filtros robustos por grupo/status/origem/prestador/classe/escopo/idade/período, presets e limpar seleção; filtros inválidos avisam sem relatório enganoso.
- [x] Consulta de ordens em tabela ordenável, paginada e detalhada; contagens, gráficos e relatórios usam a mesma seleção.
- [x] Relatórios PDF/Excel profissionais com cabeçalho, filtros, fonte, emissão, metodologia e todas as ordens selecionadas, preservando narrativas e sinalizando erros de atualização.
- [x] Sincronização/último snapshot válido, revisão técnica read-only e entrega fontes/compilado com instruções e limitações claras.

## Validação final

Build e TypeScript passaram. Testes de analytics/relatório, escopo de Lavagem, encerradas, acompanhamentos, reformas e tabela Apoio passaram. Navegador isolado passou em1366/1024/390px, incluindo exportações e filtros do heatmap/faixas. A publicação Netlify permanece uma etapa separada; não houve alteração SQL ou de ordens reais.
