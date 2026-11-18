# Auditoria v10.15 — Tabela em retrato

## Causa confirmada no site

O site publicado estava em v10.14 e a opção Tabela era selecionada corretamente. Porém, operational-compact.css tinha um bloco responsivo legado abaixo de 720 px com seletores mais específicos que os estilos novos. Ele convertia a tabela em blocos/grid, escondia o cabeçalho de colunas e gerava rótulos dentro das células. Por isso o celular em pé não mostrava o formato pedido, mesmo com Tabela selecionada.

O primeiro teste no site real, em 390 px, encontrou table=block, thead=block, linha=grid e célula=grid. Uma alteração temporária de CSS apenas no navegador de teste, sem persistir nada no Netlify/Supabase, confirmou a restauração: table=table, thead=table-header-group, linha=table-row, célula=table-cell, cabeçalho com 1040 px e rolagem horizontal auto.

## Correção e escopo

Os seletores antigos de conversão móvel passam a excluir o módulo atual .lub-operations-v1011. A alteração vale somente no bloco legado abaixo de 720 px e no ajuste de 360 px. Os estilos restantes foram comparados com as fontes 10.14 e são idênticos. A única outra alteração no código do aplicativo é a identificação de versão no menu.

Nenhum comportamento de ordem, imagem, relatório, autenticação, relógio ou banco foi alterado. Cartões/Quadro continuam disponíveis por seleção explícita. Tabela continua padrão em cada abertura móvel. O cabeçalho geral e demais módulos permanecem iguais.

## Teste com o layout completo

O novo harness reproduz o ancestral real .app-shell--lub > main > .lavagem-premium > .lavagem-premium-body > .lub-module.lub-operations-v1011, o componente real de tabela e 70 ordens sintéticas. Ele inclui os estilos de índice, temas, shell, Lavagem, compactação operacional, tabela móvel e imagens. Isso evita a limitação dos testes antigos que verificavam o componente sem o contêiner e a cascata completos.

Foram aprovados 8 cenários:390/428 px em retrato,844 px em paisagem e 1366 px em computador, nos modos claro e escuro. No baseline legado em 390 px, havia tabela em bloco, cabeçalho em bloco, corpo/linhas/células em grid, rótulos gerados por pseudo-elementos e células fora da mesma linha. Depois, os displays são table/table-header-group/table-row-group/table-row/table-cell, sem rótulos duplicados nem bordas de cartões, e com células alinhadas na mesma linha.

| Largura | Rolagem horizontal validada | Ações |
|---|---|---|
| 390 px | scrollLeft 0 → 354 px | Visíveis ao deslizar até o fim |
| 428 px | scrollLeft 0 → 357 px | Visíveis ao deslizar até o fim |
|844 px | scrollLeft 0 → 196 px | Visíveis ao deslizar até o fim |
| 1366 px | Não necessária | Já visíveis |

A rolagem vertical moveu a página cerca de 395–409 px nos cenários testados. A regra de toque continua pan-x pan-y pinch-zoom. O gesto real de pinça já validado na v10.13 não precisou de nova implementação; essa declaração permaneceu inalterada.

## Entrega e limites

Passaram testes de layout completo, lista padrão, tabela/ações, compactação e TypeScript. O build v10.15 foi gerado. A correção não foi publicada automaticamente: é preciso republicar o compilado completo no Netlify e recarregar sem cache.

Os testes usam Chromium e dados sintéticos, com rede externa bloqueada. A correção também foi comprovada temporariamente contra o site publicado, mas não substitui uma verificação posterior à republicação. Em telas estreitas, as sete colunas continuam acessíveis por rolagem horizontal; elas não são comprimidas a ponto de reduzir a legibilidade.
