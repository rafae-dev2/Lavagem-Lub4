# Branco Peres v10.5 — Central Gerencial

## Nova consulta gerencial

Acesse **Central Gerencial** no topo do menu, ou `/#central-gerencial`. Visual BI corporativo em modo claro premium próprio, sem trocar o tema dos demais módulos. A central inclui todos os grupos da fonte e do cadastro, inclusive os quatro grupos ocultos somente em Lavagem/Lubrificação e as frotas não cadastradas no Apoio.

Oito indicadores mostram seleção/frotas, carteira aberta, fila atual, média e mediana/P90 da fila, previsões vencidas, idade média aberta e encerradas. Oito análises apresentam carteira por grupo, distribuição de situações, idade da fila em seis faixas, dispersão idade×volume, evolução de entradas/saídas detectadas, Pareto da fila, oficinas/pontos e mapa de calor por grupo×idade. Cliques e botões acessíveis dos gráficos aplicam a mesma seleção aos indicadores, consultas e relatórios.

## Filtros e ordens

Pesquisa por frota, OS, narrativa, equipamento e grupo, com acentos normalizados e termos combinados. Enter na pesquisa abre a Consulta de ordens. Filtros de grupos/situações/origem têm multisseleção pesquisável. Mais filtros inclui prestador, classe, oficina/ponto, escopo cadastrado/não cadastrado, idade aberta e previsão vencida/fila. Há datas de Entrada, atalhos7/30/90dias/todos e consultas rápidas Geral/Fila/Vencidas/Externas/Encerradas.

Datas ou limites de idade inválidos exibem aviso e bloqueiam exportação. Período seleciona pela Entrada em Brasília, inclusiva; não filtra por data de conclusão real. Histograma/heatmap usam dias completos nas faixas e incluem na consulta exatamente a mesma população, mesmo quando a idade contém frações.

Consulta paginada25/50/100ordens, ordenação e expansão de narrativa/evidências, sem editar registros. PDF e Excel incluem todas as ordens selecionadas, não somente a página, com cabeçalho, emissão/fonte/filtros/alertas, KPIs e metodologia. Excel possui Indicadores/Ordens/Metodologia, células numéricas e texto protegido contra execução de fórmulas.

## Interpretação correta dos tempos

**Idade da fila desde a Entrada não é espera líquida nem MTTR.** A fonte informa a situação atual, mas não traz o timestamp do início do reparo. Programadas e aguardando/pendentes compõem a fila. A idade aberta também permite analisar ordens em andamento. Não são inferidas disponibilidade, duração efetiva da manutenção ou execução confirmada.

Datas ausentes, inválidas ou futuras não entram nas médias. Cada card apresenta sua base válida. Mediana/P90 são percentis da amostra atual, não metas ou promessas de prazo. Para encerradas, ciclo observado é Entrada→última presença válida, não duração real de reparo. Saída comprovada da fonte encerra operacionalmente; status encerrado sem data de detecção não ganha data inventada. A evolução diária mostra90dias de registros observados na fotografia, com zeros preservados entre dias, e não um ledger completo de transições ou saldo histórico de backlog.

## Integração e preservação

A central reutiliza a RPC de acompanhamento já configurada. Nenhuma migração ou alteração SQL é necessária. Não altera ordens, status, datas, classificação ou grupos no banco. Sincronização/erro e último snapshot válido continuam sinalizados. Apoio, Gestão, Lavagem, TV e os controles de reforma permanecem preservados, incluindo a ocultação v10.4.

Esta versão acrescenta a central; não modifica silenciosamente os pontos de recuperação da tela de Lavagem identificados na auditoria anterior.

## Instalar/publicar

Publique **todo o conteúdo do compilado v10.5** no site Netlify existente, sem misturar assets com versões antigas. Os arquivos entregues não publicam o site automaticamente. Faça backup da publicação anterior.

Fontes: Node.js22.13ou superior.

```bash
npm ci
npm run check
npm run test:central
npm run test:escopo-lavagem
npm run test:encerradas
npm run test:acompanhamento
npm run test:reformas
npm run test:apoio-tabela
npm run build
```

A pasta tests inclui fixtures e harnesses sintéticos identificados, somente para validação de software. A produção nunca importa esses dados e continua consultando exclusivamente a fonte compartilhada.
