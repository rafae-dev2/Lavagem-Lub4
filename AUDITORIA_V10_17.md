# Auditoria v 10.17 — reconhecimento de 302LUB

A comparação SQL real mostrou que a frota 4585/OS 159332724 estava ativa, em Andamento, cadastrada como Caminhão Munck, sem override e sem registro no planejamento. A classificação devolvia revisao_ambigua para 302LUB. A frota 4626/OS 159332726 estava ativa e Programada, já classificada como Troca de Óleo pela regra plano_604_lub_lavador: sua narrativa inclui 1812/906/604/302.

Foi aplicada com sucesso a migração pcm_recognize_302_lub_oil_plan, que altera somente pcm_classificar_fonte. A correspondência adicional exige palavra 302LUB, permitindo espaço entre número e LUB, no ponto Lavador. As regras anteriores e os parâmetros/ACL da função foram mantidos. Não houve alteração do reconciliador, triggers, política de acesso, campos de edição, relógio, filtro de frotas ocultas ou interface dos demais módulos.

A função reconciliar_pcm implantada foi inspecionada antes de sua execução. Suas proteções de fotografia válida, classificação manual, edições por campo, execução e encerramento foram preservadas; foi executada a rotina existente após a migração, sem inserir uma ordem duplicada ou um override artificial. Novas ordens elegíveis do mesmo plano passam a seguir a regra corrigida na sincronização normal.

Depois da aplicação, ambas as OS foram confirmadas na consulta carregar_lavagem_programacoes:4585/159332724 como Troca de Óleo, ANDAMENTO,09/11/2026 às 00:00;4626/159332726 como Troca de Óleo, PROGRAMADO,15/11/2026 às 07:00. Nas duas: pcm_suspenso=false, exatamente um registro por chave, data_realizada=null, pcm_encerrado_em=null, sem edição manual adicionada.

A regressão isolada PGlite validou 302LUB e 302 LUB no Lavador, limites de palavra, exclusão de 1302LUB/302LUBX/número isolado 302, plano 605LUB/preventiva genérica, contexto Oficina/100, manutenção da regra 604LUB/604/302 e texto explícito de óleo. O cenário integrado com as duas OS validou importação correta, ausência de duplicação, registro manual preservado e encerramento/reabertura da mesma linha.

Também passaram as regressões PCM SQL, PCM_EDICAO_PREMIUM, PCM_HISTORICO, TypeScript e build v 10.17. O texto da revisão da classificação foi atualizado no compilado; esse texto exige republicação para mudar no Netlify, mas a correção do servidor já está ativa. Não se afirma que um navegador do usuário com filtros locais restritivos já exibiu a ordem: nesse caso deve atualizar a consulta e limpar filtros incompatíveis.
