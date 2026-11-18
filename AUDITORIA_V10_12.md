# Auditoria v10.12 — congelamento na rolagem de Lavagem

## Causas confirmadas

A região da tabela móvel tinha `touch-action: pan-x` e `overflow-y: hidden`. O navegador aceitava gesto horizontal, mas não permitia o gesto vertical de subir/descer a página iniciado sobre as linhas. Um teste com eventos de toque do Chrome DevTools Protocol reproduziu a falha com o componente da aplicação e 70 programações sintéticas. Isso não era falha de comunicação de encerramentos no Supabase.

Outra fonte de trabalho desnecessário era o relógio da página Programações, somado ao relógio global da preferência de encerradas. Os dois atualizavam estado React a cada segundo. A mudança da referência de data refazia filtros, contagens, ordenação e renderização das linhas mesmo quando nenhuma ordem mudava. A correção alinha os relógios ao início do minuto, suspende timers enquanto a aba está oculta e consulta o horário atual imediatamente ao retornar.

## Correções

A tabela agora permite `touch-action: pan-x pan-y`, com overflow vertical automático e overflow horizontal preservado. As colunas continuam acessíveis por gesto lateral no celular. Não houve mudança nos registros, filtros, modalidades, permissões ou no banco.

App e Programações usam o hook compartilhado `useOperationalMinuteClock`. A regra usa início de minuto, e não simplesmente um intervalo iniciado no momento em que o site abre. Assim, a janela operacional das 07:10 continua correta, incluindo retorno de aba em segundo plano. A frequência de consulta/sincronização do Supabase não foi alterada.

## Evidências

| Cenário | Antes | Depois |
|---|---|---|
| Celular 390 px, gesto vertical sobre a tabela | scrollY permaneceu 0 | scrollY 0 → 482 px |
| Tablet 768 px, gesto vertical sobre a tabela | scrollY permaneceu 0 | scrollY 0 → 488 px |
| Computador 1366 px | Teste da versão corrigida | scrollY 0 → 487 px |
| Gesto horizontal em390 px | Funcionava | Continua funcionando, scrollLeft 492 px |
| Gesto horizontal em768 px | Funcionava | Continua funcionando, scrollLeft 320 px |
| Relógio visual em 07:09:55 | Atualizações por segundo no código antigo | Nenhum tick antes de 07:10:00; virada exata às 07:10 |
| Aba oculta | Timers permaneciam ativos | Timer suspenso; retorno atualiza imediatamente |

Os testes passaram usando componentes reais e dados simulados. A página não recebeu gravações em ordens reais. A evidência de gesto está no teste `lavagem-table-scroll-v1011-browser-test.py`; o nome histórico do teste não muda a versão entregue 10.12.

Também passaram TypeScript, teste de relógio com timers controlados, regressão do corte 07:10, controle global de Mostrar encerradas, Central Gerencial e testes responsivos Apoio nas larguras390, 768, 955, 1024 e 1440 px. O build final deve ser publicado para que os ajustes entrem no Netlify.

## Limites

O teste de gesto foi feito no Chromium com negociação real de toque. A fluidez pode variar por hardware, versão de navegador e tamanho da listagem, especialmente quando todas as encerradas estão visíveis. Não foi medido ganho percentual de CPU ou quadros por segundo e não há promessa de ausência absoluta de engasgos em todos os aparelhos. As duas causas confirmadas foram corrigidas sem apagar nem ocultar ordens adicionais.

A versão do site não é alterada automaticamente por esta entrega. Publique o compilado v10.12 completo no Netlify e atualize o cache da aba. Não execute migrações nem altere o Supabase para esta correção.
