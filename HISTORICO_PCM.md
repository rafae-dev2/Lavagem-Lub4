# Histórico de serviços e organização das ordens PCM

## Ordens encerradas não são apagadas

Quando uma OS automática deixa uma atualização válida da Gestão de Ordens, o controle de Lavagem/Lubrificação ou Troca de Óleo passa a ENCERRADO. A linha permanece armazenada com frota, número da OS, serviço, grupo Apoio e data/hora em que a saída da listagem foi detectada. Falhas de consulta não são tratadas como encerramento. Se a mesma OS reaparecer, o controle reabre a mesma linha e conserva os eventos anteriores na auditoria.

O botão Histórico de Encerradas permite consultar os registros encerrados, mesmo quando o controle diário oculta encerradas antigas. Os lançamentos manuais arquivados também podem ser consultados, com identificação de que foram substituídos pelo controle automático, e não executados por esse motivo.

## Encerramento detectado e execução confirmada

O desaparecimento da OS informa que ela saiu da listagem de abertas; não fornece a data exata em que a lavagem, a lubrificação ou a troca de óleo ocorreu. Por isso, o histórico separa o encerramento detectado da execução confirmada. Enquanto não houver confirmação, a data de execução fica A confirmar, sem informação inventada.

Para uma OS automática encerrada, Registrar execução permite informar a data efetiva, com uma observação opcional. A confirmação fica compartilhada no Supabase e gera um evento de auditoria, sem alterar a data em que o encerramento foi detectado. Não é permitido confirmar uma data futura nem registrar execução em uma OS automática ainda aberta. Se a OS reabrir, os campos de execução do ciclo atual são limpos; a confirmação anterior continua registrada na auditoria.

## Manuais repetidos fora do controle ativo

Um lançamento manual ativo é arquivado quando já existe controle automático para a mesma frota e o mesmo tipo de serviço. Assim, não permanece repetido na lista ativa, nos totais nem no relatório diário. O arquivamento não apaga o lançamento nem modifica as suas informações originais. Registros manuais concluídos do passado são preservados.

Duas OS automáticas diferentes não são duplicadas só por pertencerem à mesma frota: elas continuam independentes. Lavagem/Lubrificação e Troca de Óleo também não são mescladas.

## Datas organizadas e relatório preservado

A ordenação padrão passa a ser crescente pela data programada: primeiro as mais atrasadas, depois as datas seguintes e, por fim, as futuras em sequência. O horário é usado para desempatar. Datas ausentes ou inválidas ficam por último. A tabela continua permitindo escolher explicitamente outra ordenação.

O relatório PDF e as imagens mantêm o visual existente e a seleção diária: todos os atrasados mais programados do dia atual até as 06:00 inclusive do dia seguinte, no horário de Brasília. Manuais arquivados não entram. Encerradas são consultadas no histórico, não nesse relatório de cobrança diária.

## Publicação

Após a configuração correspondente no Supabase, publique no mesmo site Netlify o ZIP atualizado, extraindo a pasta que contém o index.html. A interface e o código-fonte entregues incluem também as atualizações anteriores do relatório diário até as 06:00.

A visualização padrão de Programações e da exportação diária utiliza a origem Automáticas · PCM. Assim, o controle principal abre apenas com ordens automáticas das frotas Apoio. O acesso explícito aos manuais e ao histórico continua disponível, sem eliminar informações antigas nem manuais únicos que não tenham correspondente automático.

## Instalação confirmada — 04/11/2026

A migração foi aplicada com sucesso no projeto qcpnnyqzosnomvvytmfi. Foram arquivados 11 manuais ativos repetidos, sem arquivar manuais concluídos nem apagar registros. Permanecem 976 registros manuais no banco e 45 OS automáticas independentes. A assinatura das informações originais dos manuais é idêntica à anterior. A leitura pública confirmou 1010 registros na lista sem arquivados e 971 registros no histórico completo. O agendamento de minuto em minuto continua ativo; a fonte válida estava atualizada às 11:40 e a consulta das 11:42 estava sem erro. Não foram gravadas execuções fictícias para teste.

A confirmação de execução, a conservação do encerramento e a reabertura foram testadas em PostgreSQL isolado. O corpo completo dos geradores PNG/PDF permaneceu igual, com ordenação e seleção dos dados atualizadas. Para ativar a nova interface, basta republicar o pacote Netlify; não é necessário repetir a instalação do Supabase.
