# Automação PCM — Lavagem, Lubrificação e Troca de Óleo

## Funcionamento

A fonte é a Gestão de Ordens. O servidor consulta a lista a cada minuto pelo agendamento Supabase existente. O PCM publica as próprias atualizações; consultar a cada minuto não significa que o PIMS publique dados novos a cada minuto. A imagem fornecida informa atualização da fonte a cada 30 minutos.

A integração cruza o número da frota com o cadastro de equipamentos do Apoio. Somente frotas cadastradas nesse controle podem ter novas programações automáticas. Não é necessário cadastrar as mesmas frotas novamente na seção Lavagem e Lubrificação. Terceiros e ordens sem número de frota ficam fora.

Cada programação está vinculada à OS e à frota. Uma mesma frota pode ter ordens diferentes para lavagem/lubrificação e troca de óleo, sem que um serviço sobrescreva o outro. A Entrada informada pelo PCM define a data e o horário programados; a Previsão continua disponível como informação separada. O aplicativo calcula atraso a partir da data programada e conserva o status informado pelo PCM.

## Classificação

A lavagem semanal do lavador é reconhecida pelo setor/ponto e pela descrição do serviço. A preventiva de troca de óleo confirmada pelo usuário utiliza o plano 604 LUB / 604/302 no lavador. Outras preventivas não são presumidas como troca de óleo: passam por revisão quando não há identificação suficiente. Mencionar óleo em uma troca de tampa ou registradora não é o mesmo que executar troca de óleo.

Na seção Programações, o painel Programação automática · PCM → Apoio permite consultar o estado e revisar as ordens. A revisão apresenta frota, OS, grupo Apoio, setor, ponto, motivo, classe e narrativa. Você pode atribuir um serviço, retirar uma ordem dessa programação ou voltar à regra automática. Essas ações são compartilhadas e não alteram a ordem no PIMS.

## Encerramento e histórico

Uma ordem já importada que desaparece de uma nova lista completa, válida e atualizada passa a ENCERRADO, conforme a regra operacional solicitada. A razão é registrada como saída da listagem. O instante da detecção é separado da data real de execução: não é preenchida uma data de execução que o PIMS não forneceu. O histórico continua disponível; se a OS reaparecer, o mesmo lançamento é reativado sem duplicar.

Falha de conexão, dados vencidos, resposta truncada ou atualização mais antiga não encerram ordens. Ao remover uma frota do Apoio, sua participação automática é suspensa, sem apagar o histórico ou afirmar que o serviço foi feito. Uma ordem inicialmente ausente não é importada retroativamente como serviço realizado.

## Registros manuais e relatórios

Os registros manuais existentes são preservados. Não há fusão automática por coincidência de frota, tipo e data, pois isso poderia vincular um serviço à OS errada. A interface sinaliza possíveis coincidências para conferência. Ordens automáticas mostram a OS e a origem PCM; seus dados oficiais não podem ser sobrescritos por ações manuais de iniciar, adiar, concluir ou excluir. Para mudar o status oficial, o responsável deve atualizar a ordem no sistema do PCM.

Os relatórios continuam usando os estilos e os formatos existentes. As novas programações obedecem ao mesmo contrato de dados dos registros manuais. Na exportação, é possível escolher serviço, grupo Apoio, origem e semana, além dos filtros anteriores. A ocultação operacional de encerradas permanece; use Mostrar Encerradas para incluí-las. Nenhuma informação Fonte é reintroduzida nos relatórios premium do Apoio.

## Exemplos fornecidos

A frota 4508 tem duas ordens distintas: OS 159329765, Lavagem / Lubrificação, programada em 01/11/2026 às 07:00; e OS 159330811, Troca de Óleo, programada em 04/11/2026 às 07:00, com plano 604 LUB. A frota 4588 tem a OS 159331192 de lavagem semanal programada em 04/11/2026 às 07:00. Essas frotas já estavam cadastradas no Apoio; nenhuma frota foi acrescentada para simular o funcionamento.

## Publicação do aplicativo

O ZIP Netlify contém o aplicativo compilado, com index.html na raiz. Extraia e publique seu conteúdo no mesmo site https://controlelogisticalub.netlify.app/. O pacote de código-fonte contém também a migração e os testes. O estado final da instalação no Supabase será informado na entrega; a publicação da nova interface no Netlify depende de republicar o ZIP e não é presumida por esta documentação.

## Verificações dos relatórios

Os geradores e desenhos de PDF e PNG foram comparados com a versão anterior. As imagens geradas com as três OS reais fornecidas foram idênticas em 33 combinações de 11 temas e 3 formatos. Os geradores premium do Apoio não foram modificados. A nova seleção de semana foi testada para não incluir 01/11 na semana 02/11–08/11; para cobrar essa lavagem atrasada, deixe a semana em branco ou selecione o período anterior.

## Estado da instalação — 04/11/2026

A migração PCM foi aplicada com sucesso no projeto qcpnnyqzosnomvvytmfi e a função sync-ordens foi publicada na versão 3. O agendamento apoio-sync-ordens permanece ativo, com expressão de minuto em minuto, sem criar outro agendamento concorrente. A consulta automática das 10:25 importou 45 programações próprias, com 976 registros manuais preservados e assinatura idêntica à cópia prévia. Nenhuma ordem de frota fora do Apoio foi importada. O acesso público carregou 1021 registros por inteiro, evitando corte em 1000.

As três OS fornecidas foram conferidas no banco real:4508/159329765 lavagem 01/11,4508/159330811 troca de óleo 04/11 e 4588/159331192 lavagem 04/11, todas com horário 07:00 e sem data de execução inventada. A interface nova deve ser republicada no Netlify; não é necessário executar novamente a instalação do Supabase.

Para testes locais isolados: execute node tests/pcm-client.test.cjs e node tests/pcm-report-regression.cjs. O SQL usa PostgreSQL em memória: instale @electric-sql/pglite sem salvar dependência de produção e execute node tests/pcm-sql.test.cjs. Os scripts com live-readonly no nome consultam o projeto configurado, sem inserir dados; o teste da interface bloqueia qualquer gravação remota.

A interface compilada foi conferida com leitura real nos modos desktop e celular. O filtro semanal preservou a troca de óleo 04/11 e retirou a lavagem atrasada 01/11 da seleção 02/11–08/11, sem apagar o registro. Foram identificadas 12 candidatas para revisão, incluindo preventivas sem regra segura e coincidências com lançamentos manuais; não foram assumidas como serviços executados.

## Atualização da exportação diária

A regra atual da exportação de Lavagem/Lubrificação está em RELATORIO_DIARIO_0600.md e substitui a seleção de semana/período desta tela: todos os atrasados mais programados do dia atual até06:00 do dia seguinte, pelo horário de Brasília. Os filtros de semana permanecem na Programação, mas não limitam mais o relatório diário. Os geradores visuais foram preservados.
