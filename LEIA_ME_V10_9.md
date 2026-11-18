# Versão 10.9 — barra lateral animada

A referência enviada é a barra Glassy Sidebar. No computador com mouse/ponteiro fino, a navegação fica em um trilho de ícones e se expande suavemente ao aproximar o mouse. Os ícones ganham destaque e o foco por teclado também revela o painel. Atalhos flutuantes permitem consultar os módulos da mesma seção e navegar diretamente.

O efeito foi adaptado à paleta verde premium do aplicativo, com vidro sutil, contraste para os textos e estados ativos preservados. A expansão ocorre sobre a área de conteúdo: não muda a largura útil dos gráficos a cada passagem do mouse. Enquanto o painel estiver aberto, ele cobre uma pequena parte dessa área e volta ao trilho ao retirar o ponteiro/foco.

Em celular e tablet com tela de toque, permanece o menu aberto pelo botão: não é necessário passar o mouse. A preferência do sistema por movimento reduzido suprime as transições. Escape fecha os atalhos e o menu móvel.

**Os cartões não foram alterados.** A proposta inicial de efeito 3D foi descartada após sua confirmação de que a animação era para a barra lateral. Mantidos o visual de Apoio10.8, todos os módulos, consultas, relatórios, cadastros e configurações Supabase.

## Publicar no Netlify

Extraia o ZIP compilado10.9 e publique o conteúdo extraído no site existente `controlelogisticalub.netlify.app`. `index.html`, `assets`, `_redirects` e os demais arquivos devem ficar na raiz publicada. Não publique somente o arquivo HTML nem a pasta pai. Atualize o navegador depois da publicação.

A hospedagem **não foi atualizada automaticamente**. Nenhuma mudança de banco, SQL ou cron é necessária para esta revisão.

Para as fontes, extraia a pasta `aplicativo` e use Node.js20+ com `npm ci`, `npm run check` e `npm run build`. Testes de navegador usam fixtures locais e não gravam no banco de produção. A demonstração incluída é uma prévia isolada, não uma gravação das suas ordens reais.
