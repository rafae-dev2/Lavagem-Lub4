import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readCss(relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

test('boxed dark themes all apply explicit inner padding and overflow containment to .mt-toolbar (VISÃO OPERACIONAL)', () => {
  const themeFiles = [
    'src/styles/vitrea.css',
    'src/styles/dashboard-v32.css',
    'src/styles/verdan-os.css',
    'src/styles/ios-liquid-glass.css',
    'src/styles/black-cyan-os.css',
    'src/styles/liquid-glass-v18.css',
  ];

  for (const file of themeFiles) {
    const css = readCss(file);
    const toolbarBlockPattern = /\.mt-toolbar\s*\{[^}]*padding:\s*\d+px\s+\d+px/s;
    assert.match(
      css,
      toolbarBlockPattern,
      `${file} must define explicit padding on .mt-toolbar so VISÃO OPERACIONAL text never leaks past rounded card edges`,
    );
  }
});

test('base maintenance-tracking.css constrains .mt-toolbar width and prevents text overflow', () => {
  const css = readCss('src/styles/maintenance-tracking.css');
  assert.match(css, /\.mt-toolbar\s*\{[^}]*box-sizing:\s*border-box/s);
  assert.match(css, /\.mt-toolbar\s*\{[^}]*max-width:\s*100%/s);
  assert.match(css, /\.mt-toolbar\s*>\s*div:first-child\s*\{[^}]*min-width:\s*0/s);
});

test('apoio-compact-table.css prevents vertical character-by-character wrapping in EQUIPAMENTO column', () => {
  const css = readCss('src/styles/apoio-compact-table.css');

  // Table itself has horizontal scroll width so columns never collapse on mobile or narrow desktop
  const tableMinWidth = css.match(/\.apoio-orders-table\s*\{[^}]*min-width:\s*(\d+)px/s);
  assert.ok(tableMinWidth, '.apoio-orders-table must define a min-width');
  assert.ok(Number(tableMinWidth[1]) >= 1080, `.apoio-orders-table min-width should be >= 1080px, got ${tableMinWidth[1]}`);

  // Equipment column and its text wrapper must reserve readable width next to thumbnail
  const equipCellMin = css.match(/\.apoio-table-equipment-cell\s*\{[^}]*min-width:\s*(\d+)px/s);
  assert.ok(equipCellMin, '.apoio-table-equipment-cell must define min-width');
  assert.ok(Number(equipCellMin[1]) >= 205, `.apoio-table-equipment-cell min-width should be >= 205px, got ${equipCellMin[1]}`);

  const equipTextMin = css.match(/\.apoio-table-equipment-wrap\s*>\s*:last-child\s*\{[^}]*min-width:\s*(\d+)px/s);
  assert.ok(equipTextMin, '.apoio-table-equipment-wrap > :last-child must define min-width');
  assert.ok(Number(equipTextMin[1]) >= 140, `.apoio-table-equipment-wrap > :last-child min-width should be >= 140px, got ${equipTextMin[1]}`);

  // Forecast badge must render as a crisp single-line inline-flex pill
  assert.match(
    css,
    /\.apoio-table-forecast-badge\s*\{[^}]*display:\s*inline-flex;[^}]*white-space:\s*nowrap;/s,
  );

  // Primary table text cells must use word-break: normal + overflow-wrap: break-word (never overflow-wrap: anywhere)
  assert.match(
    css,
    /\.apoio-table-equipment,\s*\.apoio-table-group\s*\{[^}]*overflow-wrap:\s*break-word;\s*word-break:\s*normal;/s,
  );
  assert.match(
    css,
    /\.apoio-table-secondary\s*\{[^}]*overflow-wrap:\s*break-word;\s*word-break:\s*normal;/s,
  );
});

test('vitrea.css styles Apoio table with opaque sticky FROTA column and readable detail drawer', () => {
  const css = readCss('src/styles/vitrea.css');
  assert.match(
    css,
    /\.apoio-table-fleet-cell\s*\{[^}]*background:\s*#[0-9a-fA-F]{6}\s*!important/s,
    'Vitrea sticky FROTA column must use an opaque hex background so horizontally scrolled cells do not bleed through',
  );
  assert.match(
    css,
    /tbody\s+tr:hover\s+\.apoio-table-fleet-cell\s*\{[^}]*background:\s*#[0-9a-fA-F]{6}\s*!important/s,
    'Vitrea sticky FROTA column must remain opaque on row hover',
  );
  assert.match(css, /\.apoio-table-detail\s*\{[^}]*background:/s);
  assert.match(css, /\.apoio-table-full-narrative\s+p\s*\{[^}]*color:/s);
});
