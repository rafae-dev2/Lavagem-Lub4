const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const compactCss = fs.readFileSync(path.join(root, 'src/styles/operational-compact.css'), 'utf8');
const orderCard = fs.readFileSync(path.join(root, 'src/components/MaintenanceOrderCard.tsx'), 'utf8');
const scheduleTable = fs.readFileSync(path.join(root, 'src/components/LubricationScheduleTable.tsx'), 'utf8');

// A camada nova deve ser local aos módulos; não pode virar uma folha global de
// inputs/botões nem alterar a apresentação de TV.
assert.match(compactCss, /\.maintenance-tracking\s*\{[\s\S]*max-width:\s*none/);
assert.match(compactCss, /\.lavagem-premium\s+\.lub-module/);
assert.doesNotMatch(compactCss, /(^|\n)\s*(html|body|button|input|select|textarea)\s*\{/);
assert.doesNotMatch(compactCss, /tv-monitor|TVMonitor/);

// Grid por área útil: uma coluna, duas no tablet, três no desktop e quatro no
// wide. As larguras mínimas evitam cards estreitos quando há sidebar.
assert.match(compactCss, /@container maintenance-workspace \(min-width: 740px\)/);
assert.match(compactCss, /@container maintenance-workspace \(min-width: 1020px\)/);
assert.match(compactCss, /@container maintenance-workspace \(min-width: 1600px\)/);
assert.match(compactCss, /grid-template-columns:\s*repeat\(3,\s*minmax\(280px,\s*1fr\)\)/);
assert.match(compactCss, /grid-template-columns:\s*repeat\(4,\s*minmax\(280px,\s*1fr\)\)/);

// Sinais de compactação solicitados no card de acompanhamento.
assert.match(compactCss, /\.mt-fleet-title strong\s*\{[\s\S]*font-size:\s*clamp\(22px,\s*1\.8vw,\s*24px\)/);
assert.match(compactCss, /\.mt-quadrant\s*>\s*svg\s*\{[\s\S]*width:\s*19px/);
assert.match(compactCss, /\.mt-closure-summary\s*\{[\s\S]*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
assert.match(compactCss, /\.mt-narrative\.line-clamp-3\s*\{[\s\S]*-webkit-line-clamp:\s*3/);
assert.match(compactCss, /\.mt-order-bottom button\s*\{[\s\S]*min-height:\s*44px/);
assert.match(compactCss, /@media \(max-width: 720px\)/);
assert.match(compactCss, /@media \(max-width: 360px\)/);
assert.match(compactCss, /\.lavagem-premium\s*>\s*\.lavagem-premium-hero\s*\{[\s\S]*min-height:\s*156px/);
assert.match(compactCss, /\.lavagem-premium\s*>\s*\.lavagem-premium-body\s*\{[\s\S]*padding:/);

// A narrativa continua truncada fora da expansão, mas os detalhes/histórico
// continuam no markup do card.
assert.match(orderCard, /line-clamp-3/);
assert.match(orderCard, /Ver histórico e campos da fonte/);
assert.match(orderCard, /Narrativa completa/);

// Rótulos legados permanecem no markup, mas a tabela atual nunca é convertida
// automaticamente em cartões no celular; Cartões usa componente explícito.
for (const label of [
  'Equipamento / OS',
  'Serviço / local',
  'Programação',
  'Situação',
  'Data realizada',
  'Observações',
  'Ações',
]) {
  assert.match(scheduleTable, new RegExp(`data-label="${label.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}"`), `Rótulo móvel ausente: ${label}`);
}
assert.match(compactCss, /\.lub-table tbody tr\.lub-row\s*\{[\s\S]*display:\s*grid/);
assert.match(compactCss, /\.lub-table td::before\s*\{[\s\S]*content:\s*attr\(data-label\)/);
assert.match(compactCss, /\.lub-table \.lub-edit,[\s\S]*min-width:\s*44px/);
assert.match(compactCss, /\.lub-table \.lub-quick-actions button\s*\{[\s\S]*min-height:\s*44px/);

const legacyMobile = compactCss.slice(compactCss.indexOf('/* Compatibilidade de telas antigas:'), compactCss.indexOf('/* Grid por área útil do painel'));
assert.doesNotMatch(legacyMobile, /\.lavagem-premium \.lub-module \.lub-table/);
assert.match(legacyMobile, /\.lub-module:not\(\.lub-operations-v1011\)/);
console.log('OK: compactação operacional local, grid 2/3/4 colunas, card móvel de programação, narrativa/histórico e alvos de toque preservados.');
