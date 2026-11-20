import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { THEMES } from '../src/contexts/ThemeContext';

const ROOT = path.resolve(import.meta.dirname, '..');

test('liquid-glass-v18 theme is registered right after verdan default without displacing verdan', () => {
  assert.equal(THEMES[0].key, 'verdan');
  assert.equal(THEMES[1].key, 'liquid-glass-v18');
  const lg18 = THEMES.find((t) => t.key === 'liquid-glass-v18');
  assert.ok(lg18, 'liquid-glass-v18 deve existir na lista de temas');
  assert.equal(lg18.label, 'Liquid Glass V18');
  assert.equal(lg18.accentColor, '#3B82F6');
  assert.match(lg18.previewBg, /#2563eb/i);
});

test('index.html bootstrap and main.tsx entrypoint include liquid-glass-v18 last', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const main = fs.readFileSync(path.join(ROOT, 'src/main.tsx'), 'utf8');
  assert.match(html, /'liquid-glass-v18':\s*1/);
  assert.match(html, /theme-liquid-glass-v18/);
  assert.match(main, /import ['"]\.\/styles\/liquid-glass-v18\.css['"];/);
  const iosIndex = main.indexOf("./styles/ios-liquid-glass.css");
  const lg18Index = main.indexOf("./styles/liquid-glass-v18.css");
  assert.ok(lg18Index > iosIndex, 'liquid-glass-v18.css deve ser importado por último');
});

test('liquid-glass-v18.css implements premium blur, studio dual-tone depth, royal blue cards, specular rims, motion & safety guards', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/styles/liquid-glass-v18.css'), 'utf8');
  assert.match(css, /^html\.theme-liquid-glass-v18\s*\{/m);
  assert.match(css, /backdrop-filter:\s*var\(--lg18-blur/);
  assert.match(css, /--lg18-blur:\s*blur\(32px\)\s*saturate\(195%\)/);
  assert.match(css, /--lg18-glass-featured:/);
  assert.match(css, /inset 0 1\.5px (?:0|1px) rgba\(255, 255, 255/);
  assert.match(css, /transform:\s*translateY\(-5px\)/);
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /img\[src\*="logo\.png"\]/);
  assert.match(css, /filter:\s*none\s*!important/);
  assert.doesNotMatch(css, /hue-rotate|grayscale|invert\(|sepia\(/);
  assert.match(css, /@supports not \(\(backdrop-filter:/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  // Ensure no unscoped global element selectors leak outside html.theme-liquid-glass-v18
  assert.doesNotMatch(css, /(^|\n)\s*(?:body|article|img|table|canvas)\s*\{/m);
});

test('liquid-glass-v18.css overrides Apoio cream/yellow surfaces and murky muted text leaks', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/styles/liquid-glass-v18.css'), 'utf8');
  // Re-override --bg-card / --bg-hover / --text-secondary inside .maintenance-tracking
  assert.match(css, /\.maintenance-tracking[\s\S]*?--bg-card:\s*rgba\(/);
  assert.match(css, /\.maintenance-tracking[\s\S]*?--bg-hover:\s*rgba\(/);
  // Fix Equipamentos em Oficina de Terceiros picker container, rows & bright fleet number contrast
  assert.match(css, /\.apoio-image-reports\s+\.apoio-image-preview\s*\{[\s\S]*?backdrop-filter:/);
  assert.match(css, /\.apoio-image-reports\s+\.apoio-image-preview-row\s*\{[\s\S]*?backdrop-filter:/);
  assert.match(css, /\.apoio-image-reports\s+\.apoio-image-preview-text\s+strong\s*\{[\s\S]*?color:\s*#ffffff\s*!important/);
  assert.match(css, /\.apoio-image-reports\s+\.apoio-image-preview-text\s+small\.apoio-preview-emergency/);
  // Fix visibility bar & source connection telemetry text
  assert.match(css, /\.maintenance-tracking\s+\.mt-visibility-bar\s*\{[\s\S]*?backdrop-filter:/);
  assert.match(css, /\.maintenance-tracking\s+\.mt-source-line\s*\{[\s\S]*?backdrop-filter:/);
  assert.match(css, /\.maintenance-tracking\s+\.mt-source-line\s*>\s*span\s*\{/);
  // Featured KPI specificity inside maintenance-tracking, dashboard & lub-module
  assert.match(css, /\.maintenance-tracking\s+:is\(\.mt-kpi,\s*\.apoio-kpi\):first-child/);
  assert.match(css, /\.lavagem-dashboard\s+\.dashboard-kpi:nth-child\(5\)/);
  assert.match(css, /\.lavagem-premium\s+\.lub-module\s+\.lub-kpi:first-child/);
  // Fix card kickers, equipment thumbnails, Turno de Hoje badges & Configuracoes glass tiles
  assert.match(css, /\.maintenance-tracking\s+\.mt-card-kicker/);
  assert.match(css, /\.app-shell\s+\.equipment-thumbnail\s*\{[\s\S]*?backdrop-filter:/);
  assert.match(css, /\.app-shell\s+\.bg-amber-100\s*\{/);
  assert.match(css, /\.equipment-image-manager__checker/);
  assert.match(css, /\.equipment-image-manager__role\.is-viewer/);
  // Fix VISÃO OPERACIONAL (.mt-toolbar) padding and .mt-history-summary framing
  assert.match(css, /\.maintenance-tracking\s+\.mt-toolbar\s*\{[\s\S]*?padding:\s*18px 20px\s*!important/);
  assert.match(css, /\.maintenance-tracking\s+\.mt-history-summary\s*\{[\s\S]*?margin:\s*0\s*!important/);
});

test('ControleApoio keeps Relatórios em imagem minimized by default so user chooses when to open it', () => {
  const controleApoio = fs.readFileSync(path.join(ROOT, 'src/pages/ControleApoio.tsx'), 'utf8');
  assert.match(controleApoio, /<details className="mt-filters apoio-image-reports">/);
  assert.doesNotMatch(controleApoio, /<details className="mt-filters apoio-image-reports" open>/);
});

test('Layout.tsx and Dashboard.tsx integrate liquid-glass-v18 badge and chart palette', () => {
  const layout = fs.readFileSync(path.join(ROOT, 'src/components/Layout.tsx'), 'utf8');
  const dashboard = fs.readFileSync(path.join(ROOT, 'src/pages/Dashboard.tsx'), 'utf8');
  assert.match(layout, /t\.key === "liquid-glass-v18"/);
  assert.match(dashboard, /isLiquidGlassV18 = theme === 'liquid-glass-v18'/);
  assert.match(dashboard, /#34d399/);
  assert.match(dashboard, /#60a5fa/);
});

test('liquid-glass-v18 uses clear watery glass refraction & specular meniscus without breaking portaled modals', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/styles/liquid-glass-v18.css'), 'utf8');
  assert.match(css, /rgba\(186,\s*230,\s*253/);
  assert.match(css, /aquaLens/);
  assert.match(css, /inset 0 -2px 2px rgba\(125,\s*211,\s*252/);
  assert.match(css, /\.historico-frota-modal\s+\.historico-frota-card/);
  assert.match(css, /\[role=['"]dialog['"]\]\s+\.rounded-2xl/);
});

test('Lavagem modals portal to document.body and tab panel avoids fixed-position containing traps', () => {
  const historico = fs.readFileSync(path.join(ROOT, 'src/components/HistoricoFrotaModal.tsx'), 'utf8');
  const programacoes = fs.readFileSync(path.join(ROOT, 'src/pages/Programacoes.tsx'), 'utf8');
  const lavagemCss = fs.readFileSync(path.join(ROOT, 'src/styles/lavagem-premium.css'), 'utf8');

  assert.match(historico, /createPortal\([\s\S]*document\.body\s*\)/);
  assert.match(historico, /historico-frota-modal/);
  assert.match(historico, /role="dialog"/);
  assert.match(programacoes, /createPortal\([\s\S]*document\.body\s*\)/);
  assert.match(programacoes, /lub-premium-modal[\s\S]*role="dialog"/);

  const tabPanelMatch = lavagemCss.match(/\.lavagem-premium\s+\.lavagem-premium-tab-panel\s*\{[^}]*\}/);
  assert.ok(tabPanelMatch, '.lavagem-premium-tab-panel rule must exist');
  assert.doesNotMatch(tabPanelMatch[0], /\bcontain\s*:/);
  assert.doesNotMatch(tabPanelMatch[0], /\bwill-change\s*:/);

  const glassyCss = fs.readFileSync(path.join(ROOT, 'src/styles/glassy-v18.css'), 'utf8');
  assert.match(glassyCss, /\[role=['"]dialog['"]\]\s+\.rounded-2xl/, 'glassy-v18.css must style portaled dialog cards');

  for (const themeCss of ['verdan-os.css', 'black-cyan-os.css', 'ios-liquid-glass.css']) {
    const content = fs.readFileSync(path.join(ROOT, 'src/styles', themeCss), 'utf8');
    assert.match(content, /\.historico-frota-modal\s+\.historico-frota-card/, `${themeCss} must style portaled HistoricoFrotaModal card`);
    assert.match(content, /\.lub-premium-modal\s+\.lub-modal/, `${themeCss} must style portaled Edit modal card`);
  }
});

test('index.css and premium themes enforce depth-tiered backdrop-filter, box-shadow, and translucency hierarchy', () => {
  const indexCss = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
  const lg18Css = fs.readFileSync(path.join(ROOT, 'src/styles/liquid-glass-v18.css'), 'utf8');
  const iosCss = fs.readFileSync(path.join(ROOT, 'src/styles/ios-liquid-glass.css'), 'utf8');
  const glassyRefCss = fs.readFileSync(path.join(ROOT, 'src/styles/glassy-v18-refinements.css'), 'utf8');

  assert.match(indexCss, /--glass-depth-base-bg:/);
  assert.match(indexCss, /--glass-float-bg:/);
  assert.match(indexCss, /--glass-card-shadow:/);
  assert.match(lg18Css, /--lg18-glass-base:/);
  assert.match(lg18Css, /--lg18-glass-capsule:/);
  assert.match(lg18Css, /--lg18-blur-heavy:/);
  assert.match(iosCss, /--ios-glass-1:/);
  assert.match(iosCss, /--ios-glass-2:/);
  assert.match(iosCss, /--ios-glass-capsule:/);
  assert.match(glassyRefCss, /--glass-blur:\s*26px/);
  assert.match(glassyRefCss, /--glass-card-shadow:/);
});

test('Dashboard and workshop equipment listings apply .glass-card depth layers and elevated backdrop-filter on active/selected elements', () => {
  const indexCss = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
  const lg18Css = fs.readFileSync(path.join(ROOT, 'src/styles/liquid-glass-v18.css'), 'utf8');
  const iosCss = fs.readFileSync(path.join(ROOT, 'src/styles/ios-liquid-glass.css'), 'utf8');

  assert.match(indexCss, /--glass-blur-active:\s*36px/);
  assert.match(indexCss, /\.dashboard-equipment-card\.glass-card/);
  assert.match(indexCss, /backdrop-filter:\s*saturate\(215%\)\s*brightness\(1\.10\)\s*blur\(var\(--glass-blur-active/);

  assert.match(lg18Css, /--lg18-blur-active:\s*blur\(52px\)/);
  assert.match(lg18Css, /--lg18-shadow-depth:/);
  assert.match(lg18Css, /\.lavagem-dashboard\s+\.dashboard-equipment-card\.glass-card/);
  assert.match(lg18Css, /backdrop-filter:\s*var\(--lg18-blur-active\)\s*!important/);

  assert.match(iosCss, /backdrop-filter:\s*var\(--ios-glass-blur-heavy\)\s*!important/);

  for (const relPath of [
    'src/pages/Dashboard.tsx',
    'src/components/AlertasEquipamentos.tsx',
    'src/components/MaintenanceOrderCard.tsx',
    'src/components/LubricationScheduleTable.tsx',
    'src/pages/ControleApoio.tsx',
    'src/components/ApoioGroupFleetFilter.tsx',
    'src/components/TurnoKanban.tsx',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    assert.match(src, /\bglass-card\b/, `${relPath} must use .glass-card on equipment/workshop cards`);
  }
});

test('EquipmentThumbnail renders subtle glass shimmer placeholder while loading and fades smoothly on load', () => {
  const componentSrc = fs.readFileSync(path.join(ROOT, 'src/components/EquipmentThumbnail.tsx'), 'utf8');
  const imagesCss = fs.readFileSync(path.join(ROOT, 'src/styles/equipment-images.css'), 'utf8');
  const lg18Css = fs.readFileSync(path.join(ROOT, 'src/styles/liquid-glass-v18.css'), 'utf8');

  assert.match(componentSrc, /equipment-thumbnail--loading/);
  assert.match(componentSrc, /equipment-thumbnail--loaded/);
  assert.match(componentSrc, /equipment-thumbnail__shimmer/);
  assert.match(componentSrc, /aria-busy=\{isLoading \? "true" : undefined\}/);

  assert.match(imagesCss, /@keyframes equipmentGlassShimmer/);
  assert.match(imagesCss, /\.equipment-thumbnail__shimmer::before/);
  assert.match(imagesCss, /\.equipment-thumbnail--loading img\s*\{\s*opacity:\s*0;/);
  assert.match(imagesCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.equipment-thumbnail__shimmer::before/);

  assert.match(lg18Css, /\.equipment-thumbnail--loading/);
  assert.match(lg18Css, /\.equipment-thumbnail__shimmer::before/);
});

test('liquid-glass-v18 refines featured KPI highlight, eyebrow contrast over amber glow, mobile visibility buttons, and search double-box reset', () => {
  const lg18Css = fs.readFileSync(path.join(ROOT, 'src/styles/liquid-glass-v18.css'), 'utf8');
  const mpCss = fs.readFileSync(path.join(ROOT, 'src/styles/maintenance-premium.css'), 'utf8');
  const mtCss = fs.readFileSync(path.join(ROOT, 'src/styles/maintenance-tracking.css'), 'utf8');

  // 1. Featured royal-blue KPI softened highlight + crisp text-shadow
  assert.match(lg18Css, /--lg18-glass-featured:\s*linear-gradient\([\s\S]*?rgba\(96,\s*165,\s*250,\s*0\.44\)/);
  assert.match(lg18Css, /text-shadow:\s*0 1px 2px rgba\(7,\s*18,\s*46,\s*0\.42\)/);

  // 2. Micro-eyebrows over amber glow
  assert.match(lg18Css, /\.apoio-reference \.apoio-eyebrow\s*\{[\s\S]*?color:\s*#dbeafe\s*!important;[\s\S]*?text-shadow:\s*0 1px 6px rgba\(10,\s*16,\s*30,\s*0\.72\)/);
  assert.match(lg18Css, /\.mt-order\.mt-order--late \.mt-card-kicker\s*\{[\s\S]*?color:\s*#fecdd3\s*!important;/);

  // 3. Mobile "Mostrar encerradas" buttons
  assert.match(lg18Css, /\.mt-visibility-action\s*\{[\s\S]*?padding:\s*9px 18px\s*!important;[\s\S]*?white-space:\s*nowrap;/);
  assert.match(lg18Css, /\.mt-toolbar-actions \.mt-visibility-toggle\s*\{[\s\S]*?white-space:\s*nowrap;[\s\S]*?min-height:\s*44px;/);
  assert.match(mpCss, /@container maintenance-workspace \(max-width:\s*560px\)/);
  assert.match(mtCss, /flex:\s*1 1 165px;\s*[\s\S]*?white-space:\s*nowrap;/);

  // 4. Search input double-box reset & magnifying glass gap
  assert.match(lg18Css, /\.apoio-direct-search-control\s*\{[\s\S]*?gap:\s*11px\s*!important;[\s\S]*?padding:\s*0 14px\s*!important;/);
  assert.match(lg18Css, /\.apoio-sticky-search \.apoio-direct-search-control input:not\(\[type="checkbox"\]\)[\s\S]*?background:\s*transparent\s*!important;[\s\S]*?border:\s*0\s*!important;/);
  assert.match(lg18Css, /\.mt-search input:not\(\[type="checkbox"\]\)[\s\S]*?padding-left:\s*42px\s*!important;/);
});

test('dark sibling themes override Central Gerencial heatmap cells and StatusBadge contrast', () => {
  for (const rel of [
    'src/styles/liquid-glass-v18.css',
    'src/styles/ios-liquid-glass.css',
    'src/styles/black-cyan-os.css',
  ]) {
    const css = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.match(css, /\.bi-heat-cell:not\(\.is-zero\)\s*\{[\s\S]*?color:\s*#ffffff\s*!important/, `${rel} must force high-contrast text on non-zero heatmap cells`);
    assert.match(css, /\.bi-heat-cell\.is-zero\s*\{/, `${rel} must darken zero heatmap cells`);
    assert.match(css, /\.bi-status-programado/, `${rel} must override .bi-status-programado`);
    assert.match(css, /\.bg-red-100/, `${rel} must override .bg-red-100`);
    assert.match(css, /\.bg-purple-100/, `${rel} must override .bg-purple-100`);
  }
});



