# v10.26 — Relatório Equipamentos em Oficina de Terceiros
O módulo **Controle de Equipamentos — Apoio** ganhou um relatório separado, feito para cobrar retorno da manutenção: **Equipamentos em Oficina de Terceiros**. Ele é exportado como imagem PNG de celular em pé, **921 × 1600 pixels**, com o cabeçalho verde e o logotipo no mesmo estilo do PDF premium (Branco Peres Agro · Controle de Equipamentos — Apoio).
O relatório mostra somente três colunas: **Equipamento** (frota), **Modelo** (ex.: `Ren Oroch 1.6 SCe`, `MB 3344 6x4 Cavalo Mec`) e **Prestador** (nome da oficina de terceiro onde o equipamento está). Nada de narrativa, status, datas ou OS.
## Onde exportar
No Controle Apoio, botão **Oficina de terceiros** na barra da lista de ordens e botão **Oficina de terceiros · PNG** em **Relatórios e atualização**. Os dois usam os filtros atuais da tela.
## Regra dos dados
Entram apenas ordens ativas em **Oficina Externa** da seleção atual, uma linha por frota (a primeira ocorrência prevalece). Ordem encerrada, ausente da listagem, de oficina interna ou de campo não entra. Modelo vazio usa o nome do equipamento e, sem ambos, mostra “Modelo não informado”; prestador vazio mostra “Oficina não informada”. A cor da linha segue o grupo Apoio, igual ao exemplo de cores.
Quando a lista passa de uma página, o app entrega um ZIP com páginas numeradas, todas em 921 × 1600, com cabeçalho compacto e o cabeçalho da tabela repetido.
## Publicação
Publique no Netlify todo o conteúdo do ZIP compilado da **v10.26**, com `index.html` na raiz; depois, faça uma recarga forçada e confirme `v10.26` no menu lateral. Esta versão também inclui a correção da v10.25 (Carreta Tanque Vinhaça fora da programação geral de Lavagem/Lubrificação).
## Verificação
`npm run test:oficina-terceiros` cobre a seleção (somente externas ativas, frota única, fallback de modelo/prestador, ordem e não mutação), o PNG de 921 × 1600 no navegador, o cabeçalho, as três colunas, a paginação em ZIP e o clique real no botão da tela, que baixa o arquivo no tamanho exato. `npm run check` e `npm run build` passaram.
