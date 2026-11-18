# v10.12 — congelamento ao rolar Lavagem / Lubrificação

- [x] Permitir subir e descer a página pelo toque sobre a tabela, mantendo rolagem horizontal para alcançar todas as colunas.
- [x] Evitar atualizações completas a cada segundo e pausar o relógio visual quando a aba está oculta, sem perder a virada operacional das 07:10, filtros e informações atuais ao retornar.
- [x] Preservar cartões, tabela, quadro, edição, ações, equipamentos ocultos e lógica de encerramentos.
- [x] Entregar fontes e compilado verificáveis com a correção, explicando que o site só muda após republicação no Netlify.

## Evidências

Gesto CDP antes/depois: movimento vertical sobre tabela passou de 0 para 482 px em celular e 488 px em tablet, mantendo gesto horizontal. Relógio testado com tempo controlado: corte 07:10 exato, sem ticks por segundo, pausa e retomada corretas. Regressões de encerramentos, compactação, cabeçalho, Central e tipos passaram. O build e ZIPs são gerados pela rotina final; site permanece na versão anterior até republicação. Nenhuma ordem ou configuração Supabase foi alterada.
