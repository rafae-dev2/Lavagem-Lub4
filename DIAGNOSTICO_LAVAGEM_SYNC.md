# Diagnóstico — atualização de Lavagem e Lubrificação

Verificação iniciada em06/11/2026, aproximadamente00:20, horário de Brasília. Consultas e validação com cliente público foram somente leitura. Nenhuma ordem foi concluída, reaberta, excluída ou alterada durante os testes.

## Evidências reais

Não foi encontrada, no momento da consulta, uma programação PCM ainda aberta cuja ordem estivesse ausente do Apoio. Isso não prova que a tela do navegador estivesse atualizada no momento do problema relatado.

As duas ordens de Lavagem/Lubrificação encerradas mais recentemente eram:

| Frota | OS | Situação na tabela e na RPC pública | Detecção de ausência |
| --- | --- | --- | --- |
|4626|159331208|ENCERRADO|05/11/2026 às23:11:01, Brasília|
|6608|159331210|ENCERRADO|05/11/2026 às23:11:01, Brasília|

Essas são candidatas aos casos relatados; o usuário ainda precisa confirmar os números. O histórico registra edições para ENCERRADO às22:50:51 e22:50:58 respectivamente, antes da detecção automática de ausência às23:11. Portanto a detecção de ausência não foi o primeiro encerramento dessas linhas, e não podemos afirmar que o incidente relatado ficou reproduzido com esses dois registros.

O campo `pcm_status` dessas linhas conserva `Andamento`, o último status recebido enquanto estavam na fonte. Isso é histórico; a situação operacional retornada pelo banco é `status=ENCERRADO`, e o cliente atual prioriza esse campo. Não é correto tratar `pcm_status=Andamento` isoladamente como uma ordem ainda aberta.

A fonte Apoio indicava00:10:02 como horário de atualização e a consulta ao servidor estava em00:20:01, sem erro. A tela Gestão de Ordens Manutenção incorpora diretamente o site PIMS em iframe; Lavagem consulta um snapshot Supabase reconciliado a partir do JSON da fonte. São caminhos distintos de leitura: a saída de uma ordem da tela externa não garante que o JSON e o snapshot tenham avançado no mesmo instante. A nova correção da tela não acelera a publicação do JSON pelo sistema externo.

## Falhas encontradas e corrigidas

**Realtime incompleto.** A publicação `supabase_realtime` continha as quatro tabelas do Apoio, mas não `lavagem_lubrificacao`. O hook de Lavagem assinava uma tabela sem publicação, então faltava a atualização imediata por evento. A migração incremental adicionou somente essa tabela; não mudou registros, permissões, RLS ou a rotina de sincronização da fonte. A inclusão foi confirmada em `pg_publication_tables` e a assinatura com a chave pública do aplicativo atingiu `SUBSCRIBED`.

**Atualização descartada durante leitura.** Antes desta revisão, `syncFromSheet` retornava imediatamente quando já havia consulta em andamento. Um evento recebido nessa janela podia ser perdido até o próximo polling. Agora o pedido é acumulado e uma nova leitura ocorre ao finalizar a atual; a exigência de leitura fresca e de spinner manual é preservada.

**Retomada do navegador.** O hook passou a consultar novamente ao voltar à aba, recuperar foco, ficar online e concluir/reconcluir a assinatura Realtime. O intervalo de segurança de15 segundos continua ativo. Consultas têm limite de20 segundos e cancelamento; uma resposta de uma montagem antiga não pode sobrescrever a tela remontada.

**Aviso de falha.** Nas telas de Lavagem/Lubrificação, uma falha de leitura exibe aviso de atualização pendente e botão de nova tentativa. Dados em cache não devem parecer confirmados quando a conexão falha.

O Realtime ausente explica a falta de notificação imediata, mas, isoladamente, não explica atraso persistente porque já existia polling de15 segundos. Sem os identificadores confirmados, a URL e o estado do navegador no incidente, não é possível concluir qual combinação de cache, aba suspensa, rede, versão publicada ou atraso do JSON causou o caso específico.

## Validação e limites

A RPC pública confirmou as duas candidatas como ENCERRADO. A assinatura real do Realtime foi validada sem provocar uma alteração artificial. Nenhum evento de alteração foi observado na curta janela dessa assinatura; os testes de transição e de entrega de eventos são feitos com mocks isolados, não com ordens reais.

Os testes antigos `pcm-client.test.cjs` e `pcm-history-client.test.cjs` contêm expectativas anteriores de data vazia para PCM encerrado, incompatíveis com as regras premium já existentes antes desta revisão. Essas asserções falharam; não representam regressão criada no hook de sincronização e não foram alteradas nesta investigação. Os testes atuais de exportação, seleção do Modo TV e capacidade dos cards passaram. TypeScript e compilação passaram. O teste de UI do hook real, com servidor e eventos simulados, passou: transição das duas linhas para ENCERRADO sem duplicatas, evento concorrente, focus, visibilitychange, online, reconexão SUBSCRIBED, polling de15 segundos, timeout de20 segundos e proteção de resposta atrasada após remontagem. O mapeador real também recebeu as duas linhas da RPC pública e manteve ENCERRADO apesar do histórico pcm_status=Andamento. As regras atuais de exportação de encerradas desde07:00 são preservadas.

## Atualização do aplicativo

O Realtime já foi corrigido no banco real. Para receber as demais proteções, publique o pacote compilado completo no mesmo site Netlify, sem misturar a pasta `assets` de versões diferentes. Os fontes completos incluem a migração `supabase/LAVAGEM_REALTIME.sql` como referência; não precisa executá-la novamente nesse projeto.

O aplicativo atualizado não foi publicado automaticamente no Netlify. O diagnóstico da versão que está no celular depende da URL e da confirmação das duas frotas/OS.
