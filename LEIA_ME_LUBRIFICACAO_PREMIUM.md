# Lavagem/Lubrificação — interface premium

Esta atualização mantém a versão visual do Apoio entregue anteriormente e reorganiza o controle de Lavagem/Lubrificação. O cabeçalho usa o logotipo e o verde institucional Branco Peres. Indicadores de situação, filtros e ações ficam separados em blocos, com menos informações repetidas nas linhas.

## Listagem e edição

A tabela passa a reunir equipamento/OS, serviço/local, programação, situação, data realizada e observações. A coluna Ações fica fixa à direita durante a rolagem horizontal. O botão Editar aparece tanto nas programações manuais quanto nas ordens PCM, inclusive nas encerradas. O quadro também recebe o botão Editar.

Na edição PCM podem ser ajustados local, tipo de serviço, data programada, horário, situação, data realizada e observação. A frota e a identidade da OS ficam preservadas para não romper o vínculo com o PCM. As programações manuais continuam com edição de frota e as ações rápidas existentes. Exclusão de ordens automáticas permanece bloqueada para preservar o histórico.

Os ajustes PCM são persistidos por campo no Supabase, não apenas no navegador. Uma sincronização comum preserva os campos editados. Transições oficiais de situação, ausência e reaparecimento da ordem continuam atualizando o ciclo operacional. O formulário conserva os dados digitados e mostra um erro se a gravação falhar; não apresenta uma gravação recusada como sucesso.

## Data realizada e encerramento

Conforme a nova regra solicitada, quando uma ordem deixa de constar na listagem válida da Gestão de Ordens, o controle a trata como encerrada. A data realizada automática é o dia em que a integração detectou essa saída, pelo fuso America/Sao_Paulo. Não se usa a data atual ao abrir a tela nem a data programada como substituta.

Uma data informada pelo usuário tem prioridade. Se a ordem reaparecer na fonte válida, a integração reabre o ciclo e remove a conclusão anterior conforme a reconciliação. Falhas de consulta, fontes desatualizadas e remoção da frota do cadastro Apoio não devem criar uma nova conclusão automática.

A frase técnica “encerrada por ausência em …” é ocultada nas observações visuais. A data/hora da detecção e os metadados continuam disponíveis no histórico, separados da confirmação humana de execução. A data automática é uma convenção operacional baseada no desaparecimento detectado; ela não informa a hora exata em que o PCM encerrou a ordem.

## Instalação obrigatória

Para ativar a gravação das edições PCM e a nova regra no servidor, execute a migração incremental `supabase/PCM_EDICAO_PREMIUM.sql` no Supabase usado pelo aplicativo, depois das migrações anteriores de Apoio, automação PCM e histórico PCM. As instruções específicas ficam em `supabase/INSTALL_PCM_PREMIUM.md`.

Esta entrega não executa o SQL nem publica o aplicativo online. Publique a versão compilada depois da migração. Não reexecute as versões antigas dos reconciliadores após a migração nova: elas substituiriam as regras atualizadas.

O ZIP compilado tem `index.html`, `assets`, logotipo, imagens e worker PDF na raiz, seguindo a estrutura de hospedagem anterior. Extraia e publique o conteúdo completo na hospedagem atual. O ZIP de fontes inclui o projeto e os scripts de instalação. Para recompilar:

```bash
npm ci
npm run build
```

## Preservação e verificações

O módulo Apoio e seus relatórios foram preservados. A exportação diária de Lavagem/Lubrificação mantém a seleção de atrasados mais a programação da janela diária até as 06:00 do dia seguinte. A alteração não cria ordens de exemplo nem modifica cadastros reais durante os testes.

Os testes locais cobrem a renderização da tabela, disponibilidade de edição, ocultação da frase técnica, datas, filtros e exportações. A validação TypeScript do projeto original tem três diagnósticos preexistentes em `src/pages/ManutencaoEquipamentos.tsx`, linhas 505–506, relativos a `resetarCategorias`; essa tela não faz parte desta atualização. O Vite consegue compilar o aplicativo, mas esses diagnósticos antigos permanecem no `tsc`.
