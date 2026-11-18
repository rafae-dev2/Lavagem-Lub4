# Aplicativo Controle Apoio — integração ativa

O Supabase já foi configurado no projeto qcpnnyqzosnomvvytmfi. A função de sincronização e o agendamento de um minuto estão ativos. O aplicativo autorizado é https://controlelogisticalub.netlify.app. Consulte CONFIGURACAO_SUPABASE.md para os detalhes e verificações.

Abra o menu Controle de Equipamentos — Apoio e crie seus grupos e frotas. Os cadastros são compartilhados e públicos, sem login. As ordens da fonte são somente leitura e incluem Programada, Andamento, Aguardando Peça e demais status informados. Você pode filtrar por grupo, frota, oficina interna/externa, prestador e status, e exportar PDF corporativo com logotipo ou Excel.

Somente as frotas cadastradas entram no controle próprio. Nenhuma frota foi cadastrada automaticamente. Ordens sem frota informada são preservadas separadamente e não podem ser classificadas como equipamentos próprios.

Este ZIP inclui o código-fonte e dist compilado com uma melhoria visual para ordens sem frota. Se desejar essa melhoria, publique o conteúdo de dist no mesmo site Netlify. O backend já funciona, sem precisar executar novamente o SQL. A hospedagem Netlify não foi alterada nesta tarefa.

Gestão de Ordens Manutenção permanece como primeiro menu, abrindo o site original dentro do aplicativo. Os módulos antigos foram preservados.

A consulta de um minuto acompanha os dados disponíveis, sem acelerar a publicação pela fonte. Uma ordem ausente passa ao histórico sem confirmação de finalização. Falhas não apagam dados e reaparecimentos não duplicam a ordem.

A compilação passou e o TypeScript mantém apenas os três diagnósticos preexistentes de ManutencaoEquipamentos.tsx. Os testes de filtros e SQL isolado foram executados. Nenhuma chave privada ou senha está incluída no pacote.
