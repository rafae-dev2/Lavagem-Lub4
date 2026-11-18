# PCM premium — instalação incremental

Esta migração adiciona edição compartilhada dos campos de negócio das programações PCM e ajusta o reconciliador para que uma OS que desapareça de um snapshot válido seja encerrada com a data local da detecção. Ela é incremental e **não altera** `PCM_AUTOMACAO.sql` nem `PCM_HISTORICO.sql`.

## Pré-requisitos e ordem

Execute previamente, nesta ordem, os contratos já existentes no SQL Editor do projeto:

1. `APOIO_SETUP.sql`;
2. `PCM_AUTOMACAO.sql`;
3. `PCM_HISTORICO.sql`;
4. `PCM_EDICAO_PREMIUM.sql` — este arquivo.

A migração premium é idempotente para colunas, índice, trigger e funções. Ela faz apenas um backfill conservador das linhas existentes e **não chama** `reconciliar_pcm()` durante a instalação. Assim, não há uma nova fotografia inventada nem fechamento provocado pelo ato de instalar; o próximo snapshot válido usa a nova reconciliação.

Não execute este arquivo em outro banco nem forneça credenciais ao teste local. A aplicação remota continua sendo acionada pelo fluxo normal de sincronização com `service_role`.

## O que a migração cria

Na tabela `public.lavagem_lubrificacao` são adicionadas:

- `pcm_edicao_campos jsonb not null default '{}'::jsonb`: objeto de overrides somente dos campos de negócio editados;
- `pcm_editado_em timestamptz`: instante da última edição premium aceita.

Os campos aceitos dentro de `pcm_edicao_campos` são somente `local`, `tipo`, `data_programada`, `horario`, `status`, `data_realizada` e `observacao`. Frota, OS, `pcm_chave`, grupo Apoio, status bruto da fonte, entrada, previsão, narrativa, suspensão, encerramento e demais metadata PCM não são editáveis pela RPC.

O trigger `trg_pcm_proteger_lavagem` é recriado para proteger também os dois metadados novos. Uma linha automática PCM continua sem `UPDATE`/`DELETE` direto por `anon`/`authenticated`; uma linha manual continua podendo usar o contrato legado de negócio, mas não pode forjar metadata PCM.

## Backfill seguro

Na instalação, a migração preenche `data_realizada` somente quando todas as condições são verdadeiras:

- `pcm_chave` não é nulo;
- `status` é `ENCERRADO`;
- `pcm_encerrado_em` não é nulo;
- `data_realizada` ainda é nula;
- não existe confirmação humana em `pcm_execucao_confirmada_em`;
- não existe nem mesmo um override explícito `data_realizada` no JSON.

A data vem de `(pcm_encerrado_em at time zone 'America/Sao_Paulo')::date`. Portanto, uma edição anterior com `data_realizada: null` é preservada vazia. Datas já confirmadas ou já preenchidas nunca são sobrescritas, e o backfill não marca `pcm_execucao_confirmada_em`.

## RPC pública de edição

A função usada pelo serviço é:

```sql
public.editar_programacao_pcm(p_id bigint, p_campos jsonb) returns jsonb
```

Exemplo com `supabase-js`:

```ts
const { data, error } = await apoioClient.rpc('editar_programacao_pcm', {
  p_id: row.id,
  p_campos: {
    local: 'CAMPO',
    tipo: 'Lubrificação',
    data_programada: '2026-11-05',
    horario: '09:30',
    status: 'ANDAMENTO',
    data_realizada: null,
    observacao: 'Nota operacional',
  },
});
```

A resposta bem-sucedida tem o formato `{ ok: true, row: raw }`, onde `row` é a linha completa RAW de `lavagem_lubrificacao`, incluindo os metadados PCM existentes. O serviço deve usar `row.id` para a próxima edição; `pcm_chave`, `frota` e `pcm_os` continuam sendo identidade somente leitura.

### Validações

`p_campos` precisa ser um objeto JSON. Chaves desconhecidas falham antes da escrita. Os valores aceitos são:

| Campo | Regra |
|---|---|
| `local` | texto, somente `LAVADOR` ou `CAMPO` |
| `tipo` | texto, somente `Lavagem / Lubrificação`, `Lubrificação` ou `Troca de Óleo` |
| `data_programada` | `YYYY-MM-DD` válido, string vazia ou `null` |
| `horario` | `HH:MM` de `00:00` a `23:59`, string vazia ou `null` |
| `status` | `PENDENTE`, `PROGRAMADO`, `ATRASADO`, `ANDAMENTO` ou `ENCERRADO` |
| `data_realizada` | `YYYY-MM-DD` válido, string vazia ou `null` |
| `observacao` | texto ou `null`; normalizado para texto vazio quando nulo; máximo de 1.000 caracteres |

