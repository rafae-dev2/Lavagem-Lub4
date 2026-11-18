const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { buildSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lub-ui-'));
try {
  const outfile = path.join(temp, 'table.cjs');
  buildSync({ entryPoints: [path.join(root, 'src/components/LubricationScheduleTable.tsx')], outfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react-dom'], nodePaths: [path.join(root, 'node_modules')] });
  const source = fs.readFileSync(outfile, 'utf8');
  const localFile = path.join(root, 'tests/.lub-ui-table.cjs');
  fs.writeFileSync(localFile, source);
  try {
    const Table = require(localFile).default;
    const base = { id: 'sb-1', frota: '4566', descricaoPonto: 'LAVADOR', tipoPreventiva: 'Lavagem / Lubrificação', dataProgramada: '2026-11-04', dataRealizada: '2026-11-04', horarioAgendado: '07:00', situacao: 'ENCERRADO', observacao: 'OS 159333190 | encerrada por ausência em 2026-11-04 15:11', origemRegistro: 'PCM', numeroOS: '159333190', apoioNome: 'Caminhão Caçamba', encerradoDetectadoEm: '2026-11-04T15:11:00Z' };
    const noop = () => {};
    const props = { schedules: [base], sortField: 'dataProgramada', sortDir: 'asc', onSort: noop, onEdit: noop, onDelete: noop, onQuick: noop, onPostpone: noop, onOpenFrota: noop, quickUpdating: null, deleting: null };
    let html = renderToStaticMarkup(React.createElement(Table, props));
    for (const value of ['4566', '159333190', 'Caminhão Caçamba', 'Lavagem / Lubrificação', '04/11/2026', 'Editar', 'Data realizada']) assert.ok(html.includes(value), `Campo ${value}`);
    assert.ok(!html.includes('encerrada por ausência'));
    assert.ok(!html.includes('A confirmar'));
    assert.ok(!html.includes('Excluir programação'));
    assert.ok(html.includes('aria-sort="ascending"'));
    html = renderToStaticMarkup(React.createElement(Table, { ...props, schedules: [{ ...base, origemRegistro: 'MANUAL', situacao: 'PROGRAMADO', dataRealizada: '', observacao: 'Observação operacional <segura>' }] }));
    assert.ok(html.includes('Iniciar frota 4566'));
    assert.ok(html.includes('Concluir frota 4566'));
    assert.ok(html.includes('Adiar frota 4566'));
    assert.ok(html.includes('Excluir programação'));
    assert.ok(html.includes('&lt;segura&gt;'));
    html = renderToStaticMarkup(React.createElement(Table, { ...props, schedules: [] }));
    assert.ok(html.includes('Nenhuma programação nesta seleção'));
    const page = fs.readFileSync(path.join(root, 'src/pages/Programacoes.tsx'), 'utf8');
    const edit = page.slice(page.indexOf('  const openEdit ='), page.indexOf('  // ─── Atalho rápido'));
    assert.ok(!edit.includes('PCM_READ_ONLY_MESSAGE'));
    assert.ok(page.includes('disabled={editingPcm || saving}'));
    assert.ok(page.includes('setSaveError(sheetError)'));
    const kanban = fs.readFileSync(path.join(root, 'src/components/TurnoKanban.tsx'), 'utf8');
    assert.ok(kanban.includes('onEdit(s)'));
    assert.ok(kanban.includes('cleanScheduleObservation(s)'));
    console.log('OK: tabela premium, Editar para PCM/manual, data realizada, técnica oculta, ações manuais, ordenação, narrativa segura e edição no quadro.');
  } finally { fs.rmSync(localFile, { force: true }); }
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
