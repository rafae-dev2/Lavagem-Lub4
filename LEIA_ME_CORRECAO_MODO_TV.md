# Correção do Modo TV — leitura do Apoio

## Diagnóstico

A mensagem da captura — “Sem conexão de rede para ler o snapshot Apoio” — era produzida antes de qualquer tentativa de rede. O hook do Modo TV considerava `navigator.onLine === false` prova de que a internet estava indisponível e encerrava a leitura. Também condicionava a consulta de segurança a esse mesmo indicador, então, se o navegador móvel mantivesse o estado incorreto, nem Atualizar nem a verificação periódica retomavam o snapshot.

Conferi o projeto Supabase `qcpnnyqzosnomvvytmfi`: está ativo, a RPC `carregar_apoio_controle()` existe e uma leitura real com o mesmo cliente público retorna 1.443 ordens, 229 frotas e 13 grupos. A captura do aparelho também tem chamadas à RPC com HTTP 200 pouco antes do estado mostrado, enquanto não há uma tentativa da RPC no minuto da tela offline. Assim, não havia evidência de banco parado ou de erro na função: o defeito estava na regra local que bloqueava a tentativa.

## O que foi corrigido

O Modo TV agora tenta a leitura HTTP mesmo quando o navegador diz que está offline; a resposta real é que confirma se o serviço está acessível. A verificação de 30 segundos não é bloqueada por `navigator.onLine`; a aba tenta novamente ao voltar ao primeiro plano e no evento online. Se a leitura falha, a última fotografia completa permanece na tela e o erro real fica disponível. Nenhuma escrita, alteração de configuração ou migração foi feita no Supabase.

## Validação e publicação

Testei o cenário com `navigator.onLine` forçado para `false`: falha inicial, nova tentativa manual, evento online, retorno ao primeiro plano e preservação do último snapshot. Os testes existentes do Modo TV, filtros, paginação e tela 1080p também passaram. O harness de regressão usa dados simulados e não chama o banco.

Para corrigir o site, publique o ZIP compilado desta entrega no Netlify como substituição completa da versão atual, incluindo `index.html`, `_redirects` e a pasta `assets`. Em seguida, feche o modo TV no celular, abra o endereço do site novamente e toque em Atualizar, se necessário. A configuração Supabase atual foi verificada; não há SQL para aplicar nesta correção.

A compilação pode mostrar o aviso já existente de bundle JavaScript maior que 500 kB; apesar do aviso, a geração termina com sucesso.
