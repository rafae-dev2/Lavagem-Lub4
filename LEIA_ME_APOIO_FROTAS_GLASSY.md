# Apoio — filtro de frotas e tema Glassy Dashboard V18

Esta atualização preserva os recursos entregues anteriormente: relatórios sem o bloco de filtros, resumo WhatsApp, nome da oficina externa, imagem única, PDF único, seleção por origem/prestador/status/busca e a regra das 07:10 em Lavagem/Lubrificação. Não altera registros do banco nem exige migração SQL.

## Escolher as frotas de cada grupo

Abra **Controle de Equipamentos — Apoio** e localize **Filtrar grupos Apoio**. Clique no grupo desejado para abrir a seleção dos equipamentos cadastrados. Marque os números de frota que devem aparecer na tela e nos relatórios. Use a pesquisa para localizar uma frota e as ações de selecionar todas ou nenhuma para agilizar.

É possível escolher frotas de vários grupos ao mesmo tempo. Cada grupo mantém a sua seleção independente: escolher uma frota de um grupo não exclui automaticamente as frotas de outro grupo selecionado. Dentro de um grupo, nenhuma frota marcada significa nenhum equipamento daquele grupo; sem uma restrição específica, entram todas as frotas do grupo.

Os outros filtros continuam atuando em conjunto. Uma frota selecionada sem ordem na visão, no local ou no status escolhido pode não gerar linha no relatório. O cadastro pode aparecer na seleção mesmo sem ordem, para você distinguir um equipamento cadastrado de um equipamento com ordem atual.

O resultado filtrado completo é usado por **todos os relatórios**, não apenas pelos registros visíveis na página da lista: PDF detalhado, Excel, imagem detalhada, WhatsApp em páginas, imagem única e PDF único. Os números de frota escolhidos podem aparecer como metadados de seleção no Excel; PDF e PNG continuam sem o bloco dos filtros, conforme solicitado.

Use **Todos** ou **Limpar filtros** para voltar à seleção ampla. As escolhas não alteram o grupo de cadastro de uma frota, não encerram ordens e não são uma atualização no Supabase.

## Glassy Dashboard V18

O novo tema fica disponível no seletor de temas do cabeçalho, com o nome **Glassy Dashboard V18**. Ele é uma opção adicional: os temas Claro, Dark, Glass e os demais continuam disponíveis. A escolha é lembrada neste navegador pelo mecanismo de temas existente.

A referência é o vídeo enviado: painéis de vidro fumê em tons quentes, fundo ambiente taupe/âmbar, bordas claras finas, blur, cantos arredondados, sombras suaves e acentos azulados. O acabamento é aplicado aos elementos próprios do aplicativo, preservando dados, navegação e funções. O vídeo é uma referência visual; os números e gráficos de exemplo nele não são copiados para a frota real.

A reprodução acompanha o estilo, material e hierarquia da referência. Não é uma cópia pixel a pixel do dashboard do vídeo, que possui conteúdo e estrutura diferentes. Em celulares e navegadores com suporte reduzido a blur, fundos mais opacos mantêm a leitura. Os relatórios exportados continuam com a identidade premium verde já implementada, independentemente do tema escolhido na tela.

## Instalação

Substitua a versão hospedada pelo conteúdo integral do novo ZIP compilado. O pacote de fontes contém o projeto editável completo e os testes. Não é necessária nova migração SQL. A versão não foi publicada automaticamente.

As prévias entregues usam dados fictícios sinalizados e não representam os registros reais da sua empresa.
