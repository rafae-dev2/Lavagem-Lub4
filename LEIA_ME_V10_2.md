# Branco Peres — encerradas e sincronização v10.2

## Erro mostrado nas capturas

O endereço principal confirmado pelo usuário é **https://controlelogisticalub.netlify.app**. Ele já está autorizado no Supabase. O site retornou HTTP 200; o preflight retornou 204 com CORS correto; a chamada à sincronização retornou HTTP 200, `ok=true`. A verificação no Chromium em 390px também recebeu HTTP 200 na Edge Function, sem alerta de erro.

As capturas mostram um endereço Netlify diferente, que não faz parte das origens autorizadas. Uma chamada com origem não permitida é rejeitada com HTTP 403 e o navegador a apresenta como “Failed to send a request to the Edge Function”. Use o endereço principal. Não foi necessário alterar a allowlist, o segredo ou as políticas do Supabase para esse endereço.

Uma falha de rede/CORS não encerra ordens nem modifica a última fotografia válida. A v10.2 também apresenta diagnóstico em português, distinguindo contato com a sincronização de leitura da fotografia compartilhada. Se o aplicativo for publicado futuramente em outro domínio, autorize somente o novo endereço exato; nunca use `*` nem reexecute instaladores antigos.

## Encerramento uniforme

Lavagem/Lubrificação automática (PCM), Controle Apoio e os três novos acompanhamentos usam a saída validada da fonte como encerramento operacional. Primeira presença, última presença e detecção devem formar evidência íntegra. O status bruto é preservado no Apoio e nos acompanhamentos; o encerramento não cria uma realização manual fictícia. Se a ordem reaparecer, retorna à situação atual da fonte.

Registros manuais de Lavagem/Lubrificação continuam usando sua realização confirmada e não são encerrados simplesmente por não terem correspondência na fonte. Dashboard, Calendário e Exportação recebem a seleção operacional compartilhada. O botão do cabeçalho desses módulos permite mostrar/ocultar encerradas antigas. A TV operacional não mostra ordens com situação explicitamente encerrada na origem.

## Botão e destaque das encerradas

Os novos módulos reutilizam o corte de **07:10, horário de Brasília**, e a preferência operacional de Lavagem/Lubrificação. Encerradas com detecção anterior ao último corte ficam ocultas por padrão; encerradas recentes continuam disponíveis. Sem data de detecção válida, não se usa entrada/previsão para ocultar uma conclusão recém-identificada.

O botão **Mostrar encerradas** permite consultar todas as encerradas, inclusive antigas. O retorno à operação recupera a seleção operacional. A aba de encerradas também revela o histórico completo; filtros de grupo, frota, local e período continuam aplicáveis. Os relatórios são gerados com a mesma seleção efetiva, acompanhada da informação de visibilidade.

Nos novos módulos, cartões e tabela destacam encerradas com faixa **ENCERRADA**, origem/motivo, blocos de **DETECÇÃO**, **ÚLTIMA PRESENÇA** e indicação de ausência de atraso. Detecção não deve ser interpretada como data real de realização do serviço.

O Controle Apoio também apresenta acesso direto a encerradas, situação operacional em cartões/filtros/indicadores e a informação bruta preservada nos detalhes e relatórios. Uma ordem sem evidência íntegra não é rotulada como encerrada por aproximação.

## Publicação e desenvolvimento

Publique o conteúdo completo do compilado **v10.2** no site principal, mantendo backup e sem misturar assets. A atualização visual exige publicação; o teste no site atual confirmou a versão anterior publicada, não uma publicação automática desta revisão. Não reexecute migrações de renomeação nem instaladores antigos.

Para trabalhar nas fontes, use Node.js 22.13 ou superior:

```bash
npm ci
npm run check
npm run test:acompanhamento
npm run test:encerradas
npm run test:sql
npm run build
```

Os testes de interface e SQL usam dados sintéticos/isolados e não criam ordens reais no Supabase. `npm run test:visual` exige Playwright/Chromium. As permissões públicas legadas em Lavagem/PCM/cadastros Apoio continuam sendo pendência independente, descrita na auditoria v10.1.
