# Auditoria v10.14

A regra de leitura de modo móvel passou a retornar Tabela em cada inicialização. A gravação da preferência móvel não substitui o padrão; os botões continuam alterando o estado da sessão. A leitura/gravação da preferência desktop permaneceu intacta. A definição de chave de dispositivo continua capturada ao abrir o módulo, para não mudar de escopo durante zoom/rotação.

O teste programacao-view-preference.test.cjs cobre retrato 390 px e paisagem 844 px com preferências antigas Cartões/Quadro, reabertura em Tabela, preferência desktop Quadro, armazenamento indisponível e renderização sem window. Também verifica que o cabeçalho não foi reduzido e o pinch-zoom continua permitido no CSS.

O componente tabular e os recursos de ações/detalhes não foram alterados. Não houve mudança em ordens, frotas, imagens, relatórios ou no Supabase. O build deve ser republicado no Netlify para a nova regra entrar no site. Testes de zoom/rolagem realizados na v10.13 permanecem aplicáveis porque esses arquivos não foram modificados.
