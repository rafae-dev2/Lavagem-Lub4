const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const badge = fs.readFileSync(path.join(root, 'src/components/StatusBadge.tsx'), 'utf8');
const table = fs.readFileSync(path.join(root, 'src/components/LubricationScheduleTable.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/lubrificacao.css'), 'utf8');

assert.match(badge, /className=\{`status-badge status-badge-\$\{statusSlug\}/, 'Badge precisa expor uma classe semântica estável');
assert.match(badge, /data-status=\{status\}/, 'Badge precisa expor o status para overrides por tema');
assert.match(badge, /data-status-dot=\{status\}/, 'Ponto do badge precisa acompanhar o token semântico do status');
for (const status of ['PENDENTE', 'ATRASADO', 'PROGRAMADO', 'ENCERRADO', 'ANDAMENTO']) {
  assert.match(badge, new RegExp(status), `Status ${status} precisa continuar configurado`);
}

assert.match(table, /role="region" aria-label="Tabela de programações de lubrificação" tabIndex=\{0\}/, 'Rolagem horizontal precisa ser uma região navegável');
assert.match(table, /<caption className="sr-only">/, 'Tabela precisa ter uma legenda acessível');
assert.match(table, /data-status=\{schedule\.situacao\}/, 'Linhas precisam expor o status para estilos de tema');
assert.match(css, /\.lub-table-scroll\s*\{[^}]*-webkit-overflow-scrolling:\s*touch;/s, 'Rolagem deve funcionar naturalmente no celular');
assert.match(css, /@media \(max-width: 719px\)[\s\S]*?\.lub-table \.lub-actions-cell\s*\{[^}]*position:\s*static;/, 'Ações não pode permanecer sticky no celular');

console.log('OK: badges e linhas expõem status semântico, tabela tem região/caption acessíveis e Ações rola naturalmente até 719px.');
