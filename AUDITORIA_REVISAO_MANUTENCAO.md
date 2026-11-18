# Auditoria da revisão de manutenção — Branco Peres

Versão 10.1.0 · 08/11/2026 · Manus AI

## Regra de encerramento implementada

Uma ordem anteriormente presente que sai de uma fotografia posterior válida da fonte é **encerrada operacionalmente** nos três acompanhamentos. Esse encerramento é identificado como **Saída da fonte**, com última presença e detecção. O status bruto da Gestão de Ordens/PIMS não é modificado, e não se inventa data de execução humana.

Foram verificados encerramento por saída, encerramento explícito da fonte, reaparecimento e reabertura, ausência de prova, datas impossíveis e cronologia invertida. Sem prova íntegra, a situação aparece em Outros, com aviso, sem falso encerramento. Uma resposta que falha ou não corresponde ao contrato não substitui a última fotografia válida da sessão nem provoca encerramentos.

## Supabase configurado e verificado

O Manus foi conectado ao projeto existente `qcpnnyqzosnomvvytmfi`. Foram aplicadas as migrações `maintenance_tracking_operational_closure` e `maintenance_snapshot_completeness_guard`. A Edge Function `sync-ordens` foi atualizada da versão 3 para a versão 4 e permaneceu ACTIVE, mantendo a configuração de autenticação/origens existente.

A view `manutencao_acompanhamento_ordens` e a RPC `carregar_acompanhamento_manutencao` são SECURITY INVOKER e respeitam as permissões/RLS das tabelas de origem. A nova consulta calcula situação/origem/detecção sem sobrescrever ordens. A função de aplicação e sua implementação interna são executáveis apenas por `service_role`, não por `anon`.

O aplicador transacional rejeita itens com campos obrigatórios omitidos. A fonte real foi lida somente para verificar o contrato: 697 ordens e seis previsões nulas legítimas, aceitas como previsão não informada. Classe, motivo e código de ponto opcionais não apagam o último valor estruturado conhecido quando a fonte antiga os omite. A proteção existe na Edge Function e no aplicador SQL.

Um teste de fotografia incompleta foi executado no servidor e rejeitado antes de aplicar ordens; as 1.767 ordens permaneceram preservadas. Não foram inseridas ordens fictícias nem editados equipamentos reais para testar o aplicativo. Testes de mutação usam PostgreSQL isolado em memória.

Na fotografia verificada, a integração possuía 1.767 ordens: 697 presentes e 1.070 históricas encerradas por saída, com 609 programadas, 53 em andamento e 35 em outras situações entre as presentes. Esses totais são da integração completa, não de cada acompanhamento individual. A leitura como `anon` retornou todas as 1.767 ordens, 13 grupos e 229 frotas, sem truncamento em 1.000 registros.

O agendamento existente continua uma vez por minuto. Após a implantação, foi observada sincronização concluída em 08/11/2026 às 00:17:03, horário de Brasília, com `erro=null`, 697 ordens atuais e sem consulta presa em andamento. A configuração de `search_path` da função `set_updated_at` foi corrigida sem alterar seu comportamento.

## Achados corrigidos no aplicativo

A classificação conservadora rejeita identidades textuais conflitantes de cavalo/caminhão, reconhece **graxagem** como lubrificação e a flexão **reformando** como reforma. Lavagem ou troca de óleo isoladas não viram lubrificação; uma corretiva sem identificação não vira preventiva. Reformas continuam exigindo frota cadastrada no Apoio.

Foi corrigida a divergência em que uma ausência sem prova aparecia encerrada na tela, mas não aparecia ao filtrar encerradas. Agora essas inconsistências ficam em Outros e a contagem desse grupo acompanha a seleção. Situações derivadas, status bruto e motivo do encerramento são distintos e rastreáveis.

As consultas têm prazo de 15 segundos e a chamada de sincronização tem prazo de 30 segundos. Falhas liberam o estado de carregamento e uma tentativa falha não suprime silenciosamente a nova tentativa pelo throttle do navegador. As proteções compartilhadas do servidor contra concorrência continuam ativas. Resposta explícita `ok=false` é tratada como falha.

O Excel passou a normalizar filtros ausentes, como o PDF já fazia. Os dois formatos incluem toda a seleção, com textos longos, datas em Brasília, status bruto, critério de classificação e origem/data da detecção. Textos potencialmente interpretados como fórmulas são protegidos na exportação.

Foram ajustados alvos de toque da alternância de visualização e expansão da tabela para 44px, o contraste de foco e a legibilidade do botão de situação ativo. O visual dos três módulos segue a identidade premium do Controle Apoio: verde, dourado e marfim, cartões brancos opacos, frota destacada, quadrantes, narrativa e histórico factual.

## Testes e evidências

