# Apoio — computador, tablet e celular

O logotipo existente da Branco Peres Agro está visível novamente no cabeçalho do módulo Apoio. O fundo marfim com curvas verdes/douradas, molduras e botões premium permanece; a grade agora usa a largura disponível no módulo, descontando a barra lateral do aplicativo.

## Organização automática

| Espaço útil do módulo | Organização |
| --- | --- |
| Até859px | Uma coluna, apropriada a celular e tablet em retrato |
| De860px até1419px | Duas colunas, apropriadas a tablet em paisagem/notebook |
| A partir de1420px | Três colunas, apropriadas a computadores maiores |

As colunas mudam automaticamente ao girar o tablet, abrir o app em monitor maior ou redimensionar a janela. Não é necessário ativar um modo separado. Em browsers sem container queries, a grade mantém uma coluna segura. Os cards têm altura natural; textos extensos quebram linha, e botões/seletores se reorganizam nos cards estreitos. Detalhes, filtros, relatórios e cadastros continuam disponíveis.

## Modo TV verificado

Esta versão inclui a correção de leitura do Modo TV: `navigator.onLine=false` não bloqueia as consultas, a verificação de30 segundos continua tentando e o retorno da aba provoca nova leitura. Falha real preserva a última fotografia e é sinalizada. O indicador de Realtime ativo também é preservado ao retornar à aba, sem rebaixá-lo indevidamente para consulta periódica. Os painéis Emergenciais/Externas e seus filtros continuam usando os dados do Apoio. A validação automatizada é isolada, sem criar ou alterar registros de produção.

## Instalação

Publique o conteúdo completo do ZIP compilado no site Netlify existente, substituindo `index.html`, pasta `assets`, arquivos públicos e `_redirects`. O arquivo `logo.png` e os dois assets `apoio-reference-*.svg` devem permanecer na raiz da publicação. Feche a versão antiga no celular e reabra o site depois da publicação.

Os fontes completos incluem testes, todos os módulos e os scripts Supabase atuais. O ZIP de scripts Supabase é somente referência para backup ou instalação nova. **Não há SQL novo a executar no projeto atual.** Nenhuma permissão nem registro de produção foi alterado; a publicação no Netlify não foi efetuada automaticamente.

As prévias usam dados simulados para verificar dimensões, logotipo e interação sem mexer nas ordens reais.
