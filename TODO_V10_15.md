# v10.15 — tabela no retrato

- [x] Manter a lista tabular com cabeçalho de colunas visível no celular em pé, sem transformação automática em cartões.
- [x] Preservar tabela em paisagem, zoom por pinça e rolagem horizontal/vertical.
- [x] Confirmar a correção com o contêiner e todos os estilos reais do aplicativo.
- [x] Não alterar outras telas, regras operacionais ou Supabase; entregar compilado e fontes para republicar.

## Evidências

Site real: versão14 e opção Tabela, mas CSS legado convertia linhas/células em grid. Correção temporária no navegador restaurou tabela e cabeçalho. Teste local completo antes/depois:8 cenários claro/escuro em390,428,844 e1366px; células na mesma linha, ações acessíveis, rolagem vertical/horizontal preservada. Comparação confirma que outros módulos permanecem iguais. Build concluído; republicar no Netlify.
