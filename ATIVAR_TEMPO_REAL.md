# Ativar Tempo Real (status muda na hora em todos os aparelhos)

O app já vem com **tempo real ligado no código**. Falta só **liberar a tabela no Supabase** (isso é feito uma única vez).

## Sem fazer nada
O app **já atualiza sozinho a cada 15 segundos** entre os aparelhos. Ou seja,
mesmo sem o passo abaixo, a mudança de status aparece nos outros aparelhos em
poucos segundos.

## Para ficar INSTANTÂNEO (recomendado)
Escolha **uma** das opções:

### Opção A — pelo painel do Supabase (mais fácil)
1. Acesse o projeto no Supabase.
2. Menu **Database → Replication**.
3. Abra a publicação **`supabase_realtime`**.
4. Marque a tabela **`lavagem_lubrificacao`**.
5. Salvar. Pronto — as mudanças passam a aparecer na hora.

### Opção B — pelo SQL Editor
Cole e execute:

```sql
alter publication supabase_realtime add table public.lavagem_lubrificacao;
```

> Depois de ativar, não precisa mexer em mais nada no app. Ele detecta as
> mudanças automaticamente (INSERT / UPDATE / DELETE) e atualiza a tela.
