# Gestão de Ordens Manutenção

O menu “Gestão de Ordens Manutenção” foi adicionado em primeiro lugar na barra lateral. Ao clicar, o aplicativo exibe https://ti.usinabrancoperes.com.br/ordens-pims/ em um iframe na área de conteúdo, mantendo a barra lateral e o cabeçalho do aplicativo. Os demais menus e a página inicial anterior foram preservados.

A incorporação não usa links externos nem `window.open`. O iframe não permite pop-ups nem redirecionamento da janela principal. Scripts, formulários e downloads do site são permitidos.

## Arquivos alterados

`src/components/Layout.tsx` recebeu o primeiro item do menu, o título do cabeçalho e o ajuste de espaço para a página incorporada. `src/App.tsx` recebeu a navegação interna para a nova página. `src/types/index.ts` recebeu o identificador da página. `src/pages/GestaoOrdensManutencao.tsx` contém o iframe.

## Utilização

O ZIP inclui o código-fonte e a pasta `dist` compilada. Para atualizar uma hospedagem estática, publique o conteúdo da pasta `dist` na hospedagem utilizada pelo aplicativo, preservando a configuração de domínio e as regras já existentes. Para desenvolvimento, execute `npm install` e `npm run dev`. Para gerar novamente a versão de produção, execute `npm run build`.

## Validação e limites

A compilação com `npm run build` foi concluída com sucesso. A resposta HTTP do site de destino foi 200 e os cabeçalhos verificados não continham `X-Frame-Options` nem restrição `frame-ancestors` em 03/11/2026. Não foi realizado teste visual nem operação nos dados do site.

A exibição depende de o servidor de destino continuar permitindo incorporação. Caso futuramente sejam configurados bloqueios de iframe, será necessário ajustá-los no servidor do site. Não foi adicionada alternativa de abertura em navegador externo.

A verificação `npx tsc --noEmit` apresenta os mesmos três diagnósticos encontrados antes da alteração, em `src/pages/ManutencaoEquipamentos.tsx`: referência inexistente a `resetarCategorias` na linha 505 e parâmetros `c` e `i` sem tipo na linha 506. Esses pontos preexistentes foram preservados para não alterar funcionalidades fora do pedido.
