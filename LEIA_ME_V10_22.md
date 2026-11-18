# v10.22 — Acesso visível para criar grupos Apoio

O botão **“Grupos Apoio e nossas frotas”** agora aparece na tela principal do Controle de Equipamentos — Apoio, logo abaixo das informações de sincronização. Antes, ele ficava dentro do acordeão recolhível “Relatórios e cadastros”, então parecia que o acesso para criar grupos havia sumido quando o acordeão estava fechado.

Clique em **“Grupos Apoio e nossas frotas”** para abrir o formulário **“Criar ou editar grupo Apoio”**; nele, o botão **“Criar grupo”** fica disponível. Não é preciso abrir “Relatórios e atualização”.

## Publicação

Publique no Netlify o conteúdo integral do ZIP compilado da **v10.22**, deixando `index.html` na raiz. Depois, faça uma recarga forçada do navegador e confirme `v10.22` no menu lateral. A publicação de um novo ZIP não altera automaticamente o site.

Não é necessária migração do Supabase.

## Verificação

O teste automatizado abre a aba de grupos com o acordeão de relatórios fechado, confirma que o formulário e o botão “Criar grupo” estão visíveis e retorna às ordens sem gravações. Também verifica celular, tablet, desktop, busca e rolagem.
