# Correção robusta dos cards — Monitores pequenos e TVs

Esta revisão substitui o layout que permitia ao rodapé atravessar a primeira linha e aos cards exceder a largura disponível. A correção é estrutural, não apenas uma mudança de tamanho de fonte.

## O que mudou

A grade agora tem uma área própria. Em apresentação TV/tela cheia, cabeçalho, indicadores e paginação ficam separados, e apenas a área das ordens pode rolar quando uma tela excepcionalmente baixa não comporta nem um card. No modo normal, os cards seguem o fluxo da página e a paginação vem depois da grade, nunca por cima dela.

O aplicativo mede a largura e a altura reais da área de cards com ResizeObserver. Isso considera a barra lateral, o tamanho da janela, as barras do navegador e mudanças de orientação. As colunas, a densidade e a quantidade por página se adaptam automaticamente ao espaço útil, não à resolução nominal do aparelho.

As opções4/6/8/12 passam a representar o máximo por página na apresentação. Se12 não couberem com segurança, a página mostra menos cards e cria mais páginas. Nenhuma ordem é removida da seleção por falta de espaço. O rodízio e a alternância Emergenciais/Externas percorrem as páginas normalmente.

O número de frota ajusta a fonte também ao comprimento do número. Nomes longos, prestadores, OS e narrativas não aumentam a largura da grade nem invadem as datas ou o rodapé. O texto resumido continua com acesso a **Ver ordem completa**. O tema claro e o escuro permanecem disponíveis.

Barras e indicadores ficam mais compactos em telas baixas, reservando espaço para as ordens. Redimensionar a janela preserva os filtros e remapeia a posição da paginação.

## Atualização

Publique o conteúdo do pacote compilado no mesmo site Netlify, com `index.html`, a pasta `assets`, `_redirects` e os demais arquivos. É um pacote completo que substitui o anterior; não misture os `assets` de versões distintas.

Não precisa executar SQL ou mudar o Supabase. Realtime, filtros dos dois painéis, alternância e a exportação de encerradas de hoje desde07:00 foram preservados. Nenhuma ordem fictícia foi gravada no banco durante a correção.

Fontes completos acompanham o compilado. Para recompilar: `npm ci`, `npx tsc --noEmit`, `npm run build`; saída em `dist`.

A entrega é pronta para publicação, mas não foi implantada automaticamente no Netlify. As prévias usam dados fictícios de teste, incluindo textos longos e frotas de nove dígitos.
