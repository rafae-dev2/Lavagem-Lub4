# Instalação do monitor TV do Apoio

O monitor TV é uma leitura operacional das ordens do Apoio. Ele não grava
ordens, não classifica dados e não chama `syncApoio`; o produtor continua sendo
o fluxo existente do Apoio/PCM e seu cron de aproximadamente um minuto.

## Pré-requisitos e ordem

Em uma instalação nova, siga a ordem abaixo. No aplicativo existente, **não reexecute os scripts-base nem a integração PCM somente para instalar a TV**: confira os pré-requisitos e aplique apenas `TV_MONITOR.sql`. Reexecutar versões antigas do aplicador pode substituir melhorias posteriores.

Ordem de dependências para uma instalação nova:

1. `APOIO_SETUP.sql` — tabelas, RPC de leitura e segurança do Apoio.
2. `PCM_AUTOMACAO.sql` — integração PCM, incluindo a persistência de `classe`,
   `motivo` e `cd_ponto` no snapshot e a versão vigente de
   `aplicar_apoio_snapshot()`.
3. `TV_MONITOR.sql` — extensão incremental da tabela e publicação Realtime.

Não execute `TV_MONITOR.sql` isoladamente. Ele falha explicitamente quando as
tabelas do Apoio ou o PCM não estão instalados. O arquivo usa somente `ADD
COLUMN IF NOT EXISTS` e guards idempotentes; não apaga colunas, linhas ou
funções e não substitui `aplicar_apoio_snapshot()`.

## Realtime e leitura

`TV_MONITOR.sql` adiciona, somente se necessário, `classe`, `motivo` e
`cd_ponto` em `apoio_ordens`. A função já instalada
`carregar_apoio_controle()` monta `orders` com `to_jsonb(o)`, então esses campos
passam a aparecer na fotografia sem outra alteração de função.

O arquivo inclui, com guard idempotente, as tabelas `apoio_ordens`,
`apoio_sync`, `apoio_grupos` e `apoio_frotas` na publicação
`supabase_realtime`. Se a publicação não existir, habilite o Realtime no
projeto e execute o arquivo novamente; nenhuma publicação é criada ou
substituída por este script.

No navegador, `useTVOrders` faz apenas `loadApoioData()` (RPC
`carregar_apoio_controle()`), escuta alterações Realtime com debounce de 400 ms
e faz uma leitura de segurança a cada 30 segundos, mesmo com o canal live. O
botão de atualizar chama uma nova leitura, nunca `syncApoio`. Em falha, a
última fotografia completa permanece na tela e `error`/`connection` informam a
condição.

## Classe de emergência

A seleção padrão da TV é `status: 'Andamento'` e `emergencyOnly: true`. Uma
ordem só é emergencial quando `classe` corresponde exatamente à classe oficial
`CORRET EMERGENCIAL`, depois da normalização de acentos e separadores.
Frases ou outras classes que apenas contenham a palavra emergencial não são aceitas. Narrativa e motivo nunca são usados para inferir emergência. Se
as ordens próprias ativas não trouxerem nenhuma `classe`, a seleção permanece
vazia e `getTVOrdersWarning()` fornece o aviso de dados ausentes.

## Frequência e timestamps

`live` significa que a assinatura Realtime está conectada; não significa que a
fonte externa tenha acabado de mudar. A fonte e o cron continuam sujeitos aos
timestamps do snapshot, normalmente cron em minuto e aplicação em torno de 30
segundos quando necessário. `lastReadAt` é o horário local da última leitura
bem-sucedida feita pelo navegador; o timestamp da fonte continua em
`data.sync.fonte_atualizada`.

Datas ISO sem fuso em `tvDateTimestamp` são tratadas como horário de parede de
`America/Sao_Paulo`; datas com fuso são instantes explícitos. Datas inválidas
não são inventadas e ficam no fim das ordenações/sinalizadas pelos helpers.

## Validação local

Sem instalar dependências ou consultar um banco remoto, execute na raiz do
aplicativo:

```bash
node tests/tv-orders.test.cjs
npx tsc --noEmit
```

O teste cobre classificação emergencial positiva/negativa, `CORRET
EMERGENCIAL`, ausência de classe, propriedade exata da frota, grupos múltiplos,
interseção de filtros e ordenação com datas inválidas.
