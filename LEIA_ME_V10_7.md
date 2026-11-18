# Branco Peres v10.7 — Central otimizada e Controle Apoio refinado

## Central Gerencial

A consulta automática da Central passa de um minuto para **cinco minutos**. Ao entrar e na atualização automática, ela lê a fotografia compartilhada do Supabase, sem chamar novamente a Edge Function. O botão Atualizar e o botão Sincronizar do cabeçalho continuam solicitando sincronização manual e leitura. Alternar rapidamente entre abas não dispara atualizações sucessivas. Em falha, a última base válida permanece visível e tentativas automáticas de recuperação são limitadas.

Também foram eliminadas a atualização dupla do relógio em um ciclo e a recriação de formatadores para cada data. Normalização, grupos e tendência receberam índices e agregações mais eficientes; página/gráficos usam memoização e os gráficos não reiniciam animações desnecessárias. O aviso da fonte continua explícito: a central é uma fotografia, não dados instantâneos.

**A alteração é da consulta da Central no navegador.** Não altera o cron, a fonte PIMS, o encerramento das ordens ou o tempo de consulta dos demais módulos. A atualização de servidor já instalada continua funcionando.

## Controle de Equipamentos — Apoio

Os cartões ficam limitados a360 px e a grade usa a largura disponível. Borda verde identifica o padrão; borda vermelha e badge Previsão vencida aparecem apenas em ordem aberta com previsão efetivamente vencida. Idade acima de30 dias não é usada para determinar essa borda. Encerradas continuam verdes, sem serem classificadas como atraso.

A tabela recebeu cabeçalho verde, linhas neutras alternadas, colunas legíveis, sinalização de previsão vencida e primeira coluna fixa. A rolagem horizontal pertence à tabela; deslize para alcançar as colunas de narrativa/detalhes quando a tela for menor. Texto completo continua nos detalhes.

Origem, status operacional e prestador têm pesquisa, checkboxes múltiplos, Selecionar visíveis, Limpar seleção e chips removíveis. Opções selecionadas no mesmo eixo são combinadas por OU, e eixos diferentes por E. Sem seleção no eixo significa Todos. Grupo e seleção de frotas dentro de cada grupo continuam preservados; nenhuma frota explicitamente selecionada no grupo continua significando Nenhuma, não Todos.

Tela, indicadores e relatórios usam a mesma coleção filtrada, independente da paginação. O resumo de frotas também foi unificado nos metadados das exportações, sem desfazer a regra anterior de ocultação de descrições de filtros nos relatórios visuais que já a adotavam.

## Menu e tema

A ordem das seções é Inteligência Gerencial, Operação & Manutenção, Rotina de Frotas, Controle de Reformas, Carretas Canavieiras, Monitoramento e Sistema. Rotina de Frotas agora fica logo abaixo de Operação & Manutenção. Títulos têm destaque e a seção atual fica identificada. O modo Claro padrão da v10.6 continua, sem redefinir escolhas manuais de tema a cada nova abertura.

## Publicar a versão

Guarde a publicação anterior e publique **todo o conteúdo do compilado v10.7** no Netlify existente, sem misturar arquivos de assets de versões diferentes. Os ZIPs não substituem automaticamente o site.

Para editar as fontes, use Node.js 22.13 ou superior:

```bash
npm ci
npm run check
npm run test:central
npm run test:central-desempenho
npm run test:filtros-apoio
npm run test:apoio-tabela
npm run test:menu
npm run test:encerradas
npm run build
```

Esta revisão não requer nova migração SQL nem alteração de credenciais. Todas as telas anteriores da versão 10.6 estão incluídas. Capturas e benchmarks usam fixtures locais; seus números não representam produção.
