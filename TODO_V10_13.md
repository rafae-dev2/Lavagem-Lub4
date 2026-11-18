# v10.13 — zoom e modo lista padrão no celular

- [x] Permitir zoom por pinça sobre a tabela e manter rolagem vertical e horizontal.
- [x] Abrir Lavagem no celular em lista/tabela, em retrato e paisagem, sem reduzir ou alterar o cabeçalho.
- [x] Preservar escolhas posteriores de visualização e não sobrescrever preferências do computador.
- [x] Preservar recursos operacionais e entregar compilado/fontes completos para republicar no Netlify.

## Evidências

Pinça testada com eventos reais de dois dedos: escala1 para2,6253 em retrato e paisagem, mantendo deslocamentos horizontal/vertical e sem erros JavaScript. Lista móvel, preferências isoladas, cabeçalho preservado, relógio operacional, encerramentos e TypeScript passaram. Build gerado; publicar o compilado completo no Netlify para aplicar os ajustes.
