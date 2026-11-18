# Auditoria v10.19 — pesquisa permanente no Controle Apoio

A implementação anterior usava position: sticky dentro do main rolável, após os filtros. Mesmo quando a fixação funcionava, a barra podia se deslocar antes de alcançar o limite da área de rolagem; isso não correspondia ao pedido de permanecer parada desde a abertura.

A correção acrescenta um ponto reservado no Layout somente para controle-apoio, entre o cabeçalho e o main. O componente ApoioSearchDock utiliza portal React para colocar o único campo de pesquisa fora do main, mantendo seu estado controlado na tela ControleApoio. A faixa tem espaço próprio no layout flex e não sobrepõe a lista. Não há listener scroll, medições recorrentes, position: fixed ou dependência de sticky para fixar a busca. Os controles existentes e relatórios usam os mesmos dados e filtros.

A mudança é restrita a Layout, componente de projeção, invólucro da pesquisa e estilos da faixa. Nenhuma chamada de alteração ao Supabase, ordem, encerramento, cadastro, regra de plano LUB ou rotina de sincronização foi modificada. A versão compilada precisa ser republicada no Netlify; não se afirma que o site remoto já recebeu esta interface.

## Resultado dos testes

O teste com Layout real e serviços simulados passou em 390×844, 719×900, 1366×900 e 844×390. A posição vertical da faixa permaneceu constante, com tolerância de 2px, nas posições de rolagem 0, 200, metade, fim e retorno reverso, inclusive com filtros abertos e fechados. A lista recebeu extensão DOM de 3000px para testar rolagem longa. Foco e cursor foram preservados; buscar159330468 mostrou uma ordem e limpar restaurou quatro. Foi confirmado um único campo fora do main, ausência de overflow horizontal, ausência de erros JavaScript e zero gravações. O módulo de referência Reformas permaneceu sem a faixa. Também passaram TypeScript, menu, controle de encerradas, planosLUB e build final.


## Ajuste posterior — busca no fluxo da página

A faixa separada sob o cabeçalho foi removida a pedido do usuário. O componente deixou de usar portal e o campo permanece no ponto em que é declarado em ControleApoio, abaixo dos filtros/indicadores e antes das abas de ordens. Assim, ele não fica atrás da sidebar expandida e rola com o conteúdo. A lógica de filtragem e o estado da busca permanecem os mesmos.

A verificação estrutural e o teste de navegador foram atualizados para a nova expectativa: campo único dentro de `main`, fora de posição fixa/sticky, responsivo nas quatro larguras testadas, acompanha a rolagem e preserva busca/limpeza. Nenhuma integração, gravação, sincronização ou regra de ordens foi alterada.
