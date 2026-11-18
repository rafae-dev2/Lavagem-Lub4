# Lavagem/Lubrificação — relatório operacional e corte 07:10

Esta atualização substitui a seleção Completo de todos os dias da versão anterior. O relatório passa a ter uma única seleção operacional; não existe uma opção que reintroduza automaticamente todo o histórico.

## Relatório — horário de Brasília

| Momento da emissão | Ordens incluídas | Limite futuro |
|---|---|---|
| Antes das 07:10 | Atrasadas anteriores, serviços em andamento, programações de hoje e amanhã no limite, e encerradas do turno ainda vigente | Amanhã até 07:10:00, inclusive |
| A partir das 07:10 | Somente atrasadas, programadas e em andamento; todas as encerradas saem do relatório | Amanhã até 07:00:00, inclusive |

Programados de datas anteriores aparecem como atrasados somente no arquivo. O status armazenado no banco não é alterado. Ordens já em andamento de datas anteriores continuam no relatório. Ordens em andamento sem data de programação válida continuam visíveis para não perder um serviço aberto. Pendentes, manuais arquivados e programações além do limite futuro não são exportados. Programações de amanhã sem horário válido não são presumidas dentro do corte.

Antes das 07:10, as encerradas são incluídas somente se a referência de conclusão pertence ao turno ainda vigente: do corte de 07:10 do dia anterior até o instante da emissão. No PCM, a referência é a detecção do encerramento, nunca a antiga data programada. Para registros manuais, usa-se a data realizada com horário registrado, ou a programação como referência legada. Encerradas antigas e registros sem referência válida não são incluídos no relatório por inferência.

Exemplo: ao emitir em 05/11 antes das 07:10, o limite de amanhã é 06/11 às 07:10. Ao emitir em 05/11 às 07:10 ou depois, encerradas saem e o limite de amanhã passa a 06/11 às 07:00. À meia-noite as datas de hoje e amanhã são recalculadas.

## Tela de controle

A tela de Lavagem/Lubrificação continua carregando as ordens dos demais dias. A janela do relatório não limita a tabela nem o quadro.

O processo já existente de ocultar encerradas de turnos anteriores muda de 07:20 para **07:10**, no fuso America/Sao_Paulo. Encerradas da janela atual continuam disponíveis no controle; as de janelas anteriores são ocultadas por padrão. O botão Mostrar Encerradas permite consultar o histórico sem excluir registros. Na próxima virada das 07:10, a ocultação automática é reativada. Essa consulta manual não traz encerradas de volta ao relatório depois das 07:10.

## Arquivos e filtros

PDF, PNG, resumo e contadores usam a mesma seleção operacional. Serviço, origem, grupo Apoio e situação continuam disponíveis. A origem inicial permanece PCM; escolha **Origem: Todas** para incluir registros manuais. Depois das 07:10, a opção Encerrado deixa de ser oferecida no filtro de situação do relatório.

Ao mudar de janela — meia-noite ou corte das 07:10 — a imagem gerada anteriormente é invalidada. É preciso gerar novamente para baixar com a regra atual. A geração de PDF e PNG também confere a janela antes de concluir para evitar salvar uma seleção feita antes da virada.

## Instalação

Publique o conteúdo integral de `applav-compilado-corte-0710.zip` na hospedagem, substituindo a versão anterior. O compilado contém index.html, assets e recursos na raiz. O pacote de fontes contém o projeto editável, os testes e esta orientação.

**Não é necessária nova migração SQL.** Este ajuste não altera nem exclui dados do banco e mantém a migração PCM premium já instalada. A versão não foi publicada automaticamente.

Os documentos das versões anteriores descrevem regras substituídas; para a seleção do relatório e o horário de corte, considere este documento como referência atual.
