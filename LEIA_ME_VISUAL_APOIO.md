# Atualização visual — Controle de Equipamentos — Apoio

## O que mudou

O Apoio passa a seguir a identidade visual da Gestão de Ordens de Manutenção: verde institucional #1F6B45, cabeçalho com o logotipo Branco Peres, painéis claros, títulos verdes e indicadores com borda superior verde.

As ordens passam da tabela larga para cartões responsivos. Cada cartão apresenta OS, frota, equipamento, entrada, dias em aberto, setor, ponto de manutenção, status, local, oficina externa quando aplicável, grupo Apoio, grupo na fonte, previsão e narrativa. O botão de detalhes expande a narrativa e as datas de observação. A atribuição de grupo continua disponível no próprio cartão.

As bordas laterais e os contadores distinguem até 7 dias, 8 a 30 dias e mais de 30 dias. Datas ausentes ou inconsistentes são sinalizadas sem inventar dias. O histórico continua distinguindo ausência na fonte de finalização real.

O tema Claro recebe cores corporativas verdes e contrastes adequados no cabeçalho, menu lateral e seletor de temas. Os demais temas continuam disponíveis e a preferência salva é respeitada. Se o aplicativo abrir no tema escuro, use o botão de temas no cabeçalho e selecione Claro.

## O que foi preservado

A sincronização, os grupos e cadastros de frotas, os filtros, a paginação e as regras de dados foram mantidos. Os relatórios PDF, Excel e imagens continuam usando todas as ordens filtradas, não apenas os cartões da página atual. Seus geradores não foram alterados.

Nenhuma tabela, função, política ou configuração do Supabase foi modificada nesta atualização. O módulo Gestão de Ordens incorporado permanece intacto.

## Instalação

O arquivo `applav_atualizado.zip` contém a versão compilada, com `index.html`, `assets`, `logo.png` e os demais recursos na raiz, seguindo a estrutura do `applav.zip` original. Extraia o ZIP e envie o conteúdo para a hospedagem atual, substituindo o conjunto anterior inteiro. No Netlify, o conteúdo compilado pode ser enviado por implantação manual. Não use o ZIP de código-fonte como versão estática.

O arquivo `aplicativo_atualizado.zip` contém o código-fonte. Para desenvolver ou recompilar:

```bash
npm ci
npm run dev
npm run build
```

A compilação é gerada em `dist`. Não é necessário executar novamente os scripts SQL para esta mudança visual. Esta entrega não publica nem substitui automaticamente o aplicativo online.

## Verificações locais

A compilação Vite foi executada. Os testes de filtros existentes e os novos testes locais de renderização dos cartões verificam campos, status, datas, histórico, escape da narrativa, seleção de grupo e acessibilidade. Nenhum cadastro de produção foi criado ou editado para testar.

O projeto original já apresenta três diagnósticos TypeScript em `src/pages/ManutencaoEquipamentos.tsx`, linhas 505–506: referência a `resetarCategorias` sem declaração e dois parâmetros com tipo implícito decorrentes dela. São anteriores à atualização e pertencem a outro módulo; não foram alterados aqui. O Vite compila o aplicativo, mas `npx tsc --noEmit` continua reportando esses diagnósticos preexistentes. A compilação também mantém os avisos de tamanho dos pacotes já característicos do projeto.
