import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { THEMES } from '../src/contexts/ThemeContext';
import { resolveWatermarkProfile } from '../src/lib/brandWatermarkConfig';

const ROOT = path.resolve(import.meta.dirname, '..');

test('dashboard-v32 theme is registered without altering verdan or liquid-glass-v18 order', () => {
  assert.equal(THEMES[0].key, 'verdan');
  assert.equal(THEMES[1].key, 'liquid-glass-v18');
  const v32 = THEMES.find((t) => t.key === 'dashboard-v32');
  assert.ok(v32, 'dashboard-v32 must be registered in THEMES');
  assert.equal(v32.label, 'Dashboard V32');
  assert.equal(v32.accentColor, '#F97316');
  assert.match(v32.previewBg, /#4e311d/i);
  assert.equal(v32.previewAccent, '#FB923C');
});

test('dashboard-v32 is wired in index.html, main.tsx, ThemeContext DARK_THEMES, and brandWatermarkConfig', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const main = fs.readFileSync(path.join(ROOT, 'src/main.tsx'), 'utf8');
  const themeCtx = fs.readFileSync(path.join(ROOT, 'src/contexts/ThemeContext.tsx'), 'utf8');

  assert.match(html, /'dashboard-v32':\s*1/);
  assert.match(html, /theme-dashboard-v32/);
  assert.match(html, /#0e0f11/);
  assert.match(main, /import ['"]\.\/styles\/dashboard-v32\.css['"];/);
  assert.match(themeCtx, /DARK_THEMES:[\s\S]*?'dashboard-v32'/);

  const profile = resolveWatermarkProfile('dashboard-v32', 'workspace');
  assert.equal(profile.isLightTheme, false);
  assert.equal(profile.isEmeraldTheme, false);
  assert.equal(profile.accentColor, '#f97316');
  assert.equal(profile.secondaryColor, '#10b981');
  assert.equal(profile.haloOpacity, 0.18);
});

test('dashboard-v32.css is strictly scoped under html.theme-dashboard-v32 and implements V32 console craft', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/styles/dashboard-v32.css'), 'utf8');

  assert.match(css, /^html\.theme-dashboard-v32\s*\{/m);
  // Matte obsidian canvas & #17181b bevel cards
  assert.match(css, /--v32-canvas:\s*#0e0f11/);
  assert.match(css, /--v32-surface:\s*#17181b/);
  // Floating walnut woodgrain console rail with amber section badges & gunmetal buttons
  assert.match(css, /repeating-linear-gradient\([\s\S]*?#5e3b23[\s\S]*?#442816/);
  assert.match(css, /flex:\s*0 0 268px;\s*\n\s*width:\s*268px;/);
  assert.match(css, /\.shell-nav-section[\s\S]*?#f59e0b[\s\S]*?#d97706/);
  assert.match(css, /\.shell-nav-item[\s\S]*?--v32-key-bg/);
  assert.match(css, /\.v32-console-clock/);
  // Brand logo natural color guard & accessibility
  assert.match(css, /img\[src\*="logo\.png"\]/);
  assert.match(css, /filter:\s*none\s*!important/);
  assert.doesNotMatch(css, /hue-rotate|grayscale|invert\(|sepia\(/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  // Ensure no unscoped global element rules leak outside html.theme-dashboard-v32
  assert.doesNotMatch(css, /(^|\n)\s*(?:body|article|img|table|canvas)\s*\{/m);
});

test('VerdanAnimatedWidgets, Dashboard, Programacoes, CentralGerencial, and Layout support V32 widgets and clock', () => {
  const widgets = fs.readFileSync(path.join(ROOT, 'src/components/VerdanAnimatedWidgets.tsx'), 'utf8');
  const dashboard = fs.readFileSync(path.join(ROOT, 'src/pages/Dashboard.tsx'), 'utf8');
  const programacoes = fs.readFileSync(path.join(ROOT, 'src/pages/Programacoes.tsx'), 'utf8');
  const central = fs.readFileSync(path.join(ROOT, 'src/pages/CentralGerencial.tsx'), 'utf8');
  const layout = fs.readFileSync(path.join(ROOT, 'src/components/Layout.tsx'), 'utf8');

  assert.match(widgets, /V32_SEGMENT_COUNT = 22/);
  assert.match(widgets, /variant === 'v32-segmented'/);
  assert.match(widgets, /accentColor = '#b7ed40'/);

  assert.match(dashboard, /isDashboardV32 = theme === 'dashboard-v32'/);
  assert.match(dashboard, /id="v32OrangeBar"/);
  assert.match(dashboard, /variant="v32-segmented"/);
  assert.match(dashboard, /v32-gauge-subgrid/);

  assert.match(programacoes, /isDashboardV32 = theme === 'dashboard-v32'/);
  assert.match(programacoes, /accentColor=\{[^}]*isDashboardV32 \? '#10b981' : '#b7ed40'\}/);
  assert.match(central, /theme === 'dashboard-v32'/);

  assert.match(layout, /isDashboardV32 = theme === "dashboard-v32"/);
  assert.match(layout, /v32-console-clock/);
  assert.match(layout, /t\.key === "dashboard-v32"/);
});

test('dashboard-v32.css overrides light surfaces and enforces readable contrast in Lavagem, Central Gerencial, and Apoio', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/styles/dashboard-v32.css'), 'utf8');

  // 1. Global StatusBadge pills & Tailwind -100 pill colors
  for (const status of ['PENDENTE', 'ATRASADO', 'PROGRAMADO', 'ANDAMENTO', 'ENCERRADO']) {
    assert.match(css, new RegExp(`\\.status-badge\\[data-status="${status}"\\]`));
  }
  // 2. Lavagem / Lubrificação table caption & quick-action dark surfaces
  assert.match(css, /\.lub-module\s+\.lub-table-caption\s*\{[\s\S]*?background:\s*#121316\s*!important/);
  // 3. Central Gerencial toolbar nav, search input wrapper, filter pills, chart pills, and heatmap cells
  assert.match(css, /\.bi-view-toolbar\s*\{[\s\S]*?background:\s*transparent\s*!important/);
  assert.match(css, /\.bi-view-toolbar nav/);
  assert.match(css, /\.bi-root\s+\.bi-search/);
  assert.match(css, /\.bi-filter-summary small/);
  assert.match(css, /\.bi-chart-actions button/);
  assert.match(css, /\.bi-heat-cell:not\(\.is-zero\)\s*\{[\s\S]*?color:\s*#ffffff\s*!important/);
  assert.match(css, /\.bi-heat-cell\.is-zero\s*\{[\s\S]*?background:\s*#121316\s*!important/);
  // 4. Apoio & Maintenance status pills and observed days badges
  assert.match(css, /\.mt-status--programado/);
  assert.match(css, /\.mt-order\s+\.mt-days\b/);
  assert.match(css, /\.mt-order\s+\.mt-days\.mt-days--late\b/);
  assert.match(css, /\.apoio-orders-table\s+\.apoio-table-fleet-cell/);
});
