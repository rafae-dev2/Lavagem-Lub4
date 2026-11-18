# Dependências — revisão de manutenção 08/11/2026

A auditoria inicial identificou alertas altos em `pdfjs-dist` e `xlsx`. O parser PDF foi atualizado para a versão corrigida 6.2.108, indicada pelo aviso oficial CVE-2026-16633. A API de extração e o worker local permanecem na mesma integração do aplicativo. [Aviso de segurança](https://github.com/advisories/GHSA-hq66-cqwq-w95j).

O pacote `xlsx` do registro npm está desatualizado. A distribuição oficial do SheetJS informa 0.20.3 e recomenda guardar o tarball no projeto para não depender do CDN em cada instalação. Esta revisão utiliza `vendor/xlsx-0.20.3.tgz`, instalado por referência local em `package.json`, com integridade registrada no lockfile. Não foi utilizado um fork desconhecido. [Instalação oficial SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).

`@electric-sql/pglite` é dependência de desenvolvimento para executar os testes PostgreSQL em memória, sem consultar ou modificar o Supabase. Ela não é importada pelo aplicativo de produção.

A ausência de alertas na auditoria npm não elimina a necessidade de autenticação e controle de permissões. As políticas públicas herdadas de Lavagem/PCM e cadastros Apoio continuam sendo um risco independente da atualização de pacotes.
