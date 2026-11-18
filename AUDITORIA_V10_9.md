# Validação da barra lateral — v10.9

Foi aplicada exclusivamente a animação da barra lateral confirmada pelo usuário: trilho de 76px no desktop com ponteiro fino, expansão sobreposta para 256px, destaque de ícones, labels e atalhos flutuantes por seção. Mantidos os módulos e os nomes completos, incluindo acesso por teclado e drawer para telas de toque.

A revisão de código identificou que o submenu era posicionado antes de a transição de largura terminar e podia sobrepor o painel. A posição agora considera a largura final de 256px; há asserção geométrica para garantir que os atalhos fiquem à direita. Labels foram ajustadas para permitir duas linhas e evitar corte dos nomes.

Testes de navegador com rede externa bloqueada cobrem trilho, expansão sem mover a área principal, seleção de módulo no submenu com callback local, retorno, foco/Escape, menu no celular e movimento reduzido. A demonstração é uma gravação desse harness isolado, sem acesso às ordens reais. Os cartões e seus principais estilos foram comparados byte a byte com a fonte10.8 e permanecem iguais.

TypeScript, menu e SSR dos cartões passaram. A compilação utiliza a arquitetura original; não houve alteração de fonte de ordens, cadastros, cron, Supabase ou publicação Netlify. A expansão cobre temporariamente parte da área à direita e retorna ao trilho, em vez de recalcular os gráficos. O efeito adapta a referência à marca existente e não copia os ícones/cores de terceiros.

A validação não garante comportamento perfeito em todos os aparelhos; preferência por movimento reduzido remove transições e dispositivos de toque utilizam o botão de menu. O compilado deve ser publicado no site existente para disponibilizar a nova versão.
