# v10.13 — lista padrão no celular e zoom por pinça

## O que mudou

No celular, Lavagem / Lubrificação abre no **modo lista/tabela**, com as mesmas colunas e ações da referência fornecida. O cabeçalho, o resumo e o botão Expandir/Minimizar não foram alterados. A opção de cabeçalho reduzido não foi aplicada como novo padrão.

A preferência de visualização do celular agora é separada da preferência do computador. O primeiro acesso à nova versão no celular usa lista/tabela, mesmo se a chave antiga estava em Cartões ou Quadro. Depois disso, se você escolher outro modo no celular, sua escolha será lembrada. A detecção também considera orientação horizontal em aparelhos com tela sensível ao toque. Girar ou ampliar a página não troca a preferência durante o uso do módulo.

O zoom por pinça foi liberado explicitamente sobre a tabela, junto com os gestos verticais e horizontais. A restrição anterior permitia deslocamentos, mas não negociava zoom por pinça. O viewport da página já não restringia o zoom; não foram adicionados `user-scalable=no` nem limites artificiais de ampliação.

## Como usar

Abra Lavagem / Lubrificação no celular. Afaste dois dedos sobre a tabela para ampliar e aproxime os dedos para reduzir o zoom. Arraste com um dedo para subir/descer a página ou acessar lateralmente as colunas. A rolagem e o relógio por minuto da v10.12 continuam preservados.

O zoom utiliza o comportamento nativo do navegador. O limite mínimo/máximo pode variar conforme navegador e dispositivo. A lista mantém o tamanho legível e o acesso às colunas por rolagem horizontal; ela não é artificialmente encolhida para encaixar todas as colunas numa tela estreita.

## Publicação

Extraia o ZIP compilado v10.13 e publique todo o conteúdo no Netlify, mantendo `index.html`, `assets`, `equipment-types`, logotipo, `_redirects` e o worker PDF na raiz. Recarregue o site sem cache após a publicação ou feche e reabra a aba do celular.

Esta entrega não atualiza automaticamente o site já hospedado. Não é necessário alterar o Supabase, executar migração nem modificar equipamentos ou ordens. Todas as imagens, relatórios e regras operacionais da versão anterior estão incluídas.

Para desenvolver, use as fontes com Node.js 20.19+ ou 22.13+, execute `npm ci`, `npm run check` e `npm run build`. Os testes da preferência móvel estão em `npm run test:lista-movel`.
