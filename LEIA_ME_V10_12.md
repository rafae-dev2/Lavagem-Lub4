# v10.12 — correção da rolagem de Lavagem / Lubrificação

## O que mudou

A tabela móvel deixa de restringir os gestos à horizontal: você pode subir/descer a página com o dedo sobre as linhas e continuar deslizando lateralmente para acessar as colunas. Não há conversão da tabela em cartões; os três modos de visualização continuam disponíveis.

Dois relógios React — um da página Programações e outro do controle global de encerradas — provocavam renderizações a cada segundo mesmo sem qualquer alteração nas ordens. Eles agora atualizam no início de cada minuto, pausam quando a aba está oculta e conferem a hora imediatamente quando a janela volta a ficar ativa. Isso reduz as atualizações desnecessárias durante a rolagem.

A virada operacional das **07:10** permanece alinhada ao início do minuto. Datas, regras de encerramento, preferência Mostrar encerradas, filtros, pesquisa, edição e ações dos equipamentos não foram alterados. A cadência de sincronização com o Supabase permanece a mesma; relógio visual e sincronização são mecanismos diferentes. A Central Gerencial continua com sua política própria de leitura.

## Publicar

Substitua a versão atual do Netlify pelo ZIP compilado v10.12. Extraia o ZIP e publique todo o conteúdo com `index.html`, `assets`, `equipment-types`, logotipo, `_redirects` e worker PDF na raiz. Depois da publicação, recarregue a página sem cache; se necessário, feche e abra a aba do celular.

O site atualmente publicado é a versão anterior. A correção só passa a valer depois de republicar este compilado. Não é necessário executar nova migração SQL nem alterar ordens, cadastro de frotas, permissões ou imagens no Supabase.

As funcionalidades e imagens da v10.11 estão incluídas. O e-mail `bugname621@gmail.com` já foi habilitado no servidor para edição de imagens; a autenticação desse editor é uma etapa independente desta correção de rolagem.

## Validação

O teste de relógio com tempo controlado confirmou a virada exata de 07:09:55 para 07:10:00, ausência de atualizações por segundo, pausa de timers em segundo plano e retorno imediato. Regressões do corte 07:10, cabeçalho compartilhado de encerradas, tipos e Central Gerencial passaram. Os testes de gesto de rolagem utilizam o componente real e dados simulados, sem gravar ordens reais.

Para desenvolver com as fontes, use Node.js 20.19+ ou 22.13+, execute `npm ci`, `npm run check` e `npm run build`. Não publique o ZIP de fontes como site estático; use o compilado.
