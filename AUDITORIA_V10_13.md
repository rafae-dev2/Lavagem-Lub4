# Auditoria v10.13 — lista padrão e zoom por pinça

## Escopo confirmado

A pedido do usuário, o modo lista/tabela é a visualização inicial de Lavagem / Lubrificação no celular. Não foi aplicada redução de cabeçalho. A preferência antiga de Expandir/Minimizar permaneceu intacta, assim como filtros, cartões, quadro, edição, imagens e encerramentos.

## Zoom por pinça

A tabela utilizava `touch-action: pan-x pan-y`, que libera deslocamento nos dois eixos, mas não libera pinch-zoom. A regra passou a `touch-action: pan-x pan-y pinch-zoom`. O viewport da aplicação já não continha bloqueio de zoom e foi preservado.

A validação utilizou Chromium, emulação móvel com toque habilitado, o componente real de tabela e 70 linhas sintéticas. Foram enviados eventos de toque com dois dedos pelo Chrome DevTools Protocol, não uma simples alteração programática da escala. A comparação anterior foi feita com override temporário de CSS apenas no harness local.

| Verificação | Retrato 390 × 844 | Paisagem 844 × 390 |
|---|---|---|
| Regra anterior, gesto de pinça | Escala permaneceu 1 | Escala permaneceu 1 |
| Regra corrigida, mesmo gesto | Escala passou para 2,6253 | Escala passou para 2,6253 |
| Rolagem horizontal | scrollLeft 0 → 312 px | scrollLeft 0 → 244 px |
| Rolagem vertical da área visível | Deslocamento de 375 px | Deslocamento de 241 px |
| Erros JavaScript | Nenhum | Nenhum |

O Chromium pode serializar a regra combinada como `manipulation` em `getComputedStyle`. O teste confere também a declaração efetiva da stylesheet contendo `pinch-zoom` e o aumento real da escala.

## Lista padrão no celular

A chave móvel `bp_prog_mobile_view_mode` foi separada da chave existente do computador `bp_prog_view_mode`. O primeiro acesso móvel à nova versão inicia em tabela, sem herdar Cartões/Quadro da preferência antiga. Escolhas posteriores no celular são persistidas. O escopo é capturado ao abrir o módulo, evitando mudanças de visualização durante zoom ou rotação.

O teste cobre celular em retrato, dispositivo sensível ao toque em paisagem, persistência de Cartões/Quadro, preservação da escolha desktop, armazenamento bloqueado e renderização sem window. A preferência `bp_prog_compact` não foi alterada.

## Regressões e entrega

Passaram TypeScript, testes de lista móvel, tabela/cartões, relógio operacional, corte 07:10, encerramentos compartilhados, ações e compactação. A compilação final v10.13 foi gerada com sucesso. As 13 imagens transparentes e demais funcionalidades anteriores permanecem incluídas.

Não foram executadas gravações em ordens reais, mudanças de autenticação ou migrações. O navegador do teste bloqueia toda rede externa ao localhost. O comportamento foi validado no Chromium; limites de ampliação podem variar conforme navegador e dispositivo.

A versão só entra no site depois de publicar o compilado completo no Netlify. Os testes e comandos reproduzíveis estão incluídos nas fontes, em `programacao-view-preference.test.cjs` e `lavagem-pinch-zoom-*`.
