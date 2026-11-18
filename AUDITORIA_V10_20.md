# Auditoria v10.20 — Busca do Controle de Equipamentos — Apoio

## Alteração

A busca foi declarada diretamente em `ControleApoio`, depois do fechamento do painel `Filtros de acompanhamento` e imediatamente antes das abas de situação das ordens. Foi removido o componente intermediário de projeção da barra. O CSS força posição estática, sem `fixed`, `sticky`, ordem visual ou transformação que possa deslocá-la para o cabeçalho.

O contêiner que rola continua sendo o `main` da tela. Portanto, a busca se move junto com os demais elementos quando o usuário rola para cima ou para baixo. A lógica existente de filtragem, contagem e limpeza foi preservada. O rótulo de versão na navegação mudou para v10.20 para ajudar a confirmar a atualização.

Nenhuma integração, chamada ao Supabase, cadastro, ordem, regra de encerramento ou rotina de sincronização foi alterada.

## Validações

A validação estrutural exige a ordem filtros → busca → abas e ausência do dock no cabeçalho. O teste visual com Layout e serviços simulados verifica quatro tamanhos de tela, busca dentro de `main`, posição estática, movimento vertical igual ao deslocamento da rolagem, funcionamento da busca e do botão de limpeza, ausência de overflow/erros e nenhuma gravação. `npm run check` e `npm run build` verificam tipos e compilação.

## Implantação

O site não é atualizado automaticamente por este pacote. Publique o conteúdo integral do ZIP compilado v10.20 no Netlify, deixando `index.html` na raiz, e faça recarga forçada no navegador. Confirme o rótulo `v10.20` no menu lateral.
