# Branco Peres v10.6 — cartões Apoio refinados e modo Claro padrão

## O que mudou

Os cartões de Controle de Equipamentos — Apoio foram reorganizados. A frota e a idade ocupam o cabeçalho, enquanto os status e as evidências ficam em uma linha própria. Foram removidos o ornamento dourado lateral, o efeito metálico e a sombra deslocada. O acabamento agora usa borda fina neutra, sombra leve, espaços equilibrados e campos/narrativa mais legíveis, preservando a identidade da marca.

Encerradas continuam identificadas por selo e destaque verde discreto, sem perder evidências da fonte. Detalhes, história, atribuição de grupo, pesquisa, filtros e alternância Cartões/Tabela permanecem disponíveis. Os ajustes são locais aos cartões Apoio: a Central Gerencial v10.5 e os demais módulos seguem incluídos nesta versão.

## Modo Claro como padrão

Na primeira abertura da v10.6, o aplicativo inicia em Claro, inclusive quando havia uma preferência antiga gravada. Isso ocorre uma única vez por navegador. Depois, o usuário pode escolher qualquer outro tema; sua escolha fica salva e não é redefinida a cada recarga. Valor inválido ou armazenamento indisponível usa Claro como fallback.

Não é necessário limpar o armazenamento do navegador ou perder dados para ativar o novo padrão. A migração altera somente a preferência visual e seu marcador de versão, não as ordens, programações ou cadastros.

## Publicar

Faça backup da publicação anterior e publique todo o conteúdo do compilado v10.6 no Netlify existente, sem misturar os assets de versões diferentes. A entrega dos ZIPs não substitui automaticamente o site publicado.

Para trabalhar com as fontes, use Node.js22.13ou superior:

```bash
npm ci
npm run check
npm run test:tema-claro
npm run test:apoio-tabela
npm run test:encerradas
npm run test:central
npm run build
```

A integração Supabase já existente permanece preservada. Esta versão não necessita de nova migração SQL e não altera os encerramentos ou a fonte de ordens. Fixtures e capturas visuais de teste não representam dados operacionais reais.
