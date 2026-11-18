# Atualização automática de Lavagem e Lubrificação

- [ ] Confirmar os casos relatados por frota/OS, distinguindo estado no banco de estado exibido no navegador. Não concluir ordens manualmente só porque desapareceram de uma lista filtrada.
- [x] Habilitar Realtime em lavagem_lubrificacao sem alterar registros ou permissões e validar a assinatura somente leitura.
- [x] Eventos recebidos durante uma leitura precisam disparar nova leitura ao terminar, sem serem descartados pelo lock. Retomar leitura fresca ao reconectar, ao voltar à aba e ao recuperar a rede, preservando o intervalo de segurança de15 segundos.
- [x] Testar transição automática ANDAMENTO → ENCERRADO com mocks isolados, mantendo observação, data e proteção de alterações locais. Entregar fontes/compilado completos e diagnóstico com evidências e limites.
