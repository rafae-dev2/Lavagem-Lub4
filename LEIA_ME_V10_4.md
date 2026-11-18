# Branco Peres v10.4 — Lavagem/Lubrificação dos demais equipamentos

## Alteração solicitada

Os grupos **Carretas Canavieiras, Trator Transbordo, Colhedoras e Carretas Rodomuda** ficam ocultos na visualização de Lavagem/Lubrificação. A seleção é compartilhada pela programação/tabela/quadro, indicadores do turno, Dashboard/alertas, calendário, exportação, revisão de classificação PCM e histórico de encerradas aberto a partir de Lavagem.

O botão Mostrar encerradas continua funcionando para os demais equipamentos, mas não revela os quatro grupos ocultos. Trator Reboque, caminhões, veículos, área de vivência e outros grupos permanecem disponíveis.

## Dados e demais módulos preservados

Esta mudança é somente um filtro de visualização. Não apaga, ignora, suspende, encerra ou reabre registros; não altera datas, classificações, sincronização ou confirmação de execução. Não há SQL de migração nem alteração de configuração Supabase a executar.

Controle de Equipamentos — Apoio, Gestão de Ordens, Preventivas/Lubrificação Canavieiras, os controles separados de reforma e o modo TV continuam usando suas fontes e seleções próprias. As ordens dos grupos ocultos seguem nesses módulos e no banco. Importações e lançamentos não têm seus dados descartados pelo filtro; quando pertencem a um grupo oculto, não aparecem na seleção de Lavagem.

A regra usa o grupo informado pelo cadastro/metadata da programação, com variação singular/plural e acentos normalizada. Para legados sem grupo, usa somente os mapas exatos conhecidos de Canavieiras, Colhedoras e Rodomuda. Não considera uma referência na narrativa como categoria de equipamento nem divide Trator Geral/Pesados entre Transbordo e Reboque. Se uma frota antiga estiver sem grupo, classifique-a corretamente no cadastro Apoio.

## Publicação

Faça backup da publicação atual e publique **todo o conteúdo do compilado v10.4** no site principal. Não misture os assets com os de outras versões. Os arquivos entregues não atualizam automaticamente o Netlify e não exigem reexecutar SQLs anteriores.

Para compilar as fontes, use Node.js 22.13 ou superior:

```bash
npm ci
npm run check
npm run test:escopo-lavagem
npm run test:encerradas
npm run test:acompanhamento
npm run test:reformas
npm run test:apoio-tabela
npm run build
```

Esta versão aplica a ocultação pedida. Os pontos de recuperação da interface e distinção de data de detecção/execução identificados na auditoria anterior não foram modificados silenciosamente, e os registros reais não foram ajustados.
