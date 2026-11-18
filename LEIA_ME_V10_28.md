# v10.28 — Seleção individual no relatório de oficina e PNG direto, sem ZIP
Dois ajustes no painel **Relatórios em imagem** do **Controle de Equipamentos — Apoio**, sem mudança de dados:
## 1. Marcar e desmarcar cada equipamento
A prévia do relatório **Equipamentos em Oficina de Terceiros** virou uma lista de seleção: cada equipamento tem uma caixa de marcação (já vem marcado). Desmarque quem não deve ser cobrado da manutenção e o registro sai do PNG na hora — a linha fica esmaecida e o contador mostra “x de y marcados”. Os botões **Marcar todos** e **Desmarcar todos** agem sobre o que está visível no filtro atual (busca e oficina), então dá para desmarcar em lote e depois marcar só alguns.
A seleção vale apenas para este relatório: a lista de ordens abaixo, o PDF, o Excel, a imagem premium e o WhatsApp não mudam.
## 2. Download direto de uma única imagem
O relatório não gera mais ZIP. **Baixar imagem PNG** baixa um único arquivo `equipamentos-oficina-terceiros-AAAA-MM-DD.png`, com 921 px de largura e 1600 px de altura no modo celular em pé. Se a seleção não couber em 1600 px, a mesma imagem cresce em altura (até 12.000 px, cerca de 70 linhas), em vez de virar várias páginas. O rodapé mostra quantos equipamentos entraram e o aviso confirma o tamanho e a quantidade baixada.
## O que continua
Busca por frota/modelo/oficina, seleção múltipla de oficina, **Limpar filtros do relatório**, logotipo transparente no cabeçalho verde, três colunas (Equipamento, Modelo, Prestador) e o botão **Oficina de terceiros** na barra de relatórios seguem funcionando. O painel abre por padrão acima da lista e pode ser recolhido pelo título.
## Publicação
Publique no Netlify todo o conteúdo do ZIP compilado da **v10.28**, com `index.html` na raiz; depois, faça uma recarga forçada e confirme `v10.28` no menu lateral. Esta versão inclui a v10.27 (painel visível e filtros), a v10.26 (relatório de oficina de terceiros) e a v10.25 (Carreta Tanque Vinhaça fora da Lavagem/Lubrificação).
## Verificação
`npm run test:oficina-terceiros` passou: seleção e filtros (dados), imagem única no navegador (43 verificações: 921 × 1600, lista de 40 equipamentos crescendo em altura, rodapé com a contagem, seleção parcial, logotipo sem caixa branca) e teste de interface (caixas de seleção, desmarcar 4512, download direto `.png` com 1 equipamento, Marcar/Desmarcar todos, busca e oficina filtrando). `npm run check` e `npm run build` passaram.
