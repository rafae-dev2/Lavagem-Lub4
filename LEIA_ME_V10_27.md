# v10.27 — Logotipo transparente, relatórios em imagem visíveis e filtros do relatório
Três ajustes no **Controle de Equipamentos — Apoio**, sem mudança de dados:
## 1. Logotipo premium no cabeçalho do relatório
O cabeçalho do **Equipamentos em Oficina de Terceiros** não usa mais a caixa branca arredondada. O logotipo PNG (já transparente) aparece direto sobre o verde, no mesmo estilo do cabeçalho do PDF, com sombra suave e tamanho maior.
## 2. Painel Relatórios em imagem sempre visível
Os controles de imagem saíram de dentro de **Relatórios e atualização** e agora ficam em um painel **Relatórios em imagem**, aberto por padrão logo acima da lista de ordens. Ele traz dois cartões: **Equipamentos em Oficina de Terceiros** (PNG 921 × 1600) e **Imagem premium** (formato e qualidade). O painel pode ser recolhido pelo próprio título; PDF, Excel e WhatsApp continuam em Relatórios e atualização.
## 3. Filtros próprios do relatório
No cartão de oficina de terceiros há **Pesquisar equipamento ou oficina** (frota, modelo ou prestador, sem diferenciar acento/caixa) e **Oficina de terceiro** (seleção múltipla com contagem). Os filtros valem só para o PNG: a lista de ordens abaixo não muda. O cartão mostra quantos equipamentos sairão (“x de y equipamentos no PNG”), uma prévia dos primeiros registros com frota, modelo e oficina, e o botão **Limpar filtros do relatório**.
## Publicação
Publique no Netlify todo o conteúdo do ZIP compilado da **v10.27**, com `index.html` na raiz; depois, faça uma recarga forçada e confirme `v10.27` no menu lateral. Esta versão inclui a v10.26 (relatório de oficina de terceiros) e a v10.25 (Carreta Tanque Vinhaça fora da Lavagem/Lubrificação).
## Verificação
`npm run test:oficina-terceiros` passou: seleção e filtros (busca por frota/modelo/oficina, seleção de oficinas, combinação e limpeza), PNG 921 × 1600 com logotipo transparente (pixels do canto do antigo quadro conferidos no verde do cabeçalho), paginação em ZIP e teste de interface com o painel aberto, filtro aplicado e download do PNG filtrado. `npm run check` e `npm run build` passaram.
