# Correção de encerradas e sincronização — v10.2

- [x] Investigar erro “Failed to send a request to the Edge Function” mostrado no celular e corrigir autorização do domínio exato do site, preservando as origens existentes e sem liberar wildcard. Aguardar URL exato quando a captura não permitir transcrição confiável.
- [x] Novos módulos e Controle Apoio devem utilizar a mesma interpretação de encerramento por saída validada da fonte usada na integração PCM de Lavagem/Lubrificação; preservar status bruto e não preencher execução manual com detecção automática.
- [x] Novos módulos devem reutilizar o corte operacional 07:10 Brasília e a preferência de ocultação existentes em Lavagem/Lubrificação: encerradas antigas ocultas por padrão, recentes mantidas e botão Mostrar encerradas para consultar todas.
- [x] Encerradas dos módulos recém-adicionados devem ter destaque robusto, faixa/selo explícito, motivo/origem, data de detecção e última presença; filtros, indicadores e relatórios devem refletir a mesma seleção.
- [x] Validar defeito CORS real, ocultação/exibição, reabertura, relatórios e responsividade de celular, computador e tablet; entregar fontes e compilado revisados e distinguir correção Supabase aplicada da publicação de interface.

## Fechamento

Domínio confirmado pelo usuário: https://controlelogisticalub.netlify.app. Já autorizado; site200, preflight204, POST200/ok=true e navegador390px sem alerta. Não foram alterados allowlist/segredos/RLS nesta revisão. Acesso pelo endereço diferente das capturas não é autorizado.

Codechecks, encerradas/visibilidade, relatórios e SQL isolado aprovados. Teste do botão nos três módulos: oito encerradas sintéticas selecionadas, filtro de atraso removido e retorno à operação sem overflow390px. UIvisuais delegadas:54cenários novos módulos e8ControleApoio. A publicação da v10.2 ainda depende de subir o compilado no Netlify.
