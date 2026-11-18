# v10.11 — transparência e imagens por grupo

- [x] Auditar as 13 imagens de equipamentos e eliminar fundos remanescentes, com PNG transparente real, sem perder o equipamento.
- [x] Corrigir filtros de Controle Apoio e seleção/deseleção em celular, tablet e computador, sem colunas altas, cortadas ou sobrepostas.
- [x] Permitir escolher tabela real em Lavagem/Lubrificação no celular, com cabeçalho e rolagem horizontal, mantendo demais modos e ações.
- [ ] Permitir adicionar/trocar imagem por grupo, comprimir antes do upload para até640px/180000bytes, armazenar somente imagem compacta no Storage e metadados leves no banco; refletir nos módulos e relatórios. Escrita somente pelo e-mail autorizado e consulta pública preservada.
- [x] Entregar compilado, fontes, ilustrações transparentes e instruções de publicação/configuração com limites explícitos.

## Estado da autorização

O cadastro e o Storage foram implementados e testados com dados simulados; a lista de e-mails autorizados permanece vazia porque o usuário ainda não informou qual e-mail autorizar. O painel Supabase continuou exigindo login e a URL de retorno do editor está pendente. Leitura pública, filtros, relatórios e imagens padrão permanecem funcionais. O compilado precisa ser publicado no Netlify.
