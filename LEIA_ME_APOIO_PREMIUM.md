# Controle de Equipamentos — Apoio: verde e dourado premium

O módulo recebeu a identidade da referência enviada: fundo marfim, faixas curvas verdes e douradas, cabeçalho verde profundo, botão Sincronizar com acabamento dourado e cards brancos com moldura metálica, trilho verde/dourado e sombras discretas. A implementação é uma interface funcional em React/CSS, não uma imagem aplicada por cima do aplicativo.

A composição prioriza FROTA e OS. Situação e dias ficam no topo, seguidos por oficina/ponto, local atual, entrada e previsão em quatro quadrantes; o serviço aparece em um bloco marfim e o grupo Apoio fica junto ao botão de detalhes. Os detalhes expandem a narrativa e um painel de acompanhamento com entrada, previsão, metadados disponíveis e ausência na fonte quando houver.

Datas e textos provêm dos dados do aplicativo; os erros de escrita da referência e a barra de sistema do telefone não foram reproduzidos. A posição dos elementos adapta-se à largura disponível: uma coluna no celular, duas em monitores intermediários e três em telas muito grandes. Não há altura fixa que esmague ou corte os cards. Narrativas completas são acessíveis em Ver detalhes. Horários operacionais são apresentados em Brasília, inclusive em aparelhos com outro fuso.

## Comportamento e dados preservados

Busca, filtros por localização/situação/oficina/grupo/frota, cadastros, relatórios, paginação e sincronização permanecem ligados aos serviços existentes. Este ajuste não cria nem encerra ordens e não muda permissões do Supabase. A ausência da fonte continua sendo apresentada como ausência, nunca como execução confirmada. Previsão atrasada é um alerta visual, somente para ordens ativas; o status não é alterado.

A opção Não cadastrado fica desabilitada quando uma frota já tem grupo, para não aparentar uma remoção que não seria executada. Para retirar uma frota do controle próprio, use a ação Remover em Grupos Apoio e nossas frotas. Nenhuma remoção foi feita durante esta tarefa.

A identidade local marfim/verde/dourado continua clara mesmo quando o restante do aplicativo utiliza modo escuro ou Glassy. Os demais módulos e as correções anteriores de exportação/sincronização e Modo TV permanecem no pacote completo.

## Publicação

Extraia o ZIP compilado e publique todo o conteúdo no site Netlify existente: `index.html`, pasta `assets`, arquivos públicos e `_redirects`. Não misture arquivos de versões diferentes. A publicação não foi realizada automaticamente nesta tarefa.

Os fontes completos incluem os scripts Supabase já existentes e a configuração do Netlify. O ZIP Supabase adicional é somente uma cópia de referência para backup/instalação em um projeto novo. **Este ajuste visual não exige executar SQL no projeto atual.** Não reaplique automaticamente scripts históricos: eles podem redefinir funções. Em uma instalação nova, siga a ordem dos documentos de instalação existentes nos fontes.

## Prévia e validação

As prévias foram feitas com dados de teste, não com registros de produção. A validação do componente real usa mocks de serviço; atribuição de grupo, busca, histórico e Sincronizar são exercitados somente em memória, sem alterar o banco. Consulte o JSON de validação para as resoluções verificadas.
