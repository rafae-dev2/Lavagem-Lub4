# v 10.17 — Troca de óleo por plano 302LUB

## Correção já ativa no Supabase

A OS 159332726 da frota 4626 aparecia porque a narrativa contém 1812/906/604/302, reconhecido pela regra antiga no trecho 604/302. A OS 159332724 da frota 4585 informava apenas 302LUB e ficou em revisão ambígua. Não era falha de comunicação nem ocultação de grupo.

A regra agora reconhece 302LUB e 302 LUB como Troca de Óleo no Lavador, preservando 604LUB e 604/302. Números soltos 302, códigos 1302LUB/302LUBX e preventivas genéricas não são aceitos. A regra de contexto permanece: o plano novo precisa estar no ponto Lavador. Outros serviços continuam sujeitos à classificação apropriada.

## Conferência depois da aplicação

| Frota | OS | Tipo | Status | Entrada/programação |
|---|---|---|---|---|
| 4585 | 159332724 | Troca de Óleo | Em andamento | 09/11/2026 às 00:00 |
| 4626 | 159332726 | Troca de Óleo | Programada | 15/11/2026 às 07:00 |

Ambas estão presentes na consulta usada por Lavagem/Lubrificação, sem suspensão e com exatamente um registro por OS. A programação veio da Entrada original; a previsão de saída não foi usada como data programada. Nenhuma execução foi inventada: data_realizada continua vazia nas duas ordens.

Clique em Sincronizar/Atualizar no aplicativo e procure 4585 ou 159332724. Se houver filtro Programada ou filtro específico de serviço, limpe-o ou inclua Em andamento e Troca de Óleo. A correção do banco não precisa de nova publicação para importar a OS; o compilado 17 atualiza também o texto explicativo da regra e contém todas as melhorias anteriores.

## Publicação e fontes

Para publicar a interface atualizada, extraia TODO o compilado e envie seu conteúdo ao Netlify, com index.html na raiz. O arquivo supabase/PCM_OIL_302_PLAN.sql está nas fontes para instalações novas; não execute todos os setups novamente sobre o banco atual, pois a migração incremental já foi aplicada pelo Manus.

Fontes: Node.js 20.19+ ou 22.13+, npm ci, npm run check, npm run test:planos-oleo e npm run build. A configuração de retorno do Auth da revisão 16 segue independente desta correção e não foi alterada.
