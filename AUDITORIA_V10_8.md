# Auditoria da versão 10.8 — Apoio com referência Reformas

## Escopo e causa do desalinhamento

A referência solicitada é o módulo Reformas Equipamentos Apoio. O Controle Apoio mantinha outra árvore de cartão, outra grade e várias camadas históricas de CSS. Além disso, a classe `app-shell--apoio` acionava `padding: 0 !important` na área principal. Isso explicava por que alguns elementos e a grade ficavam encostados no menu, diferentemente da referência.

O Apoio usa agora `MaintenanceOrderCard`, os mesmos estilos de manutenção e a mesma grade responsiva `.mt-card-grid`. A classe do Layout foi substituída para não acionar o override antigo; o conteúdo usa o padding normal da aplicação. Os estilos adicionais atuais tratam somente os controles exclusivos de Apoio, sem redesenhar cartões ou a grade. Não se aplica mais o limite artificial de 360 px da proposta anterior.

## Evidências de equivalência visual

O teste isolado monta **o Layout real e as duas páginas reais** em 2240, 1366, 1024 e 390 px. As ordens são fixtures locais; nenhum serviço real é acessado. A referência recebe classificação de reforma somente na fixture de teste, para comparar o mesmo registro e o mesmo conteúdo em ambos os componentes.

Nas quatro larguras, a comparação passou para largura e altura do mesmo cartão, com tolerância geométrica máxima de 1 px. Também passaram igualdade de fonte, cor de fundo, cor de bordas, espessura da borda esquerda, raio, sombra, padding do cabeçalho e fonte dos quadrantes. Foi validado o afastamento do cabeçalho em relação à área principal, de pelo menos 15 px, e ausência de overflow horizontal da página.

A equivalência é para **o mesmo conteúdo no mesmo viewport**. Cartões com nomes, narrativa, situação ou campos diferentes podem ter alturas naturais diferentes, como na própria referência. Não se força corte de informação para aparentar uma altura fixa.

## Recursos e comportamento

Foram validados no navegador: pesquisa por OS, limpeza da busca, alternância de cartões/tabela, expansão e recolhimento de detalhes, presença do seletor de grupo, acesso às encerradas e retorno à operação aberta, navegação para cadastros e retorno direto às ordens. Também foi validado Mostrar encerradas depois de ativar Última hora: o recorte temporal é limpo e a encerrada mais antiga aparece. Encerradas não recebem marca de atraso.

A revisão read-only independente confirmou a reutilização do cartão, preservação dos callbacks, grade compartilhada, novo espaçamento do Layout e ausência de filtragem do Apoio pelo critério Reforma. Identificou a preservação indevida do recorte temporal ao mostrar encerradas; isso foi corrigido. A hipótese de Todas permanecer restrita às encerradas não se confirmou: o handler já retorna à vista aberta, e o teste de navegador cobre explicitamente Encerrado → Todas.

As ferramentas extras foram mantidas fora da renderização condicional de ordens. PDF, Excel, imagem e WhatsApp continuam utilizando os mesmos serviços e a mesma seleção filtrada. Cadastro e atribuição de grupo não foram removidos. Os testes não efetuaram gravações reais; a comparação de consulta registrou zero chamadas de escrita no mock.

## Regressões

Passaram TypeScript, SSR do cartão compartilhado, tabela/controle de busca, filtros de origem/grupo/frotas, menu, métricas e relatórios da Central, classificação e relatórios dos acompanhamentos, quatro módulos especializados de reforma e seleção de equipamentos de Lavagem. As asserções visuais antigas que exigiam uma grade exclusiva, máximo de 360 px ou busca fora do painel foram atualizadas para a nova direção solicitada; não indicavam falha de dados.

## Limites da entrega

A validação usa fixtures e verificações automatizadas; não é promessa de funcionamento perfeito em qualquer aparelho, conexão ou volume de dados. Não houve gravação de ordens, alteração de Supabase, mudança do cron ou publicação no Netlify. O compilado completo deve ser publicado no site existente. Preservados modo claro padrão, cadência da Central e demais módulos.

## Compilação final

Build Vite 10.8 concluído. Permanece o aviso de chunk minificado acima de 500 kB; é uma oportunidade de divisão de bundle, não um erro de compilação. Regressões da cadência de cinco minutos, concorrência, preservação do snapshot e reutilização de formatadores da Central passaram.
