# Visibilidade de Lavagem/Lubrificação v10.4

- [x] Ocultar Carretas Canavieiras, Trator Transbordo, Colhedoras e Carretas Rodomuda somente no conjunto de Lavagem/Lubrificação, para controlar os demais equipamentos.
- [x] Aplicar seleção consistente na programação/tabela/quadro, filtros, histórico/revisão PCM de Lavagem, Dashboard/alertas, calendário e relatórios. Mostrar encerradas não deve revelar os grupos ocultos.
- [x] Preservar registros, histórico, classificação PCM, sincronização, status e os módulos de Apoio, Gestão de Ordens, Preventivas/Lubrificação Canavieiras e todos os controles de reforma. Não excluir nem suspender ordens no Supabase.
- [x] Manter Trator Reboque, caminhões e outros grupos disponíveis. Identificar pelo grupo informado no cadastro/metadata; usar mapas exatos conhecidos para legados sem grupo, sem dividir Trator Geral arbitrariamente.
- [x] Validar a regra para registros PCM e manuais, abertos e encerrados, e entregar fontes/compilado atualizados com instruções.

## Evidências

Teste de escopo aprovado para quatro grupos, variantes de nomes, PCM/manual, abertos/encerrados, mapas exatos, Trator Reboque/Geral preservados e não mutação. Revisão da integração, TypeScript, regressões dos acompanhamentos/Apoio/encerradas e build aprovados. Registros e fonte compartilhada não foram alterados; publicação exige subir o compilado completo.
