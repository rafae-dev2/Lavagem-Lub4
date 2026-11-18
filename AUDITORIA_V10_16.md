# Auditoria v10.16 — pesquisa Apoio e login de imagens

## Conexão confirmada

O conector Supabase do Manus listou o projeto qcpnnyqzosnomvvytmfi como ACTIVE_HEALTHY. O servidor disponibiliza banco, migrations, funções Edge e consulta de projeto, mas não ferramenta para atualizar Site URL ou Redirect URLs do Auth. A sessão do painel web não estava autenticada na primeira tentativa; na retomada, o navegador do painel estava indisponível. Não foi feita alteração de URLs de autenticação, ordem, imagem, política ou permissão no Supabase.

## Evidência do erro

As capturas mostram localhost:3000 e ERR_CONNECTION_REFUSED, porque localhost aponta para o próprio aparelho e não para o Netlify. Outra captura inclui error_code=otp_expired, que indica credencial inválida, expirada ou consumida. Os dois problemas são diferentes: mudar o destino não recupera um link expirado. O acesso deve ser solicitado novamente com o e-mail autorizado, usando a mensagem mais recente.

## Pesquisa do Apoio

O campo está fora do details, imediatamente abaixo dos filtros e antes das abas de status. A fixação é no fluxo do main rolável, sob o cabeçalho, sem painel fixo inferior cobrindo ordens. Um override local de overflow permite a fixação no módulo. Campo, limpeza, contagem e filtros dos relatórios continuam associados ao mesmo estado query.

O teste full Layout local usou os estilos reais e dados sintéticos em 390×844 e 1366×900. Validou filtros fechados com pesquisa visível, posição no topo interno do main após rolagem, limpeza restaurando quatro ordens, botões PDF/Excel visíveis e zero escritas de dados. O teste estático, TypeScript e regressões de tabela Apoio, menu e tabela padrão de Lavagem passaram.

## Alternativa de autenticação

A confirmação dentro de Configurações usa o Supabase Auth e mantém a verificação is_equipment_image_editor. Não há liberação de upload anônimo. O endereço original de verificação do e-mail pode ser confirmado dentro do aplicativo, sem seguir o redirecionamento para localhost. O código só funciona se estiver presente no template do e-mail. Links de outro servidor, credenciais de sessão e endereços da página localhost de erro não devem ser aceitos como links de verificação.

O retorno identificado por editor_login=1 ou fragmento de autenticação abre Configurações; rotas operacionais explícitas têm prioridade e a marca de retorno é removida ao navegar. Tokens não são registrados em logs ou no helper de navegação.

## Limites

A configuração definitiva Site URL/Redirect URLs permanece pendente no painel Supabase e está descrita no LEIA_ME_V10_16.md. A confirmação alternativa evita esse retorno, mas não altera o destino dos links antigos. Os testes de login usam serviços simulados e não enviam e-mails nem trocam imagens reais. Após republicar a versão, o usuário precisa solicitar uma nova mensagem e confirmar o acesso com sua credencial; o teste simulado não prova entrega real de e-mail ou login fim a fim.

## Resultado final dos testes do acesso

Passaram helpers de link/código restritos, payload de verifyOtp, redirect por query e mensagens de expirado/usado. O teste de navegador com Auth simulado validou envio, rejeição de localhost e URL inválida, OTP expirado, confirmação sem permissão e confirmação autorizada com credencial removida do campo. Também passou o teste existente de upload comprimido, rollback, PDF/Excel e restauração. TypeScript e build completo v10.16 passaram; permanecem avisos de tamanho de chunks preexistentes. Nenhum e-mail foi enviado e nenhuma imagem real foi modificada nos testes.
