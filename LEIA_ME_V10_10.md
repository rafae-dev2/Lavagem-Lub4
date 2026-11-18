# Versão 10.10 — equipamentos ilustrados nas telas e relatórios

As 13 imagens enviadas foram incluídas no próprio aplicativo, em `public/equipment-types`. As versões PNG preservam a transparência, todos os pixels e a proporção dos originais. Nenhuma imagem depende de um endereço temporário de upload. As imagens são **ilustrações de tipo**, não fotos da frota ou do modelo exato em manutenção.

## Associações

| Tipo identificado | Imagem fornecida |
|---|---|
| Veículo leve | VeículolevesOrochi.png |
| Caminhonete | caminhonetegeral.webp |
| Caminhão caçamba | caminhãoCaçamba.webp |
| Caminhão carga seca | caminhãocargaseca.webp |
| Caminhão cavalo | caminhãocavalo.webp |
| Caminhão munck | caminhãomunck.webp |
| Caminhão pipa | caminhãopipa.webp |
| Carreta canavieira | carretacanavieira.webp |
| Carreta rodomuda | carretarodomuda.webp |
| Colhedora | colhedora.webp |
| Reboque prancha | reboqueprancha.webp |
| Trator geral, transbordo ou reboque | tratortranbortoereboque.webp |
| Área de vivência | áreadevivência.webp |

Uma única função decide a ilustração usada na tela e no documento. Dá prioridade à identidade estruturada do grupo/categoria e do equipamento, depois à fonte e ao mapa exato das frotas existentes. Textos da narrativa de serviço não escolhem a imagem: uma ordem de caminhão mencionando um trator não vira trator. Identidades conflitantes ou genéricas demais e equipamentos sem uma imagem fornecida permanecem sem ilustração específica. Caminhão de coleta, por exemplo, não recebe indevidamente a imagem de carga seca. A imagem de trator é compartilhada e não altera a separação dos módulos Transbordo e Reboque.

## Onde aparece

No Controle Apoio e nos sete acompanhamentos, a miniatura aparece ao lado da identidade dos cartões e dentro da célula correspondente das tabelas. A consulta de ordens da Central Gerencial também recebe miniaturas, sem transformar as imagens em novos dados ou alterar os indicadores. Lavagem/Lubrificação recebe imagens na tabela e no quadro de turnos; Calendário nas ordens selecionadas, Dashboard nas listas de tarefas e Modo TV na identificação de equipamentos. Cabeçalhos genéricos, gráficos estatísticos, telas de configuração/importação e filtros não recebem fotografias decorativas sem equipamento identificado.

**Gestão de Ordens Manutenção é um site externo dentro de um iframe.** O código recebido só incorpora esse site; suas ordens internas e seus relatórios não podem ser modificados pela aplicação hospedeira, devido à separação de origens. Esta versão não afirma inserir imagens dentro dele. Para isso será necessário acesso às fontes ou autorização de alteração no sistema externo. As ordens consultadas desse sistema nos módulos nativos do aplicativo recebem as imagens normalmente.

## Relatórios

PDF de Apoio, dos acompanhamentos e da Central: miniaturas PNG incorporadas nas linhas, com espaço reservado para não cobrir a identificação. Preservados cabeçalho, filtros, narrativa, datas, todas as ordens selecionadas e paginação. Equipamentos não identificados continuam como texto. Se uma imagem conhecida não carregar, o relatório informa o erro antes do download em vez de produzir silenciosamente um arquivo incompleto.

PNG de Apoio e os fluxos WhatsApp/PDF derivados dessas páginas: imagem ao lado da identificação, sem deformação. PDF e PNG de Lavagem também usam as mesmas ilustrações, respeitando a seleção operacional. O PDF do Dashboard captura a tela com suas miniaturas.

Excel de Apoio, dos acompanhamentos e da Central: todas as abas de dados continuam presentes. Foi adicionada a aba **Equipamentos ilustrados**, com a imagem incorporada ao lado de Frota, OS, tipo, equipamento/modelo e grupo, uma linha por ordem. A imagem é incorporada ao XLSX, não apenas um link para internet. As colunas originais das abas Ordens, Resumo, Indicadores e Metodologia não foram removidas ou deslocadas. O controle de Lavagem mantém os formatos PDF/PNG que já oferecia; não foi acrescentado um botão Excel a ele.

## Visual e desempenho

Miniaturas com `object-fit: contain`, fundo discreto verde/papel, dimensões compactas e texto acessível. Imagens da interface carregam sob demanda. Relatórios carregam e reutilizam um cache por tipo, sem buscar uma imagem para cada repetição da frota. Permanecem modo claro padrão, animação da barra lateral, filtros, cadastros, regras de encerramento e cadência de cinco minutos da Central.

## Publicação no Netlify

Extraia `aplicativo-compilado-equipamentos-ilustrados-v10.10.zip` e publique todo o conteúdo extraído no site existente. `index.html`, `assets`, `equipment-types`, `_redirects` e os demais arquivos devem estar na raiz publicada. A pasta **equipment-types é obrigatória**. Não publique apenas HTML nem só assets. Após publicar, atualize o navegador.

A hospedagem não foi atualizada automaticamente. Não é necessário executar SQL ou alterar Supabase, fonte de ordens ou agendamentos.

Para compilar as fontes, abra a pasta `aplicativo` com Node.js 20+ e execute `npm ci`, `npm run check` e `npm run build`. Testes específicos: `npm run test:imagens-equipamentos` e `npm run test:imagens-relatorios`. Os testes de navegador usam Chromium, Python/Playwright e dados simulados, sem gravação no Supabase. As prévias e documentos demonstrativos entregues não contêm ordens reais.
