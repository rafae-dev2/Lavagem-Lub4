# Controle de Equipamentos — Apoio: relatórios e WhatsApp

## Relatórios detalhados sem a informação dos filtros

A descrição dos filtros ativos foi retirada dos relatórios de imagem e PDF. A seleção das ordens continua respeitando os filtros usados no Controle de Equipamentos — Apoio: grupo, oficina/local, status, prestador e busca. Os filtros não foram removidos da tela e continuam funcionando.

Os dados operacionais de cada ordem, como oficina/local e grupo Apoio, podem continuar nas linhas e cartões detalhados. Isso não é o bloco de metadados dos filtros: é informação própria do equipamento. Avisos de atualização pendente e notas de histórico foram preservados. O Excel mantém seus metadados, pois esta mudança foi solicitada somente para PDF e imagem.

## Novo resumo premium para celular

O novo relatório **WhatsApp · Cobrar retorno** é independente do relatório detalhado. Ele utiliza todas as ordens da seleção atual, não apenas as 40 ordens exibidas na página da tabela.

Cada cartão destaca a frota, a classificação real de oficina — Interna ou Externa — e o problema relatado na narrativa da ordem. Quando houver prestador de oficina externa, o nome também aparece abaixo do rótulo, por exemplo: Oficina Externa / Fratini. O nome vem da ordem; não é inventado ou fixado para todas as oficinas. O número da OS é discreto, mas permite distinguir duas ordens da mesma frota. Campo ou origem desconhecida permanecem identificados como recebidos; não são convertidos artificialmente em oficina interna ou externa.

O visual usa logotipo existente, verde institucional, cartões claros, número de frota grande e textos com quebra automática. A composição é vertical, com largura lógica de 480 pixels. A altura de cada imagem se adapta ao conteúdo, com paginação até 900 pixels lógicos para evitar imagens excessivamente longas. Textos extensos continuam em outra página, repetindo frota, oficina e OS. Não há corte silencioso nem diagnóstico inventado por IA.

A mensagem de rodapé pede: **“Por favor, informar andamento e previsão.”** O aplicativo não afirma que a manutenção respondeu, nem grava uma resposta fictícia. A narrativa vem dos dados da ordem; se estiver vazia, o cartão pede detalhamento. Registros do histórico são sinalizados para confirmar sua situação atual, e erros/desatualização da fonte geram aviso.

## Como gerar e enviar

Abra Controle de Equipamentos — Apoio, aplique os filtros desejados e use **WhatsApp · Cobrar retorno**. Selecione a qualidade e gere as imagens. Confira a prévia adaptativa no celular e as páginas numeradas.

**Alta** usa 960 pixels de largura e é a opção inicial recomendada para celular. **Ultra** usa 1440 pixels de largura e produz arquivos maiores. A altura varia conforme o texto de cada página; não há mudança de informação entre as qualidades.

Use o compartilhamento disponível na prévia para abrir o seletor nativo do aparelho e escolher WhatsApp e o grupo. A compatibilidade depende do navegador, HTTPS e suporte do aplicativo ao Web Share de arquivos. Se não estiver disponível, baixe o PNG da página e envie manualmente. Conjuntos com várias páginas também podem ser baixados em ZIP; extraia os PNGs antes de enviar. Para preservar melhor a definição, use o envio HD ou como documento no WhatsApp, quando disponível.

**Nenhuma mensagem é enviada automaticamente a um grupo.** Compartilhar é uma ação explícita do usuário e o destino é escolhido no aparelho. Mudanças na seleção invalidam a prévia antiga para que ela não seja confundida com as ordens filtradas atuais.

## Instalação e validação

Publique o conteúdo integral do ZIP compilado na hospedagem atual, substituindo a versão anterior. O pacote de fontes contém o projeto completo e os testes para editar e recompilar.

Não é necessária nova migração SQL. Esta atualização não altera nem exclui dados de produção. As alterações anteriores, incluindo o corte das 07:10 de Lavagem/Lubrificação, permanecem no pacote.

A imagem `demonstracao-relatorio-whatsapp.png` usa **dados fictícios**, identificados nos cartões, apenas para mostrar o formato. Não é um relatório da sua frota real. A versão não foi publicada automaticamente.
