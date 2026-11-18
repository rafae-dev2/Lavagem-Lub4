# v10.15 — correção da tabela de Lavagem no celular em pé

O site publicado já estava na versão 10.14 e já selecionava Tabela no celular. O problema real era outro: uma regra antiga de estilo transformava a tabela em cartões abaixo de 720 px, independentemente da opção selecionada.

A correção impede essa transformação automática no módulo atual de Lavagem / Lubrificação. No celular em pé, o cabeçalho de colunas continua visível e cada ordem permanece em uma linha tabular, como na referência. As colunas que não cabem na largura da tela são acessíveis deslizando horizontalmente. O texto não é artificialmente reduzido para encaixar sete colunas numa tela estreita.

A visualização Tabela permanece padrão em cada abertura móvel, em retrato ou paisagem. Cartões e Quadro continuam disponíveis apenas quando selecionados explicitamente. O cabeçalho geral, as outras telas, filtros, imagens, relatórios, zoom por pinça e rolagem foram preservados.

Para aplicar: extraia e publique o conteúdo completo do compilado v10.15 no Netlify, com index.html e assets na raiz. Atualize a aba sem cache depois da publicação. Esta entrega não altera automaticamente a hospedagem nem precisa de alterações no Supabase.

Desta vez, a validação inclui a classe real do contêiner Lavagem e todos os estilos carregados pelo aplicativo. Também foi feita uma verificação temporária no navegador contra o site real, sem salvar alterações no servidor: a tabela passou de blocos/grid para tabela, cabeçalho visível e células na mesma linha.

Fontes: Node.js 20.19+ ou 22.13+, npm ci, npm run check e npm run build. Os testes de tabela com o contêiner completo estão incluídos nas fontes.
