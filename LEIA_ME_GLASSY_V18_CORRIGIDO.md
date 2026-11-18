# Glassy Dashboard V18 — versão corrigida

## O que foi ajustado

O aplicativo fornecido foi atualizado, mantendo seus módulos, filtros, relatórios e integração Supabase. O tema continua opcional: selecione **Glassy Dashboard V18** no botão de paleta do cabeçalho. A escolha permanece salva no navegador.

Os indicadores Atrasado, Programado, Pendente, Andamento e Encerrado agora têm cores semânticas próprias, com texto claro sobre superfícies escuras coloridas. Foi removida a regra genérica que substituía a cor de todo texto pequeno e apagava esses indicadores. Os textos secundários receberam uma paleta mais clara.

A coluna Ações tem fundo opaco no desktop, impedindo que as observações apareçam através dela. Em telas até 719 px, ela acompanha a rolagem horizontal da tabela. **Deslize a tabela horizontalmente para chegar a Observações e Ações.** Os botões Editar e Ver detalhes continuam disponíveis.

O acabamento usa vidro fumê quente, bordas luminosas discretas e acentos pervinca. O cabeçalho deixa de herdar o verde institucional quando o V18 está selecionado. O seletor de temas também recebe o acabamento correto, mesmo sendo renderizado fora do contêiner principal.

Há transição de entrada das telas, entrada sequencial dos indicadores, elevação de cartões no hover em computadores e resposta ao pressionar botões. Não foi adicionado movimento contínuo de fundo. O efeito de desfoque é aplicado ao fundo, não à tipografia. A preferência de acessibilidade por movimento reduzido desativa essas animações.

## Instalar no Netlify

Para implantação manual, use **applav-compilado-glassy-v18-corrigido.zip**. Descompacte e envie a pasta cujo nível principal contém `index.html`, `assets`, `equipamentos` e `logo.png` para uma nova implantação do **mesmo site Netlify**. Não envie a pasta de fontes nesse fluxo.

O pacote compilado inclui `_redirects` para o fallback da aplicação. Se a versão antiga continuar aparecendo após a implantação, recarregue a página; feche e reabra a aba se necessário.

Para implantação por código, use **aplicativo-fontes-glassy-v18-corrigido.zip**. Na pasta `aplicativo`, execute:

```bash
npm ci
npx tsc --noEmit
npm run build
```

O arquivo `netlify.toml` existente continua definindo `dist` como diretório publicado.

## Supabase e dados

Esta atualização é visual e **não exige executar SQL, apagar tabelas ou recriar o banco**. Os scripts anteriores permanecem no pacote de fontes para referência e instalações existentes. Não os execute novamente apenas para aplicar este tema. A conexão existente foi preservada; nenhum registro foi alterado durante o desenvolvimento ou os testes desta revisão.

Uma importação ausente preexistente de `resetarCategorias` foi corrigida para permitir a checagem TypeScript. A ação de restauração de categorias não foi executada.

## Validação realizada

Compilação Vite e checagem TypeScript concluídas. Dez testes de regressão passaram, incluindo filtros de Apoio, exportações e janela operacional 07:10.

O teste visual isolado usou os componentes reais com dados fictícios em Chromium, nas larguras 1440 px e 390 px. As requisições externas foram bloqueadas. Foram verificados os cinco indicadores, edição por callback, expansão de detalhes, rolagem, ausência de overflow global no celular, seletor de temas, transição de navegação, movimento reduzido e preservação do tema Claro.

| Indicador | Contraste medido |
| --- | ---: |
| Atrasado | 8,64:1 |
| Programado | 8,78:1 |
| Pendente | 8,22:1 |
| Andamento | 8,68:1 |
| Encerrado | 9,50:1 |

Essas medidas são dos indicadores de situação, não uma auditoria WCAG de todo o aplicativo.

## Fidelidade ao vídeo

A implementação reproduz o material e os tipos de movimento observados na referência, adaptados ao conteúdo real do aplicativo. Não representa uma cópia pixel a pixel: o vídeo apresenta outro conteúdo e outro fundo, e o renderizado de `backdrop-filter` varia entre navegadores e dispositivos.

O blur foi configurado em 24 px para os cartões no desktop e 18 px no celular. Navegadores sem suporte ao efeito recebem superfícies sólidas legíveis. Não foi realizada validação física em aparelho Android; a validação móvel utilizou viewport de celular no Chromium.

As prévias entregues mostram **dados fictícios para validação**, não os registros reais do Supabase. O site Netlify não foi publicado automaticamente nesta tarefa.
