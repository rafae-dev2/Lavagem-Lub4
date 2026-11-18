import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

const pagePath = path.resolve('src/pages/ControleApoio.tsx');
const tablePath = path.resolve('src/components/ApoioOrdersTable.tsx');
const stylePath = path.resolve('src/styles/apoio-compact-table.css');
const multiPath = path.resolve('src/components/ApoioMultiSelect.tsx');
const refinedTablePath = path.resolve('src/styles/apoio-refined-table.css');
const [page, table, styles, multi, refinedTable] = await Promise.all([
  readFile(pagePath, 'utf8'),
  readFile(tablePath, 'utf8'),
  readFile(stylePath, 'utf8'),
  readFile(multiPath, 'utf8'),
  readFile(refinedTablePath, 'utf8'),
]);

const temp = await mkdtemp(path.join(tmpdir(), 'apoio-table-test-'));
try {
  await build({
    entryPoints: [pagePath, tablePath],
    outdir: temp,
    format: 'esm',
    loader: { '.tsx': 'tsx' },
    bundle: false,
    logLevel: 'silent',
  });

  assert.ok(table.includes('tabIndex={0}') && table.includes('role="region"'), 'rolagem deve ser focável e identificada');
  assert.ok(table.includes('<thead>'), 'a tabela deve ter thead semântico');
  assert.ok(table.includes('<tbody>'), 'a tabela deve ter tbody semântico');
  assert.ok(table.includes('scope="col"'), 'as colunas devem declarar escopo');
  assert.ok(table.includes('scope="row"'), 'a frota deve ser cabeçalho de linha');
  assert.ok(table.includes('aria-expanded={isExpanded}'), 'o botão de detalhes deve expor aria-expanded');
  assert.ok(table.includes('aria-controls={rowDetailId}'), 'o botão deve controlar uma região de detalhes');
  assert.ok(table.includes('Status bruto na fonte'), 'o status bruto deve ficar nos detalhes completos');
  assert.ok(table.includes('Narrativa completa'), 'a narrativa completa deve ficar disponível na expansão');
  assert.ok(table.includes('getMaintenanceOrderClosure(row)'), 'a tabela deve usar o fechamento compartilhado');
  assert.ok(!table.includes('dangerouslySetInnerHTML'), 'a narrativa não pode aceitar HTML bruto');
  assert.ok(table.includes('const late = !closed'), 'ordens encerradas não podem ser marcadas como atrasadas');
  assert.ok(table.includes('apoio-table-row-forecast-late'), 'a tabela precisa marcar somente previsão vencida');
  assert.ok(table.includes('apoio-table-forecast-badge'), 'a tabela precisa de badge textual para previsão vencida');

  const directToolbar = page.indexOf('className="apoio-direct-toolbar"');
  const filterDetails = page.indexOf('<details className="mt-filters apoio-filter-center">');
  assert.ok(filterDetails >= 0 && directToolbar > filterDetails, 'a busca deve ficar no painel de filtros, como na referência Reformas');
  assert.ok(page.includes('aria-label="Pesquisar frota, OS ou narrativa"'), 'a busca deve ter o rótulo acessível solicitado');
  assert.ok(page.includes('Limpar busca'), 'a barra deve ter botão de limpar');
  assert.ok(page.includes('aria-live="polite"'), 'a contagem da seleção deve ser anunciada');
  assert.ok(page.includes('aria-pressed={displayMode === \'cards\'}'), 'o modo cartões deve ser alternável');
  assert.ok(page.includes('aria-pressed={displayMode === \'table\'}'), 'o modo tabela deve ser alternável');
  assert.ok(page.includes('<ApoioOrdersTable'), 'a página deve renderizar a tabela nova');
  assert.ok(page.includes('rows={shown}'), 'a tabela deve receber a mesma página de rows filtradas');
  assert.ok(page.includes('PAGE_SIZE = 40'), 'a paginação operacional de 40 deve ser preservada');
  assert.ok(page.includes('localStorage.getItem(DISPLAY_MODE_STORAGE_KEY)'), 'a preferência local deve ser lida com chave própria');
  assert.ok(page.includes('try { window.localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, displayMode); } catch'), 'a preferência local deve falhar com segurança');
  assert.ok(page.includes('<ApoioMultiSelect'), 'a página deve usar multi-select local acessível');
  assert.ok(page.includes('value={origins}') && page.includes('value={statuses}') && page.includes('value={providersFilter}'), 'origem, status e prestador devem aceitar múltiplas seleções');
  assert.ok(multi.includes('Selecionar visíveis') && multi.includes('Limpar seleção') && multi.includes('Sem seleção considera todas'), 'multi-select deve oferecer ações robustas e seleção vazia como Todos');
  assert.ok(multi.includes('apoio-multi-select-chip'), 'multi-select deve renderizar chips removíveis');

  assert.match(styles, /\.apoio-table-scroll\s*\{[\s\S]*?overflow-x:\s*auto;/, 'somente o wrapper da tabela deve controlar overflow horizontal');
  assert.ok(page.includes('className="mt-card-grid"'), 'cartões devem usar a grade da referência Reformas');
  assert.ok(page.includes('maintenance-premium.css') && page.includes('operational-compact.css'), 'Apoio deve carregar os mesmos estilos da referência');
  assert.ok(!page.includes('apoio-premium apoio-reference'), 'classes antigas não devem interferir na largura/cores');
  console.log('OK: tabela semântica, detalhes completos, busca direta, alternância e compactação de Apoio.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
