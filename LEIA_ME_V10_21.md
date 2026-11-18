# v10.21 — Correção da lupa na busca do Apoio

Corrigida a sobreposição da lupa com o número digitado no campo de pesquisa. O estilo antigo posicionava o ícone de forma absoluta dentro do input; agora a lupa ocupa seu próprio espaço ao lado do texto e o campo usa o espaço restante, sem encobrir os caracteres.

A posição da busca permanece abaixo de “Filtros de acompanhamento”, antes das abas, e a barra acompanha a rolagem normal da tela.

## Publicação

Publique no Netlify o conteúdo integral do ZIP compilado da **v10.21**, com `index.html` na raiz. Faça uma recarga forçada após a publicação para descartar CSS antigo em cache. Confirme `v10.21` no menu lateral. Não reutilize ZIPs v10.19 ou v10.20.

Não é necessária alteração no Supabase nem nos dados.

## Verificação

A validação visual mede a posição do ícone e do campo depois de digitar um valor de frota em celular, tablet, desktop e paisagem. Também verifica a ordem filtros → busca → abas, a rolagem junto do conteúdo, o funcionamento da pesquisa e da limpeza e a ausência de overflow horizontal.
