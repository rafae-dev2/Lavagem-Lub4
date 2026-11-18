const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '..');
const temp = path.join(root, 'tests', '.tmp-mobile-operations-v1011-contract');
fs.mkdirSync(temp, { recursive: true });
try {
  const outfile = path.join(temp, 'table.cjs');
  buildSync({
    entryPoints: [path.join(root, 'src/components/LubricationScheduleTable.tsx')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    external: ['react', 'react-dom'],
    nodePaths: [path.join(root, 'node_modules')],
  });
  const Table = require(outfile).default;
  const schedule = {
    id: 'v1011-1', frota: '4566', descricaoPonto: 'LAVADOR',
    tipoPreventiva: 'Lavagem / Lubrificação', dataProgramada: '2026-11-04',
    dataRealizada: '', horarioAgendado: '07:00', situacao: 'PROGRAMADO',
    observacao: 'Observação operacional longa para abrir detalhes no modo Cartões.',
    narrativaPCM: 'Narrativa completa de teste.', origemRegistro: 'MANUAL', numeroOS: '159333190',
  };
  const noop = () => {};
  const props = { schedules: [schedule], sortField: 'dataProgramada', sortDir: 'asc', onSort: noop, onEdit: noop, onDelete: noop, onQuick: noop, onPostpone: noop, onOpenFrota: noop, quickUpdating: null, deleting: null };
  const table = renderToStaticMarkup(React.createElement(Table, props));
  assert.match(table, /<thead>/);
  assert.match(table, /Equipamento \/ OS/);
  assert.match(table, /Editar/);
  assert.match(table, /Iniciar frota 4566/);
  assert.match(table, /data-label="Observações"/);
  const cards = renderToStaticMarkup(React.createElement(Table, { ...props, compactCards: true }));
  assert.match(cards, /lub-schedule-cards/);
  assert.match(cards, /lub-schedule-card/);
  assert.doesNotMatch(cards, /<thead>/);
  assert.match(cards, /Ver detalhes/);
  assert.match(cards, /Editar/);
  assert.match(cards, /Iniciar frota 4566/);
  assert.match(cards, /Concluir frota 4566/);

  const page = fs.readFileSync(path.join(root, 'src/pages/Programacoes.tsx'), 'utf8');
  const component = fs.readFileSync(path.join(root, 'src/components/LubricationScheduleTable.tsx'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'src/styles/mobile-operations-v1011.css'), 'utf8');
  const preference = fs.readFileSync(path.join(root, 'src/lib/programacaoViewPreference.ts'), 'utf8');
  assert.match(preference, /type ProgramacaoViewMode = 'tabela' \| 'cartoes' \| 'kanban'/);
  assert.match(preference, /return 'tabela'/);
  assert.match(preference, /PROGRAMACAO_VIEW_STORAGE_KEY/);
  assert.match(page, /readProgramacaoViewMode\(viewPreferenceKey\)/);
  assert.match(page, /setViewMode\('cartoes'\)/);
  assert.match(page, /compactCards \/>/);
  assert.match(component, /expanded && schedule\.narrativaPCM/);
  assert.match(component, /Narrativa da OS/);
  assert.match(css, /\.lub-operations-v1011 \.lub-table \{[\s\S]*display: table/);
  assert.match(css, /\.lub-operations-v1011 \.lub-table thead \{ display: table-header-group; \}/);
  assert.doesNotMatch(css, /(^|\n)\s*(html|body|button|input|select|textarea)\s*\{/);
  console.log('OK: Tabela é o padrão, thead/scroll horizontal permanecem reais e Cartões preservam detalhes, edição PCM/manual e ações rápidas.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
