# Apoio WhatsApp — Imagem única e PDF único

Esta versão acrescenta dois modos ao resumo WhatsApp e preserva os recursos já implementados. O relatório em páginas continua disponível, assim como a prévia, os downloads e o compartilhamento explícito pelo aparelho. PDF e imagem detalhados permanecem sem o bloco de filtros. O nome da oficina externa continua vindo do prestador da ordem, por exemplo **Oficina Externa / Fratini**.

## Imagem única · Todas as ordens

A nova opção reúne todas as ordens selecionadas no Controle de Equipamentos — Apoio em um só PNG vertical. Não utiliza somente a página visível da tabela. A altura aumenta de acordo com o conteúdo, preservando os cartões, frota, oficina, prestador externo, OS e descrição do problema. O texto não é resumido artificialmente nem cortado para caber.

O cabeçalho e o pedido de retorno aparecem uma vez. A imagem pode ser revisada na prévia, baixada como PNG e compartilhada pelo seletor nativo, quando compatível. O modo em páginas continua sendo a melhor alternativa para leitura rápida no celular quando há muitas ordens.

A qualidade Alta mantém largura de 960 pixels; Ultra, 1440 pixels. Uma seleção extensa pode exceder o tamanho seguro de canvas/memória do navegador. Nesse caso o aplicativo avisa e orienta usar qualidade Alta, PDF único ou modo em páginas. **Não elimina ordens, não corta a imagem e não muda silenciosamente para várias imagens.** Os limites preventivos são 16.384 pixels de altura de saída e 16 milhões de pixels por imagem. Alguns aparelhos podem ter limites menores; se ocorrer falha, use PDF ou páginas.

Ao enviar uma imagem muito longa pelo WhatsApp, o serviço pode diminuir a resolução na modalidade foto. Para preservar o arquivo original, envie-o como documento ou use o PDF, quando disponível no aparelho.

## PDF único · Todas as ordens

A nova opção gera um único arquivo PDF do **resumo WhatsApp**, com todas as informações da seleção. O PDF usa páginas quando necessário: arquivo único não significa comprimir centenas de ordens em uma única página ilegível.

Cada página mantém o visual dos cartões, a identificação da frota/oficina e os textos completos. O conteúdo é inserido proporcionalmente, sem recorte. O botão de PDF detalhado já existente não é alterado; trata-se de outra opção no painel WhatsApp.

## Como usar

Aplique os filtros desejados em Controle de Equipamentos — Apoio e abra **WhatsApp · Cobrar retorno**. Use a geração em páginas como antes, ou escolha os novos botões **Imagem única · Todas as ordens** e **PDF único · Todas as ordens**. Confira a prévia da imagem ou abra o PDF baixado e envie ao grupo pelo próprio aparelho.

Os filtros continuam selecionando as ordens, mas seus rótulos não são impressos nos arquivos. Mudanças na seleção invalidam uma prévia antiga. Nenhum arquivo é enviado automaticamente a um grupo.

## Instalação

Publique o conteúdo integral do novo ZIP compilado, substituindo a versão anterior na hospedagem. O pacote de fontes contém o aplicativo editável e os testes. Os pacotes preservam a regra de Lavagem/Lubrificação com corte das 07:10 e as demais alterações anteriores.

**Não é necessária nova migração SQL.** Não há alteração nem exclusão dos dados do banco. A versão não foi publicada automaticamente.

Os arquivos de demonstração usam dados fictícios claramente identificados e não representam ordens reais da sua frota.