Cada chamada aplica somente as chaves fornecidas. O valor normalizado é gravado na coluna de negócio e no objeto `pcm_edicao_campos`; chaves não fornecidas não são substituídas pelo cliente. `data_realizada: null` é uma escolha explícita e continua nula durante sincronizações e fechamento por ausência até uma reabertura verdadeira.

A RPC usa `SECURITY DEFINER`, `search_path = pg_catalog, public` e adquire a trava advisory `apoio:sync:claim` antes de `FOR UPDATE` na linha. Isso mantém a mesma ordem de serialização usada pelo sync. Uma edição que realmente muda campos gera um evento já permitido `STATUS`, com `detalhes.origem = 'editar_programacao_pcm'` e a lista dos campos fornecidos; nenhuma nova opção é adicionada à constraint de eventos.

A migração revoga `EXECUTE` da RPC para `PUBLIC` e concede somente a `anon` e `authenticated`, preservando o produto sem login. Ela não concede DML, `DELETE` ou acesso direto a metadata.

## Regras de reconciliação premium

A reconciliação só trabalha quando `apoio_sync.fonte_atualizada` existe e `apoio_sync.erro` é nulo. Snapshot antigo, falha de consulta e estado sem heartbeat não encerram nada.

Para uma ordem presente em snapshot válido:

- `local`, `tipo`, `data_programada`, `horario`, `status`, `data_realizada` e `observacao` usam o override correspondente quando a chave existir;
- um override de `tipo` é usado diretamente e não chama classificação externa para substituí-lo;
- mudança real do status bruto da fonte remove somente o override de `status` e passa a usar o status da fonte;
- as demais chaves de negócio permanecem;
- `pcm_execucao_confirmada_em` não é preenchido automaticamente.

Se o usuário deixar uma linha ainda presente na fonte com status manual `ENCERRADO`, o ajuste é preservado sem criar `pcm_encerrado_em`: esse instante fica reservado à detecção da saída da ordem. A verdadeira transição posterior da fonte pode remover o override. Uma confirmação de execução realizada pelo histórico atualiza também o override da data, para prevalecer sobre uma limpeza anterior.

Para uma ordem que saiu da listagem de um snapshot válido, se a frota ainda existe:

- na primeira ausência, `status` passa a `ENCERRADO`;
- `pcm_encerrado_em` recebe o instante de detecção (`clock_timestamp()`);
- `data_realizada` recebe o dia de `pcm_encerrado_em` no fuso `America/Sao_Paulo`, salvo se já houver a chave manual `data_realizada` no JSON — inclusive quando seu valor é `null`;
- o override de `status` é removido;
- a observação existente é preservada, sem anexar texto técnico;
- a auditoria usa o evento histórico `CLOSE` e mantém a confirmação humana separada.

Se a OS reaparecer em snapshot válido, a mesma linha e a mesma identidade são reabertas. Nesse momento os overrides `status` e `data_realizada` são removidos, `data_realizada` e `pcm_execucao_confirmada_em` são limpos, e os demais overrides (`local`, `tipo`, `data_programada`, `horario`, `observacao`) permanecem.

Se a frota foi removida do cadastro Apoio, a linha é apenas suspensa, sem `pcm_encerrado_em` novo e sem encerramento. Se a sincronização falhar, nenhuma alteração de presença é feita.

## Checks pós-instalação

No SQL Editor, os checks abaixo confirmam os objetos principais sem alterar dados:

```sql
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'lavagem_lubrificacao'
   and column_name in ('pcm_edicao_campos', 'pcm_editado_em')
 order by column_name;

select p.oid::regprocedure, p.prosecdef, p.proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('editar_programacao_pcm', 'reconciliar_pcm');

select has_function_privilege('anon', 'public.editar_programacao_pcm(bigint,jsonb)', 'EXECUTE') as anon_pode_editar,
       has_function_privilege('authenticated', 'public.editar_programacao_pcm(bigint,jsonb)', 'EXECUTE') as authenticated_pode_editar,
       has_function_privilege('public', 'public.editar_programacao_pcm(bigint,jsonb)', 'EXECUTE') as public_pode_editar;
```

O resultado esperado é `anon_pode_editar = true`, `authenticated_pode_editar = true` e `public_pode_editar = false`. A função deve aparecer como `prosecdef = true` e em `proconfig` deve constar `search_path=pg_catalog, public`.

## Teste local

A partir da raiz `/home/ubuntu/apoio-app`:

```bash
node tests/pcm-premium-sql.test.cjs
```

O teste é estático e, quando `@electric-sql/pglite` está disponível, também executa `APOIO_SETUP.sql`, `PCM_AUTOMACAO.sql`, `PCM_HISTORICO.sql` e esta migração em PostgreSQL isolado em memória. Ele cobre whitelist/tipos, ordem dos locks, proteção de metadata, overrides, `data_realizada: null`, data local de ausência, reabertura, frota removida e erro de sync. Nenhum Supabase remoto ou credencial é consultado.
