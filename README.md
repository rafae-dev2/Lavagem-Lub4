# App Lav/Lubrificação — Gestão de Manutenção

Aplicativo web da **Branco Peres Agro** para acompanhar a manutenção da frota: Lavagem/Lubrificação, Controle de Equipamentos — Apoio, ordens encerradas, acompanhamento, Central Gerencial, planos de óleo e relatórios (PDF, Excel, WhatsApp e imagem).

- Versão atual: **v10.28** (veja `LEIA_ME_V10_28.md` e `AUDITORIA_V10_28.md`)
- Stack: React 18 + TypeScript, Vite 5, Tailwind CSS, Supabase (Postgres + RPCs), Netlify

## Rodar localmente

```sh
npm install
npm run dev      # ambiente de desenvolvimento
npm run check    # checagem de tipos (tsc --noEmit)
npm run build    # gera dist/ para publicar
```

As credenciais do Supabase ficam em `src/lib/supabaseClient.ts` (URL do projeto e chave pública `anon`; a proteção real está nas políticas RLS e nos RPCs).

## Banco de dados (Supabase)

Os scripts ficam em `supabase/`. A ordem de instalação e o que cada um cria está em `supabase/INSTALL_APOIO.md`, `INSTALL_PCM_PREMIUM.md`, `INSTALL_TV.md` e `CONFIGURACAO_SUPABASE.md`. O arquivo `SUPABASE_SETUP.sql`, na raiz, reúne a configuração inicial.

## Publicar no Netlify

O `netlify.toml` já define `npm run build` e `publish = "dist"`, com redirecionamento de SPA para `index.html`. Basta conectar este repositório no Netlify ou subir o conteúdo de `dist/` de um pacote compilado.

## Relatórios em imagem (Controle de Equipamentos — Apoio)

O painel **Relatórios em imagem** fica aberto acima da lista e traz dois cartões:

- **Equipamentos em Oficina de Terceiros** — seleção individual por caixa de marcação (com Marcar/Desmarcar todos, busca e filtro por oficina) e download direto de uma única imagem PNG, 921 px de largura e 1600 px de altura no modo celular em pé; a altura cresce quando a seleção não cabe.
- **Imagem premium** — relatório completo das ordens, com formato e qualidade configuráveis.

## Testes

```sh
npm run test:oficina-terceiros   # dados, imagem única no Chromium e interface do painel
npm run test:apoio-tabela
npm run test:filtros-apoio
npm run test:encerradas
npm run test:acompanhamento
npm run test:escopo-lavagem
npm run test:sql
npm run test:menu
```

## Documentação

Cada versão tem um `LEIA_ME_V10_xx.md` (o que mudou e como publicar) e, quando aplicável, um `AUDITORIA_V10_xx.md` (detalhes técnicos e validação). Os arquivos `TODO_*`, `*_TODO.md` e `*_SPEC.md` registram o planejamento de cada módulo.
