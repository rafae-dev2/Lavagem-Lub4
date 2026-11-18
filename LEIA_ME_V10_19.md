# v10.19 — Ajuste da busca no Controle de Equipamentos — Apoio

A barra “Pesquisar frota, OS ou narrativa” voltou ao fluxo normal do conteúdo de Controle de Equipamentos — Apoio. Ela aparece depois dos filtros e indicadores e antes das abas de situação das ordens, alinhada com a área principal da página. Não fica mais numa faixa separada logo abaixo do cabeçalho nem atrás da navegação lateral expandida.

A pesquisa continua filtrando por frota, OS e narrativa; “Limpar busca” e a contagem permanecem no mesmo campo. A barra rola junto com o conteúdo e segue responsiva: em telas estreitas, o botão e a contagem se ajustam sem criar rolagem horizontal. A pesquisa só é renderizada na aba de ordens do Apoio.

## Como ativar no site

Esta correção é da interface e precisa ser publicada no Netlify. Extraia TODO o ZIP compilado corrigido e publique seu conteúdo, com `index.html` na raiz. Depois recarregue o aplicativo. Não é necessária migração SQL, mudança no Supabase ou atualização das ordens. As regras gerais dos planos LUB da versão 18 continuam no servidor e nas fontes desta versão.

## Verificação

A versão-fonte pode ser validada com `npm ci`, `npm run check`, `npm run test:pesquisa-fixa` e `npm run build`. O teste visual cobre celular, tablet, desktop e paisagem; verifica a posição dentro da página, a rolagem junto do conteúdo, a expansão dos filtros, busca/limpeza e ausência de overflow, erros ou gravações.
