# Auditoria da evolução v10.3

## Escopo entregue

ControleApoio recebeu barra direta de busca por frota/OS/narrativa, alternância Cartões/Tabela, preferência de modo, tabela semântica com detalhes completos e rolagem contida/acessível. A seleção de filtros, recência, histórico e encerradas é a mesma nos dois modos. Relatórios recebem todas as linhas filtradas, não somente as40 da página.

Quatro controles separados foram adicionados: Rodomuda, Colhedora, Trator Transbordo e Trator Reboque. Rotas, menu em Controle de reformas, metadados, filtros/status, cartões/tabela, detalhes, paginação de 24, relatórios PDF/Excel e sincronização reutilizam a implementação compartilhada dos acompanhamentos. Encerramento operacional, reabertura e corte07:10 foram preservados.

Cartões, KPIs e espaçamentos de Apoio, acompanhamentos e Lavagem foram compactados. O Dashboard recebeu padding menor nos indicadores/painéis, sem reduzir gráficos. ModoTV permanece com dimensões apropriadas à leitura à distância. Os grids foram validados conforme espaço útil com menu lateral:1/2/3/4colunas; o terceiro estágio começa em1020px úteis no container de acompanhamento, para atender corretamente computadores1366px com sidebar.

## Inspeção da integração real

Consulta autorizada somente leitura no projeto Supabase atual confirmou os grupos e frotas já cadastrados: Carreta Rodomuda22 frotas, Colhedora11, Trator Reboque6 e Trator Transbordo 29. Esses números representam cadastros, não ordens de reforma. Não foram criados cadastros duplicados nem alterados dados/segredos/políticas do Supabase nesta evolução.

Cada reforma especializada exige equipamento próprio cadastrado e categoria resolvida, com prioridade para grupo/nome de cadastro, fonte explícita e mapas conhecidos de Rodomuda/Colhedoras como fallback. Transbordo/Reboque não são inferidos de Tratores Pesados/Geral nem de menções de outros equipamentos na narrativa. Reforma mantém a mesma lógica conservadora da etapa anterior; a ausência de ordens elegíveis gera estado vazio explicativo, não exemplos artificiais.

## Evidências e correções

Testes de tipos e UI comprovam seleção própria dos quatro módulos, prioridade do cadastro, mapa exato, grupos genéricos sem divisão arbitrária, rejeição de pranchas/caminhões, reforma explícita, encerramento e reabertura. Os testes existentes de acompanhamento, encerradas, filtros, fonte, relatórios e PostgreSQL isolado continuam disponíveis nos scripts de validação.

O teste visual dos sete acompanhamentos aprovou **126 cenários**:7módulos×3temas×6larguras,320–1920px, com sidebar, logo, detalhes e grades1/2/3/4, sem overflow. O teste funcional da tabela Apoio aprovou **7 combinações** de viewport/tema, verificando busca por frota/OS/narrativa sem acentos, troca de modo sem perder busca, expansão, encerradas sem atraso, preferência após reload e zero gravações no mock.

A revisão independente read-only confirmou integração e testes e identificou uma pendência de acessibilidade na rolagem da tabela Apoio. Corrigida com tabIndex0, região rotulada e foco visível; o teste permanente exige esses atributos. A inspeção das prévias também confirmou e corrigiu baixo contraste do modo ativo e transparência da tabela sobre a decoração; fundo opaco, texto ativo branco e primeira coluna fixa foram acrescentados e validados. Foram usados fixtures/mocks locais e PostgreSQL isolado, sem inserir/encerrar ordens reais. `npm audit --omit=dev` registrou zero vulnerabilidades conhecidas.

## Limites e publicação

Não há garantia de ausência absoluta de falhas nem de suporte a navegadores antigos sem container queries. CSS mantém fallback de uma coluna onde recursos modernos não estejam disponíveis. A configuração das permissões públicas legadas continua pendência independente da revisão de interface; não foi reduzida ou ampliada nesta evolução.

A entrega v10.3 é fonte/compilado, não uma publicação automática no Netlify. É necessário subir o compilado completo no endereço principal, após backup. Não misturar assets nem reexecutar SQLs de instalação antigos. As fontes incluem regras, instruções e comandos reproduzíveis de validação.
