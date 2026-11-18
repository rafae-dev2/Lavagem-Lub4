# v10.8 — Apoio com a referência Reformas

- [x] Controle Apoio reutiliza o mesmo componente de cartão e os mesmos estilos de Reformas Equipamentos Apoio: cores, alturas naturais, largura/densidade, tipografia, quadrantes e espaçamentos. A altura pode variar com o conteúdo factual e detalhes, nunca cortar informações.
- [x] Cabeçalho, indicadores, filtros e barra de resultados seguem a referência; margem lateral uniforme em computador/tablet/celular, sem elementos colados na barra lateral ou grade esticada por estilos antigos.
- [x] Preservar consultas, filtros múltiplos/frotas/recência, cartões/tabela, relatórios PDF/Excel/imagens/WhatsApp, cadastros e encerramentos; mudar grupo continua acessível nos detalhes.
- [x] Entregar versão completa em fontes/compilado, sem publicação automática nem alteração de dados/cron do Supabase.

## Evidências de fechamento

Comparação automática de ambas as páginas reais no mesmo Layout e com fixtures locais: 2240/1366/1024/390 px. Mesmos atributos visuais e dimensões do cartão equivalente, margem externa e ausência de overflow. Busca, tabela, detalhes, cadastro e encerradas após recência ativa validados. TypeScript, SSR, menu, filtros e regressões de Central/Reformas/Lavagem/tema/desempenho passaram. Build final 10.8 concluído. Publicação Netlify fica para o usuário com o compilado entregue; não houve alteração Supabase.
