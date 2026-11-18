# v10.18 — Troca de óleo por código de plano LUB

## Correção já ativa no Supabase

A OS 159330818 da frota 6597 informa o plano 20.004LUB. Ela não era reconhecida porque a regra anterior dependia de uma lista curta de códigos. Conforme a orientação operacional do usuário, qualquer código numérico de plano terminado em LUB identifica Troca de Óleo nos campos de serviço da ordem, independentemente do número. Aceita-se separador de ponto e espaço antes do sufixo: 20.004LUB, 20004LUB, 20004 LUB, 302LUB, 604LUB e 1812LUB.

O código de plano é procurado em motivo, classe e narrativa; não no modelo, nome do equipamento, setor ou ponto. Portanto, o setor Lavador & Lubrificação e o ponto Lub Lavador, sozinhos, não transformam uma lavagem em troca de óleo. O código explícito LUB permite classificar o serviço independentemente do ponto em que é executado. A regra legada 604/302 no Lavador continua aceita mesmo sem sufixo LUB.

Não há mais lista de números conhecidos. Novos códigos de plano terminados em LUB passam a ser reconhecidos na sincronização normal. Texto genérico de preventiva, número isolado ou sufixo LUBX não são interpretados como código válido. Classificações manuais existentes continuam tendo prioridade; a regra automática não remove um override.

## Conferência após aplicação

| Frota | OS | Tipo | Situação |
|---|---|---|---|
| 6597 | 159330818 | Troca de Óleo | Programada |
| 6597 | 159333053 | Lavagem / Lubrificação | Programada |
| 4585 | 159332724 | Troca de Óleo | Em andamento |
| 4626 | 159332726 | Troca de Óleo | Programada |

As quatro OS estão na consulta usada pelo aplicativo, não suspensas e únicas por chave. As datas programadas continuam vindas da Entrada original; nenhuma execução foi criada. A OS de óleo da 6597 mantém 08/11/2026 às 07:00. A de lavagem semanal mantém 15/11/2026 às 07:00.

Clique em Sincronizar/Atualizar e pesquise 6597 ou 159330818. Caso esteja filtrando apenas Lavagem/Lubrificação, inclua Troca de Óleo ou limpe o filtro de serviço. A correção do banco já vale no site sem republicar; o compilado 18 atualiza também o texto explicativo da revisão PCM e inclui todas as melhorias anteriores.

## Publicação e fontes

Para atualizar a interface, extraia todo o ZIP compilado e publique o conteúdo no Netlify, com index.html na raiz. O arquivo supabase/PCM_OIL_LUB_PLANS.sql é a migração incremental desta versão e já foi aplicado pelo Manus. Em instalações novas, esse arquivo deve vir depois das migrações anteriores. Não reaplique PCM_OIL_302_PLAN.sql após a regra geral, pois ele representa a versão histórica da classificação.

Fontes: Node.js 20.19+ ou 22.13+, npm ci, npm run check, npm run test:planos-oleo, node tests/pcm-sql.test.cjs e npm run build. Nenhuma ordem, política de acesso ou imagem precisa ser alterada para publicar esta interface.
