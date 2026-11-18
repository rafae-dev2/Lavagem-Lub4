# Automação PCM

- [x] Importar automaticamente somente ordens das frotas cadastradas no Apoio, sem cadastrar novamente em Lavagem e Lubrificação; excluir terceiros e equipamentos sem frota.
- [x] Manter ordens separadas por frota e OS e serviços Lavagem/Lubrificação e Troca de Óleo, reconhecendo os exemplos 4508/159329765, 4508/159330811 plano604LUB e 4588/159331192, com revisão de casos ambíguos.
- [x] Usar Entrada como data/horário PCM, mostrar atrasada01/11 e preventiva04/11; filtros por grupo Apoio, semana, serviço e origem.
- [x] Atualizar no servidor com aplicativo fechado, sem duplicar; programada/andamento espelham PCM e atraso é calculado sem ocultar estado original.
- [x] Encerrar automaticamente ao desaparecer de atualização válida, manter histórico e motivo de saída da listagem, data de detecção separada de execução; falha ou dados antigos não encerram, reaparecimento reativa.
- [x] Preservar registros manuais existentes e proteger ordens automáticas de edição/exclusão acidental; não apagar ao remover frota do Apoio.
- [x] Manter exportações existentes corretamente, mesmos formatos, estilos, filtros e contrato de dados; verificar com ordens reais sem inserir dados de teste em produção.
- [x] Instalar integração no Supabase autorizado, conferir importação real e entregar aplicativo compilado pronto para Netlify com instruções da nova funcionalidade.
