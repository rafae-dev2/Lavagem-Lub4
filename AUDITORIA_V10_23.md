# Auditoria v10.23 — Classificação de equipamentos canavieiros especiais

## Alteração

`assertiveCanavieira` foi ampliada para reconhecer `Carreta tanque [de] Vinhaça` e `Dolly Canavieiro(s)`, após a normalização que remove acentos e pontuação. Como `canavieiraIdentity` é compartilhada pelas rotas `preventivas` e `lubrificacao`, ordens desses equipamentos podem aparecer nos dois módulos quando a classe/motivo identifica o serviço correspondente. O filtro de Preventiva/Lubrificação não foi relaxado.

## Proteções

O critério não inclui todo tanque ou qualquer Dolly: testes confirmam que `Carreta tanque água` e `Dolly industrial` continuam fora sem identificação canavieira. Cavalo e caminhão continuam excluídos pelas proteções existentes.

## Validação

`npm run test:acompanhamento` passou, incluindo testes unitários para os dois novos modelos em Preventivas e Lubrificação e regressões de ciclo de vida, UI, relatórios, auditoria de classificação e contrato da fonte. `npm run check` também passou.

Nenhum dado de origem ou cadastro no Supabase foi alterado.
