# Auditoria v10.22 — Acesso ao cadastro de grupos

## Causa

A navegação para a tela de cadastros estava no final do `details.apoio-extra-tools`, cujo resumo “Relatórios e cadastros” inicia recolhido. Assim, sem expandir o acordeão, a pessoa não encontrava o botão que abre o formulário de grupos, embora o formulário e o botão de envio “Criar grupo” ainda existissem no código.

## Correção

A navegação “Ordens e relatórios” / “Grupos Apoio e nossas frotas” foi movida para fora do acordeão, diretamente após as informações de integração e sincronização. O acordeão foi renomeado para “Relatórios e atualização” e continua recolhível para as ações que contém. O fluxo de criação, edição e gravação de grupos não foi alterado.

## Validação

O teste de navegador com dados simulados confirma que o botão de navegação está visível enquanto o acordeão está fechado, abre “Criar ou editar grupo Apoio” e deixa “Criar grupo” visível sem abrir o acordeão; também confirma o retorno às ordens. O teste roda em 390, 719, 1366 e 844 px e verifica ausência de gravações. A validação TypeScript passou.

## Implantação

O site só recebe a mudança após publicação do ZIP compilado v10.22 no Netlify, com `index.html` na raiz, e recarga forçada da página.
