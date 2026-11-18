# v10.14 — modo Tabela padrão no celular

O visual da referência se chama **modo Tabela**, também conhecido como lista tabular: uma linha por ordem, com as colunas Equipamento/OS, Serviço/Local, Programação, Situação, Data realizada, Observações e Ações.

Lavagem / Lubrificação agora inicia nesse modo em toda abertura do módulo no celular, tanto em pé (retrato) quanto deitado (paisagem). Preferências antigas de Cartões ou Quadro não substituem mais esse padrão. Você pode trocar o modo durante a sessão; ao reabrir o módulo ou atualizar a página, ele retorna à Tabela. A preferência do computador permanece independente e continua salva.

O cabeçalho não foi reduzido. Zoom por pinça, rolagem vertical/horizontal e demais recursos das versões anteriores foram preservados. Em tela estreita, deslize lateralmente a tabela para acessar as colunas: ela não se transforma em cartões nem encolhe artificialmente o texto.

Publique o conteúdo completo do ZIP compilado v10.14 no Netlify, com index.html e assets na raiz. Recarregue sem cache após publicar. A entrega não atualiza automaticamente o site hospedado. Não é necessário alterar o Supabase.

Validação: teste de abertura móvel com preferência antiga em Cartões/Quadro em retrato e paisagem, teste de tabela/ações, TypeScript e compilação. Fontes: Node.js 20.19+ ou 22.13+, npm ci, npm run test:lista-movel, npm run check e npm run build.
