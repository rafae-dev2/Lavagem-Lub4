# v10.16 — Pesquisa Apoio fixa e acesso ao editor de imagens

## Pesquisa do Apoio

A pesquisa por frota, OS e narrativa foi movida para abaixo dos filtros, fora do painel recolhível. Ela continua visível enquanto você percorre os resultados, abaixo do cabeçalho. A mesma pesquisa vale para cartões, tabela e relatórios. Limpar busca não remove os demais filtros.

## Problema do login

O Manus está conectado ao projeto Supabase. Contudo, a configuração de URLs do Auth não é exposta pelo conector disponível. O painel web não estava acessível nesta execução. As capturas mostram retorno a localhost:3000; uma mostra também otp_expired, que significa link inválido, expirado ou já consumido. Receber o e-mail não garante que o link ainda esteja válido.

A configuração definitiva no painel é Authentication > URL Configuration: Site URL deve ser https://controlelogisticalub.netlify.app/ e Redirect URLs deve incluir https://controlelogisticalub.netlify.app/**. Preservar outros endereços existentes que sejam legítimos. A configuração do Supabase NÃO foi alterada nesta revisão.

## Alternativa segura nesta versão

Em Configurações > Ilustrações por grupo, informe o e-mail autorizado e solicite um novo link. Abra o e-mail mais recente, mas NÃO clique no link antes de usar a alternativa. Copie o endereço do botão de acesso no próprio e-mail e cole no campo de confirmação dentro do aplicativo. Se o e-mail mostrar um código numérico, pode usar esse código no lugar do link. Confirme o acesso no aplicativo.

Não cole o endereço localhost mostrado na página de erro: ele não contém a credencial original. Não encaminhe o link ou o código a outras pessoas. O acesso continua validado pelo Supabase; só um editor autorizado pode trocar imagens. Links usados ou expirados não podem ser recuperados: solicite um novo. O novo link invalida tentativas anteriores conforme as regras do provedor.

A alternativa evita o redirecionamento do navegador. Ela não transforma um e-mail de link em e-mail de código: só permite código quando o template já o mostrar. Links intermediários de rastreamento de um serviço de e-mail não são aceitos como link Supabase; nesse caso use a configuração definitiva de URLs.

## Publicação

Extraia o ZIP compilado e publique TODO o seu conteúdo no Netlify, com index.html na raiz. Depois recarregue o aplicativo. Nenhuma ordem, imagem ou permissão do banco precisa ser alterada. Para fontes: Node.js 20.19+ ou 22.13+, npm ci, npm run check e npm run build.
