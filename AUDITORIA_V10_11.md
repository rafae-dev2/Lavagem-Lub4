# Auditoria v10.11

A revisão confirmou dois fundos reais remanescentes no catálogo: Caminhão Caçamba e Reboque Prancha. As outras11 imagens tinham alpha transparente. Os dois fundos foram removidos; a auditoria programática confirmou pixels com alpha 0 em todos os13 PNGs. Os recortes foram inspecionados sobre fundo neutro, sem reabrir as capturas anexadas pelo usuário.

O defeito dos filtros Apoio vinha da herança do grid de filtros simples dos acompanhamentos, aplicado a blocos compostos de busca, abas e filtros. A correção escopada separa busca/abas dos campos e mantém o corpo em fluxo vertical. Teste de navegador com dados simulados passou nas larguras390, 768, 955, 1024 e 1440 px: sem overflow da página, campos pesquisáveis preservados, seleção/deseleção e abas sem esticamento artificial. A tabela real de Lavagem e os cartões usam modos explícitos, sem conversão automática da escolha Tabela em cartões no celular.

O teste real de upload no Chromium confirmou reencodificação, dimensões e limite de bytes antes de enviar; o WebP resultante manteve alpha 0 e 255. A imagem de teste foi reduzida de aproximadamente1,3 MB para cerca52 KB,640 × 427 px. O valor final varia com a imagem. Testes de mocks complementares cobrem rejeição de SVG/formato indevido, arquivo vazio, entrada acima8 MiB, excesso de pixels, fallback PNG e nova redução quando necessário.

O teste de associação personalizou um grupo de teste sem ilustração padrão, confirmou a miniatura da frota/OS na tela, exportou PDF e Excel com a imagem incorporada e conferiu o arquivo Excel reaberto. Também confirmou rollback em falha de metadados, substituição com URL nova, exclusão do arquivo anterior somente após confirmação e restauração do padrão. Todos esses testes usaram serviços simulados; não criaram imagens falsas nos grupos reais.

O resolvedor compartilhado usa cadastro da frota e grupo antes da imagem padrão. Imagens personalizadas com URL externa arbitrária não são aceitas pelo carregador de relatórios: apenas o bucket previsto no Supabase autorizado. Cache de mídia usa a URL do objeto, não somente o nome do tipo. Leituras idênticas do catálogo não disparam nova renderização. Registros leves têm leitura paginada e timeout; a consulta do catálogo não acelera a sincronização de ordens.

A migração foi aplicada com sucesso no Supabase. Verificação real confirmou bucket público para leitura, limite180.000 bytes, MIME PNG/WebP, ausência de permissão de INSERT para anon e retorno false do RPC de editor sem autenticação. As políticas exigem e-mail autorizado assinado pelo Supabase Auth; a constante legada role=admin do Apoio não é usada como autorização deste recurso. Storage recusa excluir objeto ainda referenciado pelos metadados.

Foram corrigidas duas situações de borda na revisão: cancelar/mudar o grupo durante a preparação limpa o estado ocupado; restaurar uma imagem exige que o caminho anterior continue sendo o mesmo e atualiza o catálogo mesmo quando houver aviso na limpeza do arquivo. Uma falha de limpeza pode deixar objeto órfão pequeno no Storage; não corrompe nem apaga a imagem atual. Instabilidades de rede podem exigir nova consulta e conferência pelo administrador.

Passaram verificação TypeScript, catálogo de imagens, registro compartilhado, compressão/upload, Excel ilustrado, relatórios e classificação dos acompanhamentos, Central Gerencial, filtros/tabela Apoio, compactação e hierarquia do menu. As evidências visuais são dados simulados e não representam programações reais.

## Limites de conclusão

A infraestrutura de armazenamento foi configurada, mas o e-mail autorizado ainda não foi fornecido. O painel Supabase continuou na tela de login; a URL de retorno do editor não foi alterada. Portanto o recurso está protegido e permanece somente leitura até completar essas duas etapas. A nova versão do site ainda depende de publicação do compilado no Netlify. Os testes cobrem os cenários descritos, não garantem ausência absoluta de falhas em todos os navegadores, equipamentos e redes.

A tabela real de Lavagem também foi renderizada no Chromium em 390 px com o componente da aplicação: cabeçalho visível, display table, rolagem horizontal no contêiner, página sem overflow e alternância funcional para cartões compactos.
