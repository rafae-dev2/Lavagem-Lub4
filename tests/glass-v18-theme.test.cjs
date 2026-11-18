const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const context = fs.readFileSync(path.join(root, 'src/contexts/ThemeContext.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/glassy-v18.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');

assert.match(context, /'glassy-v18'/, 'Glassy V18 precisa fazer parte da união Theme');
assert.match(context, /label: 'Glassy Dashboard V18'/, 'Tema precisa aparecer com o rótulo solicitado');
assert.match(context, /const DARK_THEMES: Theme\[\] = \[[^\]]*'glassy-v18'/s, 'Tema precisa manter o contrato isDark');
assert.match(context, /const THEME_KEYS = new Set<Theme>\(THEMES\.map/, 'Temas persistidos precisam ser validados contra THEMES');
assert.match(context, /isTheme\(storedTheme\)[\s\S]*\?\s*storedTheme\s*:\s*DEFAULT_THEME/, 'Chave persistida inválida deve cair em DEFAULT_THEME');
assert.match(context, /'theme-glassy-v18'/, 'A classe nova precisa ser removida e aplicada pelo provider');
assert.match(main, /import ['"]\.\/styles\/glassy-v18\.css['"]/, 'CSS V18 precisa ser importado no entrypoint');

assert.match(css, /^html\.theme-glassy-v18 \{/m, 'Tokens devem começar no escopo da classe do tema');
assert.match(css, /backdrop-filter:.*blur\((18|20|22|24)px\)/, 'Tema precisa usar blur de vidro');
assert.match(css, /font-display: Georgia/, 'Títulos editoriais devem usar serif local');
assert.match(css, /#8ca6ef/i, 'Tema precisa preservar o acento pervinca');
assert.match(css, /background: rgba\(61, 53, 48, \.97\)/, 'Modais devem ter superfície legível e quase opaca');
assert.match(css, /select option/, 'Select nativo precisa receber fundo sólido');
assert.match(css, /prefers-reduced-motion: reduce/, 'Tema precisa respeitar redução de movimento');
assert.match(css, /apoio-group-fleet-search/, 'Busca do filtro de frotas deve ter acabamento Glassy');
assert.doesNotMatch(css, /(^|\n)\s*(?:body|article|img|table|canvas)\s*\{/m, 'CSS não pode estilizar relatórios ou elementos globais sem escopo');
assert.doesNotMatch(css, /html\.theme-glassy-v18\s+body\s+.*report/i, 'CSS não deve atingir raízes de relatório');

console.log('OK: Glassy Dashboard V18 registrado, dark-compatible, persistência validada, CSS escopado, vidro/taupe/serif/acentos, modais/selects acessíveis e relatórios protegidos.');
