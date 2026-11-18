# Resultados solicitados

- [x] Preservar Gestão de Ordens Manutenção como primeiro menu e site incorporado.
- [x] Adicionar o código do controle próprio compartilhado e público, com grupos criados pelo usuário na coluna Apoio, como Veículos Leves, Caminhão Munck e Caminhão Pipa, relacionando cada número de frota ao grupo definido e excluindo do controle equipamentos não cadastrados como próprios.
- [x] Implementar a consulta automática de minuto em minuto no servidor, com agendamento nativo, data real da fonte, lease/token contra concorrência e falhas sem apagar o controle.
- [x] Ativar a integração no Supabase remoto: SQL aplicado, sync-ordens publicada, Vault configurado, origem Netlify autorizada e cron de um minuto ativo. Execução automática importou 666 ordens sem erros, confirmada em 03/11/2026.
- [x] Filtrar as ordens por grupos Apoio e frota, Oficina Interna ou Oficina Externa e prestador, Programada, Andamento ou Aguardando Peça; mostrar o nome da oficina externa quando disponível.
- [x] Retirar da visão aberta ordens ausentes em snapshot válido e preservar histórico como Não consta mais na fonte, sem inventar data ou confirmação de finalização.
- [x] Exportar relatório PDF premium com logotipo da empresa, cabeçalho robusto, agrupamento, identificação do grupo nas páginas de continuação e todos os filtros aplicados, além de planilha de apoio.
- [x] Verificar integração do código, regras de reconciliação, acesso público com ordens somente leitura, filtros e exportação: build passou, TypeScript sem novos diagnósticos, validador e filtros testados, SQL executado em PostgreSQL isolado incluindo 1.052 registros, concorrência e reativação; PDF com amostra real inspecionado. Revisão independente concluída e falhas materiais corrigidas.
