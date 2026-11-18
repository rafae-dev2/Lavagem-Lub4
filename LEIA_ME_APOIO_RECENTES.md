# Controle de Equipamentos — Apoio: ordens recentes

## Uso

Abra **Filtros e acompanhamento** e localize **Ordens mais recentes**. Há três atalhos: **Recentes · Programadas e andamento**, **Recentes · Programadas** e **Recentes · Em andamento**. Eles colocam as mais novas primeiro, mantendo os filtros de busca, grupos/frotas, local e prestador já escolhidos. O atalho muda o status da seleção, mas não muda o período ou a data de referência que você escolheu.

Em **Período de recência**, escolha sem limite, última hora, últimas6h,24h,hoje no horário de Brasília, últimos7dias ou intervalo personalizado. A recência é recalculada a cada30segundos com os dados disponíveis; a rotina existente continua consultando a fonte a cada60segundos. A fonte pode ter sua própria frequência de atualização. Não se trata de garantia de atualização instantânea de status.

Em **Ordenar ordens**, você pode voltar à organização por Apoio/oficina ou escolher mais antigas primeiro. O padrão ao abrir o módulo permanece a organização anterior; o novo recurso é ativado pelos atalhos e controles. **Limpar filtros** também restaura esse padrão.

## Qual data é usada

**Entrada da OS** representa o horário de entrada informado pela fonte. **Primeira detecção no Apoio** representa a primeira vez que a ordem foi registrada no Apoio. Uma ordem antiga importada agora pode aparecer como recém-detectada sem ser uma nova ordem. Nenhuma dessas datas representa necessariamente o instante em que o status mudou para Andamento.

A última sincronização/última visualização não é usada como abertura da ordem. Datas ausentes, inválidas ou futuras ficam ao final da ordenação sem limite e não entram nos períodos recentes. Intervalos personalizados usam Brasília e incluem o dia final até seu fim, limitado ao momento atual; intervalos invertidos exibem aviso.

## Escopo e preservação

A mesma seleção é aplicada antes da paginação e ao conjunto de ordens enviado aos relatórios. O resumo da seleção acompanha a tela e os metadados que os geradores de relatório já utilizam. PDF e imagens preservam a ordem recente usando blocos adjacentes de Apoio/local; no modo organizado, mantêm o agrupamento anterior. Histórico de ausentes continua distinguindo ausência de encerramento. Os atalhos filtram o status informado pela fonte, não inferem andamento a partir de horários.

O aplicativo completo inclui os visuais premium de Apoio e Lavagem/Lubrificação, adaptação celular/tablet/desktop, Modo TV e todas as correções anteriores de sincronização e exportação. Nenhuma OS foi alterada para testar este recurso.

## Publicação

Substitua a versão completa no Netlify pelo conteúdo do ZIP compilado: index.html, assets, _redirects, logo e fundos vetoriais. Não misture assets de compilações distintas. A publicação não foi feita automaticamente.

Não é necessário novo SQL no Supabase. O ZIP de scripts é somente referência para backup/instalação nova; não reaplique scripts antigos automaticamente no banco em funcionamento.