`npm run check` valida TypeScript. `npm run test:acompanhamento` cobre classificação, cronologia, status, filtros, recência, métricas, interface SSR, rotas, 24 cards por página e regressões dos achados. O teste de relatórios inclui 76 ordens, PDF multipágina com narrativa integral e Excel completo; o PDF do cenário teve dez páginas, com cabeçalho/rodapé verificados.

`npm run test:sql` usa PGlite/PostgreSQL em memória. Foram verificados presença, saída, reaparecimento, snapshot antigo/igual/inválido, leitura pública sob RLS, proteção das ordens, token de sincronização e fotografia completa acima de 1.000 registros. A migração nova foi exercitada nesse banco isolado, inclusive rejeição de campos omitidos.

A auditoria visual usa Chromium headless com dados sintéticos. Foram aprovados **54 cenários**, combinando Preventivas, Lubrificação e Reformas; temas claro, escuro e Glassy; larguras de 320, 390, 768, 1024, 1366 e 1920px. A sidebar foi considerada nas larguras de computador. Verificaram-se grade de uma/duas/três colunas conforme largura útil, logo carregado, cartões opacos, expansão de detalhes e ausência de overflow horizontal do documento. Foram testados filtro de encerradas, paginação, busca, limpar filtros e tabela no celular. Tipografia externa é bloqueada no teste; a fonte de fallback preserva a operação.

A extração PDF com worker local e os parsers de texto/Excel preservados são testados no Chromium com arquivos sintéticos, sem arquivos reais. Também foram executadas regressões de filtros/cadastro Apoio, datas em Brasília, recência e relatório legado. A compilação de produção é gerada por Vite; existe aviso de tamanho de chunk, não erro de compilação. A divisão adicional de módulos pode melhorar o carregamento em redes lentas.

## Dependências corrigidas

O diagnóstico inicial encontrou vulnerabilidades em PDF.js e SheetJS. PDF.js foi atualizado para **6.2.108**, versão corrigida indicada no aviso CVE-2026-16633. O importador utiliza a API de extração textual, sem instanciar um visualizador de scripts. SheetJS foi atualizado para **0.20.3**, distribuído pelo canal oficial e guardado em `vendor/xlsx-0.20.3.tgz`, com integridade no lockfile para instalação reproduzível. [1] [2]

Após a atualização, `npm audit --omit=dev` reportou **zero vulnerabilidades conhecidas** nas dependências de produção. Esse resultado é o diagnóstico do catálogo npm na data da auditoria, não uma garantia de inexistência de qualquer vulnerabilidade.

## Riscos de segurança ainda existentes

**A arquitetura recebida mantém partes do aplicativo públicas, sem autenticação.** O Supabase ainda aponta RLS desabilitada em `public.lavagem_lubrificacao` e funções PCM SECURITY DEFINER executáveis por usuários anônimos, incluindo classificação, edição e registro de execução. Cadastros Apoio também permitem edição pública segundo as políticas existentes. Isso permite leitura/alteração por quem tenha os identificadores públicos da integração, independentemente da aparência profissional da interface.

Essas permissões não foram revogadas unilateralmente, porque os módulos e os usuários atuais dependem delas e não foi definido um fluxo de login/perfis autorizado. A correção exige autenticação, definição de administradores/operadores/leitores e políticas RLS por perfil, seguida de migração do aplicativo para sessão autenticada. **Recomenda-se resolver essa pendência antes de ampliar a exposição pública do sistema.** [3] [4]

O Supabase também indica cinco índices ainda sem uso observado. Eles não foram removidos: ausência de uso no período observado não prova que sejam desnecessários, e sua exclusão não é requisito destes acompanhamentos.

## O que está aplicado e o que falta publicar

As duas migrações e a função de sincronização já estão implantadas no Supabase. A interface revisada está entregue como fontes e compilado, **mas não foi publicada na hospedagem existente**: não houve acesso autorizado à conta desse site. Para disponibilizá-la aos usuários, publique o conteúdo completo do ZIP compilado, preservando backup da versão anterior e sem misturar assets. Não reexecute os SQLs antigos ou a migração de renomeação.

Não é possível garantir funcionamento perfeito em todas as combinações reais. Os testes automatizados e as verificações do projeto confirmam os cenários descritos, mas não substituem acompanhamento operacional após a publicação, testes em todos os dispositivos físicos ou a correção das permissões públicas legadas.

## Referências

[1]: https://github.com/advisories/GHSA-hq66-cqwq-w95j "PDF.js — aviso oficial e versão corrigida"
[2]: https://docs.sheetjs.com/docs/getting-started/installation/nodejs/ "SheetJS — instalação e distribuição oficial"
[3]: https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public "Supabase — RLS desabilitada em esquema público"
[4]: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable "Supabase — funções privilegiadas executáveis anonimamente"
