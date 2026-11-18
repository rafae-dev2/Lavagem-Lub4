# Branco Peres — tabela, cartões compactos e reformas v10.3

## O que mudou

O Controle de Equipamentos — Apoio oferece escolha **Cartões / Tabela**, com preferência de visualização salva neste aparelho. A barra **Pesquisar frota, OS ou narrativa** fica visível fora dos filtros recolhidos e aceita pesquisa parcial, com ou sem acentos. Alternar o modo não perde a seleção; os relatórios continuam recebendo todas as ordens filtradas, não somente a página exibida.

A tabela apresenta frota, OS, equipamento, grupo/local/prestador, situação operacional, entrada/previsão e narrativa. A expansão da linha mostra narrativa completa, status bruto e evidências do encerramento. A rolagem horizontal fica restrita à tabela, com região identificada e navegável por teclado. Pesquisa, filtros, paginação de 40, histórico e botão Mostrar encerradas são compartilhados pelos dois modos.

Cartões e indicadores operacionais foram compactados: menos preenchimento, títulos e ícones menores, resumo de narrativa e mais colunas onde há espaço útil. Acompanhamentos e Apoio usam até quatro colunas em telas grandes, duas em tablets com espaço suficiente e uma em celular. Cartões mantêm campos essenciais e detalhes completos; encerradas continuam destacadas. Lavagem também recebeu adaptação compacta de suas linhas para cartões móveis. O Dashboard recebeu indicadores/painéis menores, sem reduzir os gráficos. O modo TV mantém escala apropriada à visualização à distância.

## Quatro novos módulos separados

| Módulo | Endereço interno |
|---|---|
| Controle de Reforma Carretas Rodomuda | `/#reformas-rodomuda` |
| Controle de Reforma Colhedora | `/#reformas-colhedoras` |
| Controle Reforma Trator Transbordo | `/#reformas-trator-transbordo` |
| Controle Reforma Trator Reboque | `/#reformas-trator-reboque` |

O menu reúne esses módulos em **Controle de reformas**, junto ao controle geral de reformas Apoio. Eles reutilizam os mesmos recursos dos acompanhamentos anteriores: busca/filtros, programadas/em andamento/encerradas, cartões/tabela, detalhes, ordenação, paginação de 24, PDF/Excel com cabeçalho, fonte/horário de sincronização e encerramento por saída validada da fonte.

## Como as ordens entram em cada controle

Uma ordem precisa identificar reforma conforme a lógica já existente, pertencer a uma frota cadastrada no Apoio e corresponder ao tipo do módulo. O grupo da frota no cadastro compartilhado tem prioridade; um nome de equipamento ou grupo/modelo explícito da fonte complementa cadastros genéricos. O mapa conhecido de Rodomuda/Colhedoras é apenas fallback quando não há identificação contraditória.

O Supabase já possui os grupos **Carreta Rodomuda, Colhedora, Trator Transbordo e Trator Reboque** e suas frotas. Não foi necessário criar outro banco, inserir ordens ou duplicar cadastros. As listas de Trator Geral/Tratores Pesados não são arbitrariamente divididas; uma menção a outro equipamento na narrativa não define a categoria da frota. Para ajustar o tipo de uma frota, use o cadastro existente de grupos/frotas do Controle Apoio.

Reforma é identificada em classe/motivo ou, quando não há um sinal estruturado conhecido conflitante, por termos explícitos do ponto/narrativa. Manutenção, corretiva, lavagem ou preventiva isoladas não viram reforma. Um controle vazio significa que a seleção/fonte não trouxe ordens elegíveis; não são inseridos exemplos ou ordens artificiais.

## Encerradas e relatórios

A regra v10.2 foi preservada: saída validada da fonte gera **encerramento operacional** com data de detecção, sem inventar realização manual. Reaparecimento reabre a ordem. Os acompanhamentos reutilizam o corte **07:10 de Brasília**, ocultando encerradas antigas por padrão e mantendo acesso pelo botão Mostrar encerradas. Cards/tabela e relatórios usam a mesma situação e seleção; detecção e última presença ficam explícitas.

## Atualização no Netlify

Faça backup da publicação atual e publique **todo o conteúdo do compilado v10.3** no site principal `https://controlelogisticalub.netlify.app`. Não misture assets de versões distintas. Esta entrega não publica automaticamente a interface. Os novos módulos reutilizam a integração Supabase já configurada; **não reexecute os SQLs antigos**.

Para compilar as fontes, use Node.js 22.13 ou superior:

```bash
npm ci
npm run check
npm run test:acompanhamento
npm run test:encerradas
npm run test:reformas
npm run test:apoio-tabela
npm run test:compacto
npm run test:sql
npm run build
```

Os testes visuais exigem Python/Playwright e Chromium. `npm run test:visual` valida os sete acompanhamentos; `npm run test:visual-apoio` usa um mock local para validar a tabela/pesquisa sem Supabase. Nenhum teste de estados insere ou encerra ordens reais.
