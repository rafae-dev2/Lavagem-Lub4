# Apoio — seletor de frotas localizado

## O que foi corrigido

O seletor anterior colocava todos os grupos em uma única coluna no celular e abria a escolha de frotas somente no fim da seção. Com muitos grupos, a seleção ficava distante do ponto tocado. A nova versão organiza os grupos lado a lado e abre o painel imediatamente abaixo da linha do grupo clicado, mantendo a escolha no mesmo trecho da tela.

Os grupos ocupam duas colunas em celulares comuns, com mais colunas conforme o espaço disponível no desktop. Os nomes podem quebrar linha, os controles têm área de toque confortável e a lista de frotas possui rolagem própria. O painel acompanha a linha correta ao redimensionar a janela ou alterar a orientação. Não é uma janela sobreposta: é uma expansão integrada ao local do clique, evitando cobrir outros controles.

## Como usar

Clique no nome do grupo para abrir as frotas. Clique novamente para fechar; isso não limpa as escolhas. O controle de seleção independente do grupo permite incluí-lo ou removê-lo dos filtros. Dentro do painel, marque ou desmarque as frotas, use a pesquisa pelo número ou as ações **Selecionar todas** e **Nenhuma**.

As alterações são aplicadas imediatamente à tela e aos relatórios, sem precisar salvar. **Concluir**, o botão de fechar ou a tecla **Esc** fecham apenas o painel e mantêm a seleção. Abra outro grupo para continuar escolhendo equipamentos: a seleção é independente em cada grupo.

**Todos** e **Limpar filtros** restauram a consulta ampla e fecham o painel. Não selecione “Nenhuma” esperando voltar à consulta ampla: essa ação exclui as frotas somente daquele grupo, conforme a regra já implementada.

Os cliques da frota usam o checkbox e sua área de seleção sem sobreposição de controles invisíveis ou disparos duplicados. A atualização preserva todos os modos de relatório e seus filtros por frota, oficina, prestador, status e busca; o tema Glassy Dashboard V18 e os demais temas; a reconciliação de cadastros e as regras anteriores de Lavagem/Lubrificação.

## Publicação

Substitua os arquivos hospedados pelo conteúdo integral do novo ZIP compilado. O ZIP de fontes contém o projeto editável completo e os testes. Esta atualização é de interface: não altera registros do banco nem exige migração SQL. A versão não foi publicada automaticamente.

As imagens de demonstração usam registros fictícios, sinalizados na prévia. Os números de frota e quantidades não são dados reais da empresa.
