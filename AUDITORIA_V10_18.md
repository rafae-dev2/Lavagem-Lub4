# Auditoria v10.18 — códigos de plano LUB

## Evidência real

A consulta Supabase confirmou OS 6597::159330818 ativa, Programada, narrativa com 20.004LUB, sem override e sem programação. A classificação antiga era revisao_ambigua. A OS 6597::159333053 de lavagem semanal já estava presente e corretamente classificada como Lavagem / Lubrificação.

## Mudança aplicada

A migração pcm_classify_all_numeric_lub_oil_plans foi aplicada com sucesso. Ela substitui somente a função pcm_classificar_fonte, mantendo parâmetros e permissões. A classificação por código numérico de plano com sufixo LUB passou a ser geral, conforme regra operacional confirmada pelo usuário. O código é buscado nos campos de serviço, não em setor, ponto ou modelo. Aceita número com pontos, espaços antes de LUB e caixa indiferente. O marcador explícito do plano é suficiente independentemente do ponto; o contexto anterior continua aplicado às regras de outros serviços. A regra 604/302 no Lavador permanece por compatibilidade.

A função reconciliar_pcm existente foi executada após a aplicação. Não houve alteração de seu código, da lógica de encerramento, da confirmação de execução, dos campos editáveis, das políticas de acesso ou da ocultação de grupos em Lavagem. Overrides existentes continuam prevalecendo sobre a regra automática.

## Conferência posterior

O leitor carregar_lavagem_programacoes confirmou: 6597/159330818 Troca de Óleo, PROGRAMADO, 08/11/2026 às 07:00; 6597/159333053 Lavagem / Lubrificação, PROGRAMADO, 15/11/2026 às 07:00; 4585/159332724 Troca de Óleo, ANDAMENTO, 09/11/2026 às 00:00; 4626/159332726 Troca de Óleo, PROGRAMADO, 15/11/2026 às 07:00. Todas estão visíveis na consulta, não suspensas, únicas por chave e com data_realizada vazia.

## Validação e limites

A regra foi testada em PostgreSQL isolado antes da aplicação com códigos 20.004LUB, 302LUB e 20004 LUB. Passaram TypeScript, build v10.18, regressões de edição PCM, histórico, pesquisa fixa Apoio e tabela padrão móvel de Lavagem. O teste geral de planos e integração foi ampliado para a nova regra operacional.

Os testes automatizados não substituem uma consulta do usuário com seus filtros locais: atualizar e limpar um filtro de serviço incompatível pode ser necessário. A correção de classificação já está ativa no servidor; somente o texto da interface exige republicação. Outros temas e módulos foram preservados. Os arquivos históricos de migração permanecem nas fontes, devendo ser aplicados em ordem, com a regra geral desta versão por último.

Regressão final concluída: pcm-oil-plans.test.cjs e pcm-sql.test.cjs passaram. Incluem 20.004LUB/20004LUB/302LUB/605LUB/1302LUB, campo de motivo/classe/narrativa, caixa e espaço, códigos fora do Lavador, exclusão de setor/modelo/origem e Lubrificação isolado, rejeição de LUB sem número/LUBX, legado604/302, integração6597 com lavagem em outra OS, ausência de duplicação e manual preservado. As migrações são aplicadas nos testes na ordem histórica correta.
