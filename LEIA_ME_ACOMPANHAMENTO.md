> **Atualização v10.2:** consulte `LEIA_ME_V10_2.md` para os novos botões de encerradas, visibilidade compartilhada e diagnóstico do endereço principal. A documentação abaixo registra a etapa v10.1.

# Branco Peres — Manutenção integrada, versão 10.1

## Regra solicitada: saiu da fonte, encerrou

As ordens de Preventivas e Lubrificação de Carretas Canavieiras e Reformas dos Equipamentos Apoio passam a ser exibidas como **Encerrado** quando constavam na fotografia válida da Gestão de Ordens e deixaram de constar numa fotografia posterior válida. Essa regra vale nos cartões, tabela, filtros, indicadores, PDF e Excel.

O status original não é sobrescrito. A interface mostra **Saída da fonte**, a última presença e a data de detecção do encerramento operacional. Essa data é a detecção pela integração, não uma data de execução humana inventada. Se a ordem reaparecer, volta à situação atual da fonte. Falha, fonte antiga, resposta estruturalmente incompleta e marcas temporais inconsistentes não geram novos encerramentos. Ordens incompletas ficam em Outros com aviso para análise.

## Visual igual à identidade premium do Controle Apoio

Os três módulos reutilizam logo e faixas curvas da referência do Controle de Equipamentos — Apoio: marfim, verde profundo e dourado, cartões brancos opacos com moldura metálica, frota destacada, quadrantes de informação, narrativa e histórico expansível. A identidade local permanece legível nos temas claro, escuro e Glassy, sem alterar o tema dos demais módulos.

A grade responde à largura útil: uma coluna em celular/espaço estreito, duas a partir de 860px e três a partir de 1420px. Filtros são recolhíveis, controles possuem área de toque de pelo menos 44px e a tabela mantém sua rolagem dentro do próprio painel.

## Configuração já aplicada no Supabase

O Manus foi conectado ao projeto **qcpnnyqzosnomvvytmfi**, o mesmo configurado nas fontes originais. Foram aplicadas duas migrações incrementais e implantada a versão 4 da função `sync-ordens`.

A consulta `carregar_acompanhamento_manutencao` lê a view `manutencao_acompanhamento_ordens`, com SECURITY INVOKER/RLS, mantendo os mesmos cadastros e fotografia da Gestão de Ordens. A view calcula situação, origem e data de detecção sem alterar dados brutos. O aplicativo usa essa consulta e mantém fallback somente se a função não existir em uma instalação antiga; erros de permissão/rede não são mascarados.

O aplicador ganhou proteção contra campos obrigatórios omitidos e preserva a última classe/motivo/código de ponto quando uma fonte antiga não os disponibiliza. A previsão nula legítima continua aceita. As funções de escrita/sincronização seguem restritas a `service_role`; nenhum segredo privado foi incluído no navegador. O agendamento existente permanece uma vez por minuto.

Na verificação desta revisão, a leitura apresentou 1.767 ordens históricas/atuais, 697 presentes e 1.070 encerradas operacionalmente por saída. Esses números são da fotografia verificada em 08/11/2026 e variam conforme a operação. São totais da integração, não contagens exclusivas de cada um dos três módulos.

**Não execute novamente SQLs antigos nem a migração de renomeação do aplicador. O Supabase desse projeto já foi configurado.** Os arquivos `supabase/MANUTENCAO_ACOMPANHAMENTO.sql` e `supabase/MANUTENCAO_SNAPSHOT_GUARD.sql` ficam nas fontes para rastreabilidade. O segundo é uma migração de execução única, não um instalador repetível.

## Publicar a interface na hospedagem atual

Extraia `aplicativo-compilado-manutencao-revisado-v10.1.zip` e publique seu conteúdo completo no site atual. `index.html` deve ficar na raiz, acompanhado de `assets`, `logo.png`, equipamentos, worker PDF e demais arquivos do pacote. Não misture assets de builds diferentes. Faça backup da publicação anterior antes de substituí-la.

Depois da publicação, use Ctrl+F5 no computador ou feche/reabra o aplicativo no dispositivo. Essa publicação da interface **não foi realizada pelo Manus nesta revisão**, porque não foi fornecido acesso à hospedagem. As configurações Supabase acima já estão aplicadas e não dependem de repetir os SQLs.

Se publicar em outro domínio, esse domínio deve estar autorizado na configuração de origens do Supabase. A atualização não altera ordens no PIMS nem obriga o PIMS a gerar uma nova fotografia.

## Relatórios e filtros

Frota, OS, equipamento, grupo, local, prestador, entrada, previsão e narrativa são rastreáveis. Filtros por situação, grupo, local, prestador, período e busca se intersectam. Os indicadores mostram o recorte antes do filtro de situação; o cabeçalho de resultados informa a seleção efetiva. Previsão vencida é um alerta, não uma mudança de status.

Cartões e tabela usam a mesma seleção. A tela pagina em 24 ordens. PDF e Excel incluem toda a seleção, não somente a página visível, com cabeçalho institucional, resumo, filtros, datas da fonte e avisos. O Excel preserva campos brutos e textos potencialmente interpretados como fórmulas são protegidos.

Reformas exigem frota cadastrada em Controle Apoio. Os critérios de seleção de serviços e equipamentos estão em `REGRAS_ACOMPANHAMENTO.md`. Descrições sem identificação explícita podem não ser selecionadas; a Gestão de Ordens completa continua disponível.

## Desenvolvimento e testes

Para trabalhar nas fontes, use **Node.js 22.13 ou superior** e npm. Esse requisito decorre da versão corrigida do parser PDF. O compilado é estático e não exige Node.js no dispositivo dos usuários. Extraia o ZIP de fontes, entre na pasta `aplicativo` e execute:

```bash
npm ci
npm run check
npm run test:acompanhamento
npm run test:sql
npm run build
```

O compilado fica em `dist`. `npm run test:visual` requer Python Playwright e Chromium; o teste abre uma instância headless isolada com ordens sintéticas e bloqueia acesso externo. Não usa o Supabase de produção. O teste PostgreSQL usa PGlite em memória.

## Segurança e limites

As dependências vulneráveis foram atualizadas: PDF.js 6.2.108 e SheetJS 0.20.3. O tarball oficial do SheetJS está em `vendor`, com integridade no lockfile, para instalações reproduzíveis sem depender de disponibilidade do CDN. A auditoria npm de produção não reportou vulnerabilidades conhecidas após a atualização. Isso não é uma garantia absoluta de segurança.

**Persistem permissões públicas herdadas:** Lavagem não possui RLS, e cadastros Apoio/algumas funções PCM permitem ações sem login por decisão da arquitetura recebida. Não foram bloqueadas unilateralmente, pois isso interromperia usuários e módulos existentes. Antes de ampliar a exposição do aplicativo, é necessário definir autenticação e perfis autorizados e migrar essas permissões. O relatório `AUDITORIA_REVISAO_MANUTENCAO.md` detalha os riscos e os links oficiais de correção.

Os cinco módulos removidos na primeira entrega permanecem removidos. Gestão de Ordens, Controle Apoio, Lavagem/Lubrificação, Calendário, TV e Configurações foram preservados. Não foi feita auditoria operacional de cada equipamento real nem edição de registros reais para teste. Os testes visuais são automatizados, não testes em todos os modelos de dispositivos físicos existentes.
