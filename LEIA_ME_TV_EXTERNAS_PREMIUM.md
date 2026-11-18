# Modo TV — Emergenciais + Ordens Externas

Esta versão completa preserva o aplicativo existente, o Glassy V18, a habilitação Realtime do Supabase e a correção de encerradas de hoje desde as07:00 na exportação de Lavagem/Lubrificação.

## Os dois menus

**Modo TV — Emergências** abre o monitor de emergenciais em andamento. **Modo TV — Ordens Externas**, imediatamente ao lado dele na navegação, abre as ordens abertas em oficinas externas dos equipamentos cadastrados no Apoio. Também há botões dos dois painéis dentro do próprio monitor. Acesso direto: `/#modo-tv` e `/#modo-tv-externas`.

O painel externo não depende de classe emergencial: inclui ordens programadas, em andamento e aguardando peça, de todas as classes, conforme o status disponível na fonte e o filtro escolhido. Não inclui oficinas internas, campo, encerradas, ordens inativas ou equipamentos fora do cadastro de frotas do Apoio. Uma ordem externa emergencial pode aparecer em ambos os painéis: cada painel representa um recorte diferente, não uma contagem consolidada sem duplicações.

## Alternância na TV

Clique em **Apresentar na TV** ou use tela cheia. Por padrão, os painéis alternam a cada **12 segundos**. Em **Filtros > Apresentação na TV**, ajuste **Tempo por painel** para5,10,12,15,20,30 ou60 segundos. O seletor **Alternância dos painéis** permite alternar os dois ou manter apenas o escolhido.

A cada troca, avança a página do painel que acabou de sair. Assim, ao voltar, o monitor mostra suas próximas ordens, mesmo se um painel tiver muito mais ordens que o outro. O monitor exibe também painéis vazios com aviso, sem inventar ordens. Filtros e detalhes pausam a alternância enquanto abertos. O botão Pausar rodízio interrompe a troca automática; Iniciar rodízio retoma. Fora da apresentação, o botão do painel escolhe uma lista e o rodízio existente percorre suas páginas.

## Densidade e aparência

A quantidade automática adapta os cards ao tamanho da seleção: normalmente6,8 ou12 por página em telas largas. Em listas maiores, os cards diminuem, preservando destaque da frota, oficina e acesso à ordem completa. Também é possível fixar4,6,8 ou12. Se você já havia escolhido uma quantidade no monitor anterior, ela é preservada; para ativar a adaptação, escolha **Ordens por página: Automático**. Em telas menores, a disposição é responsiva; densidade muito alta pode exigir rolagem.

O botão **Claro premium / Escuro premium** troca a aparência própria do monitor sem alterar o tema do restante do aplicativo. O claro utiliza fundo perolado, cartões claros, texto escuro e selos semânticos de alto contraste. Filtros e detalhes seguem a aparência escolhida. A configuração fica salva neste navegador.

Os filtros dos dois painéis são independentes. A seleção de categorias pode ser diferente para emergências e externas. No painel externo, oficina externa e todas as classes são fixas para evitar mostrar ordens internas por engano. Busca, grupo, situação, prestador, setor, motivo, duração e ordenação permanecem combináveis.

## Instalação Netlify/Supabase

Publique o conteúdo do pacote compilado no mesmo site Netlify, com `index.html`, `assets`, `_redirects` e os demais arquivos. Fontes completos acompanham a entrega: `npm ci`, `npx tsc --noEmit`, `npm run build`; saída em `dist`.

**Não é necessária migração adicional no Supabase deste aplicativo.** Os dois painéis reutilizam o Apoio e as mesmas quatro tabelas Realtime habilitadas anteriormente. O `TV_MONITOR.sql` acompanha como referência para uma instalação distinta ou restauração, não para recriar o banco existente. Não foram inseridas ordens de demonstração no banco nem alterados cron, regras de acesso ou funções remotas nesta atualização.

A entrega é um front-end pronto para publicação. O novo compilado não foi implantado automaticamente no site Netlify.
