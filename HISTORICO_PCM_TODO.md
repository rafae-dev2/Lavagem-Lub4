# Histórico e organização PCM

- [x] Quando uma OS automática deixar a listagem válida do PCM, manter ENCERRADO sem apagar a linha e guardar a data/hora de detecção. Disponibilizar histórico de Lavagem/Lubrificação e Troca de Óleo, com frota, OS, tipo, grupo e datas.
- [x] Distinguir encerramento detectado da execução efetiva: ausência na fonte não prova a data de execução. Permitir registrar uma data de execução confirmada em OS automática encerrada, mantendo trilha de auditoria e a data de detecção intacta.
- [x] Retirar lançamentos manuais ativos repetidos de frotas/tipos que já têm OS automática, arquivando sem excluir dados. Preservar registros manuais concluídos históricos e todas as OS automáticas distintas, mesmo da mesma frota.
- [x] Ordenar por data programada crescente: mais atrasadas primeiro e datas futuras em sequência; horário como desempate. Aplicar ao controle e aos relatórios, preservando escolhas explícitas de ordenação na tabela.
- [x] Preservar o visual dos relatórios e a seleção diária de todos os atrasados mais programados do dia atual até06:00 inclusive do dia seguinte. Manuais arquivados não entram na lista ativa, nos totais nem no relatório diário.
- [x] Aplicar e verificar a atualização autorizada no Supabase, sem dados de teste em produção, e entregar os pacotes Netlify e fonte atualizados.
