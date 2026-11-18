# Lavagem e Lubrificação — encerradas de hoje desde as 07:00

A exportação agora inclui as ordens encerradas **hoje, das 07:00 inclusive até o horário da geração**, no horário de Brasília. Ordens encerradas ontem, antes das 07:00 de hoje, sem referência válida de encerramento ou com horário futuro não entram. Registros arquivados continuam excluídos.

A correção vale para PNG, PDF e resumo WhatsApp. O corte de visualização das 07:10 e a opção de ocultar encerradas na tela não retiram essas ordens dos relatórios. A situação Encerrado permanece disponível durante todo o dia e não muda automaticamente para Todas.

Os filtros de situação, serviço, origem e grupo Apoio continuam sendo respeitados. O padrão de origem do módulo permanece PCM. Para incluir também manuais, escolha **Origem: Todas**. Com **Situação: Todas**, o relatório inclui as ordens abertas da janela operacional existente junto às encerradas que atendem ao intervalo. Com **Situação: Encerrado**, inclui somente as encerradas desse intervalo.

Para ordens PCM, a referência é o horário de detecção de encerramento registrado na integração, não a antiga data programada nem uma confirmação de execução inferida. Em registros manuais legados, não existe horário separado de conclusão: utiliza-se a data realizada e o horário registrado na programação. Manuais sem data realizada não são incluídos apenas pela data agendada. Essa limitação dos dados antigos é informada na tela.

## Instalar

Use o novo pacote compilado no mesmo site Netlify: descompacte e envie o conteúdo com `index.html`, `assets`, `_redirects` e os demais arquivos. Não publique o ZIP como se fosse um arquivo de página. Esta versão completa preserva Modo TV, filtros do Apoio, Realtime e as melhorias de contraste e animação do Glassy V18.

O código-fonte completo também acompanha a entrega. Para compilar: `npm ci`, `npx tsc --noEmit` e `npm run build`; o diretório de publicação é `dist`.

**Não é necessário executar SQL nem reconfigurar o Supabase para esta correção.** A habilitação Realtime anteriormente realizada permanece ativa. Esta tarefa não alterou ordens, cadastros ou funções remotas. A nova versão não foi implantada automaticamente no site Netlify.

## Validação

Testes de seleção cobrem 06:59:59, exatamente 07:00:00, 07:00:01, a passagem de 07:10, o intervalo até a geração e a troca de dia. Preservam filtros explícitos, exclusão de arquivadas e a ausência de mutação nos registros. Há teste isolado da geração PNG e PDF usando dados fictícios, com tráfego externo bloqueado. O PNG é conferido pelos textos efetivamente desenhados no canvas e o PDF pelos textos extraídos do arquivo baixado.
