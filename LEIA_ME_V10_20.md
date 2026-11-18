# v10.20 — Busca abaixo de Filtros de acompanhamento

A barra “Pesquisar frota, OS ou narrativa” fica logo após o bloco “Filtros de acompanhamento” e antes das abas de situação das ordens. Ela está dentro do conteúdo principal, não no cabeçalho, e acompanha a rolagem normal da tela para cima e para baixo.

O campo de busca, o botão “Limpar busca” e a contagem continuam funcionando. Em telas estreitas, o layout se adapta sem criar rolagem horizontal. A busca aparece somente na lista de ordens do Controle de Equipamentos — Apoio.

## Publicação

Para aplicar esta alteração no site, publique o conteúdo do ZIP compilado da **v10.20** no Netlify, com `index.html` na raiz da publicação. Depois, faça uma recarga forçada da página para não reutilizar os arquivos antigos do navegador. Não use o ZIP compilado v10.19: ele pode manter a busca no cabeçalho. Na versão nova, o menu lateral mostra `v10.20` e a busca aparece abaixo de “Filtros de acompanhamento”.

Não é necessária migração do Supabase nem alteração dos dados.

## Verificação

Validar a versão-fonte com `npm ci`, `npm run check`, `npm run test:pesquisa-fixa` e `npm run build`. O teste visual verifica a ordem filtros → busca → abas, o posicionamento dentro do conteúdo rolável e a movimentação da barra em rolagens para cima e para baixo em celular, tablet, desktop e paisagem.
