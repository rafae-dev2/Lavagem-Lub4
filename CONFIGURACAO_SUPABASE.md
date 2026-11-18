# Controle Apoio — Supabase configurado

Configuração concluída em 03/11/2026 no projeto qcpnnyqzosnomvvytmfi, usando o acesso Supabase autorizado pelo usuário. A senha compartilhada no chat não foi usada para acessar a conta e não consta dos arquivos de entrega.

## Instalação confirmada

As tabelas apoio_grupos, apoio_frotas, apoio_ordens e apoio_sync foram criadas. As funções de carregamento consistente, sincronização, reconciliação e proteção contra consultas concorrentes foram instaladas. As ordens importadas são somente leitura para o acesso público; os grupos e as frotas podem ser editados publicamente, como solicitado.

A função sync-ordens foi publicada e está ACTIVE, versão 2 no momento da confirmação. A configuração privada está no Supabase Vault e só é lida pelo servidor usando service_role. Nenhuma chave privada foi colocada no aplicativo ou neste pacote.

O agendamento apoio-sync-ordens está ativo com expressão * * * * *, consultando a fonte uma vez por minuto. As execuções nativas das 14:51, 14:52 e 14:53 foram confirmadas. A execução das 14:53 importou 666 ordens, com data de atualização da fonte de 03/11/2026 às 14:40:02, e apoio_sync.erro ficou vazio. Os horários deste registro são de Brasília.

O endereço https://controlelogisticalub.netlify.app foi liberado para consultas do navegador. O servidor respondeu com HTTP 200 e Access-Control-Allow-Origin correspondente ao domínio Netlify. A leitura via chave pública utilizada pelo aplicativo retornou as 666 ordens, comprovando o caminho de consulta do frontend.

## Equipamentos não informados

A fonte continha dez ordens sem número de frota. Elas foram preservadas com a indicação explícita SEM-FROTA, que não representa um equipamento real. O cadastro dessa indicação como frota própria é bloqueado. Elas não impedem a importação das demais ordens. Uma OS que perder a identificação do equipamento não provoca baixa automática de uma frota conhecida com a mesma OS.

A atualização do aplicativo neste pacote melhora a apresentação desse caso como Sem frota informada. A configuração do Supabase já está ativa e não exige executar novamente o SQL.

## Próximos passos do usuário

Abra https://controlelogisticalub.netlify.app e entre em Controle de Equipamentos — Apoio. Use Grupos Apoio e nossas frotas para criar os grupos e vincular os números de frota que são de vocês. Nenhum grupo ou equipamento de exemplo foi cadastrado; antes desse cadastro, a visão de equipamentos próprios ficará vazia e as ordens aparecerão em Não cadastradas — classificar.

Se quiser instalar a melhoria visual para as ordens sem frota, publique o conteúdo da pasta dist deste pacote no mesmo site Netlify. A hospedagem Netlify não foi alterada nesta tarefa.

A consulta de minuto em minuto busca o conjunto disponível no site; ela não faz a fonte publicar novos dados mais rapidamente. As datas da fonte e da última consulta ficam visíveis. Ordens ausentes ficam no histórico sem alegação de finalização.

## Acesso público e módulo anterior

A classificação Apoio ficou pública, sem login, conforme autorização expressa. Qualquer pessoa com acesso ao aplicativo/API pública pode consultar e editar grupos e frotas.

A tabela preexistente lavagem_lubrificacao continua com RLS desativada, como estava antes da instalação. Isso permite que qualquer pessoa com a chave pública consulte e modifique os registros desse módulo. Não alterei essa proteção para evitar bloquear o aplicativo antigo. Referência sobre RLS: https://supabase.com/docs/guides/database/postgres/row-level-security.

A configuração não criou novo projeto, não mudou plano de cobrança e não alterou dados ou ordens do site PIMS.
