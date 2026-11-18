# Modo TV — Monitor de emergências do Apoio

O novo menu **Modo TV — Emergências** foi integrado ao aplicativo existente. Ele tem identidade visual própria de monitor gerencial, com fundo petróleo escuro, contraste alto, número de frota em destaque e sinalização coral para emergências. O tema Glassy V18 e os demais módulos continuam preservados.

## Abrir e configurar

Acesse o novo menu e clique em **Filtros**. A seleção padrão mostra somente ordens **ativas**, de **frotas cadastradas no Apoio**, com classe oficial **CORRET EMERGENCIAL** e status **Andamento**. A emergência é identificada pelo campo classe, nunca por suposição a partir da narrativa. Uma ordem sem classe não entra silenciosamente como emergencial.

Selecione várias categorias do Apoio e combine busca por frota/OS/equipamento/narrativa, origem/oficina, prestador externo, setor, motivo e duração mínima em aberto. É possível ordenar pela entrada mais antiga, mais recente, número de frota ou previsão mais próxima. **Todas** monitora todas as categorias; **Nenhuma** zera a seleção. A configuração permanece salva neste navegador, inclusive depois de recarregar a página.

Os controles Classe e Situação permitem ampliar o escopo deliberadamente. A tela exibe um aviso quando deixa de estar restrita a emergenciais em andamento. A contagem dos grupos no seletor representa as emergenciais em andamento antes dos demais filtros.

## Apresentar para a Gerência

Clique em **Apresentar na TV** para ocultar o shell do aplicativo. Use o botão de tela cheia se o navegador permitir. Escape fecha primeiro detalhes ou filtros e depois sai da apresentação.

O padrão é de seis ordens por página, com rodízio a cada vinte segundos. Os filtros permitem quatro, seis ou oito ordens e intervalos de dez, vinte, trinta ou sessenta segundos. O botão de pausa interrompe o rodízio; as setas permitem navegação manual. A atualização das ordens continua mesmo com o rodízio pausado.

Cada cartão organiza frota, OS, categoria Apoio, equipamento, situação, oficina/prestador, setor/ponto, motivo, resumo da narrativa, entrada e previsão. Previsões vencidas são destacadas sem serem apresentadas como conclusão da manutenção. O tempo exibido é **tempo em aberto desde a entrada**, não duração comprovada de execução. **Ver ordem completa** abre a narrativa integral e os dados da ordem.

O layout padrão foi validado em 1920×1080 com dados fictícios. Em telas menores ou com zoom elevado pode ser necessário usar quatro ordens por página ou rolar. A configuração de seis ordens é recomendada para TV Full HD; quatro oferece o maior destaque.

Para abrir diretamente esta seção, acrescente `#modo-tv` ao endereço atual do site, por exemplo `https://SEU-SITE.netlify.app/#modo-tv`. Não foi criada uma nova hospedagem ou publicado um novo endereço nesta tarefa.

## Como a atualização funciona

O monitor lê a fotografia consistente do Apoio no Supabase, recebe mudanças por **Supabase Realtime** e faz leitura de segurança a cada **30 segundos**, mesmo com o canal conectado. O botão Atualizar relê o banco; não força uma mudança na fonte.

O produtor continua sendo a sincronização Apoio/PCM existente. O cron consulta a fonte aproximadamente a cada minuto, mas a atualização efetiva depende do PIMS e de seu horário de fonte. Por isso, o monitor exibe separadamente **atualização da fonte** e **última leitura**. Não promete atualização instantânea antes de a fonte produzir dados novos.

Após cinco minutos sem novidade no horário da fonte, mostra aviso de atraso. Após setenta e cinco minutos, horário ausente/inconsistente, falha ou ausência de rede, mostra alerta. Em falha de leitura, preserva a última fotografia e informa que as ordens podem estar desatualizadas. A interface não declara que uma ordem foi concluída apenas porque desapareceu da seleção.

## Instalar no Netlify

Use `applav-compilado-modo-tv-premium.zip`. Descompacte e envie a pasta com `index.html`, `assets`, `equipamentos`, `logo.png` e `_redirects` para uma nova implantação do **mesmo site Netlify**.

Para implantação por fontes, use `aplicativo-fontes-modo-tv-premium.zip`, entre na pasta `aplicativo` e execute:

```bash
npm ci
npx tsc --noEmit
npm run build
```

O diretório publicado continua sendo `dist`, conforme o `netlify.toml` existente.

## Supabase — atualização incremental

Este monitor reutiliza o banco e os grupos/frotas existentes. **Não crie outro banco, não insira dados fictícios e não apague tabelas.**

**Neste aplicativo, o Realtime já foi habilitado diretamente no Supabase em 05/11/2026. Não é necessário executar o SQL novamente.** Foi aplicada a migração `enable_apoio_tv_realtime`, que incluiu `apoio_ordens`, `apoio_sync`, `apoio_grupos` e `apoio_frotas` na publicação `supabase_realtime`. A inclusão das quatro tabelas foi confirmada por leitura do catálogo do banco.

O arquivo **TV_MONITOR.sql** acompanha os fontes como referência incremental para outra instalação ou restauração, depois de conferir que a integração Apoio/PCM já está instalada. Ele habilita as quatro tabelas do monitor na publicação `supabase_realtime` e verifica os campos de classe/motivo. É incremental e não redefine o aplicador de snapshots. As pré-condições são verificadas no próprio script. A publicação `supabase_realtime` precisa existir.

Os scripts antigos permanecem nos fontes apenas por serem parte do aplicativo completo. **Não reexecute APOIO_SETUP.sql ou PCM_AUTOMACAO.sql só para instalar o Modo TV**, pois versões antigas podem substituir melhorias posteriores. Se a instalação for nova ou o script indicar pré-requisito ausente, consulte `supabase/INSTALL_TV.md` e a documentação de instalação existente.

A habilitação Realtime foi executada remotamente com sua autorização e conferida no banco correto do aplicativo. **Não foram alterados registros de ordens, cadastros, regras de acesso, cron ou funções existentes.** Apenas a publicação Realtime recebeu as quatro tabelas. Se Realtime ainda não estiver habilitado, a leitura periódica de trinta segundos continua funcionando, desde que a fotografia Apoio contenha a classe e o RPC esteja instalado.

## Validação

Checagem TypeScript e compilação Vite, testes de classificação emergencial e filtros, regressões de Apoio/Lubrificação/Glassy V18 e testes de interface em Chromium com tráfego externo bloqueado. A validação de interface utilizou dados fictícios e incluiu TV 1080p, filtros em interseção, persistência, rodízio, pausa, detalhes, alteração de status, alerta de falha, celular e movimento reduzido. Também foi conferida a publicação Realtime no banco real, validada a assinatura com a chave pública do aplicativo e recebido um evento natural de `apoio_sync`, sem nenhuma mutação de teste. Não foi realizada validação física em uma televisão nem implantação do novo compilado em seu site nesta tarefa.
