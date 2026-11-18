# Versão 10.8 — Controle Apoio com o visual de Reformas

O Controle de Equipamentos — Apoio agora usa o mesmo componente de cartão e os mesmos estilos de Reformas Equipamentos Apoio. Cabeçalho, paleta verde/marfim/dourado, tipografia, badges, quadrantes, indicadores, grade e barra de resultados seguem a mesma referência. Não se trata de uma cópia aproximada com outra camada de cartões.

A largura segue a grade responsiva da referência, substituindo o limite de 360 px do desenho anterior. A altura acompanha o conteúdo factual de cada registro; não é fixada com corte de textos. A narrativa resumida continua com detalhes e histórico completos. Ordens encerradas mantêm a faixa específica e não recebem marca de atraso.

Foi retirada desta tela a classe que ativava um override antigo de padding zero. Apoio usa o espaçamento externo padrão do Layout, igual ao de Reformas, e mantém o afastamento interno dos cartões. O cabeçalho e os filtros não encostam mais no menu lateral.

## Recursos preservados

A pesquisa por frota, OS e narrativa fica em **Filtros de acompanhamento**, como na referência de Reformas. Os seletores múltiplos, grupos e frotas, prestadores, status e recência continuam nesse painel. Cartões e tabela podem ser alternados na barra da visão operacional. PDF e Excel estão na mesma barra e consideram todas as ordens filtradas, não apenas a página de cartões.

**Relatórios e cadastros**, ao final da página, reúne imagens PNG, WhatsApp, controles próprios e cadastros de grupos/frotas. Ao entrar em cadastros, o botão **Voltar às ordens** permite retornar diretamente. A atribuição do grupo de uma frota fica em **Ver detalhes** do cartão; isso evita acrescentar altura ao cartão fechado. A tabela também mantém detalhes e atribuição de grupo.

**Mostrar encerradas** limpa o recorte temporal de recência e a restrição de programadas/em andamento. Pesquisa, grupos, frotas, origem e prestador continuam aplicados. O indicador de encerradas informa o total do cadastro próprio; o número de registros na visão informa a seleção atual. Voltar às abertas e a aba Todas retornam à operação aberta.

A mudança é visual e de navegação de consulta. Apoio continua consultando todas as ordens do seu cadastro próprio, não apenas serviços de reforma. Não houve alteração de ordens, grupos, cadastros, cron ou configurações no Supabase. Permanecem os novos módulos, a Central Gerencial com cadência de cinco minutos e o modo claro padrão.

## Publicação do compilado no Netlify

Extraia `aplicativo-compilado-apoio-padrao-reformas-v10.8.zip`. Na pasta extraída, `index.html` deve ficar na raiz da pasta publicada junto de `assets`, `_redirects`, logo e demais arquivos. Publique esse conteúdo no site existente `controlelogisticalub.netlify.app`. Não publique a pasta pai nem somente `index.html`. Após publicar, atualize o navegador para carregar a nova versão.

Este trabalho entrega os arquivos: **a hospedagem não foi atualizada automaticamente**. Para esta revisão não há SQL ou reconfiguração de sincronização a executar. Use as configurações Supabase já existentes.

## Fontes e testes

Extraia o ZIP de fontes e, dentro de `aplicativo`, use Node.js 20 ou superior:

```bash
npm ci
npm run check
npm run test:apoio-referencia
npm run test:apoio-tabela
npm run test:apoio-visual
npm run build
```

O teste visual utiliza Chromium e Python com Playwright, além de fixtures locais; não consulta ou altera o banco real. As prévias identificadas como dados simulados não representam seus totais de produção.
