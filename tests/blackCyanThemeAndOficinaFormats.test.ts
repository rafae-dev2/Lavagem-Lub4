import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  OFICINA_REPORT_FORMATS,
  OFICINA_TERCEIROS_IMAGE,
  normalizeOficinaFormat,
  normalizeOficinaQuality,
  resolveOficinaRenderDimensions,
} from '../src/lib/apoioOficinaTerceirosData';
import { THEMES } from '../src/contexts/ThemeContext';

const ROOT = path.resolve(import.meta.dirname, '..');

test('black-cyan theme is registered without replacing verdan default', () => {
  assert.equal(THEMES[0].key, 'verdan');
  const blackCyan = THEMES.find((t) => t.key === 'black-cyan');
  assert.ok(blackCyan, 'black-cyan deve existir na lista de temas');
  assert.equal(blackCyan.accentColor, '#06b6d4');
  assert.match(blackCyan.previewBg, /#000000/);
});

test('black-cyan stylesheet preserves logo natural colors and avoids color filters', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/styles/black-cyan-os.css'), 'utf8');
  assert.match(css, /html\.theme-black-cyan/);
  assert.match(css, /img\[src\*="logo\.png"\]/);
  assert.match(css, /filter:\s*none\s*!important/);
  assert.doesNotMatch(css, /hue-rotate|grayscale|invert\(|sepia\(/);
  assert.match(css, /--bg-primary:\s*#000000\s*!important/);
  assert.match(css, /#0891b2/);
});

test('ios-liquid-glass theme is Black Liquid Glass Premium, translucent, preserves logo natural colors, and uses SF/Plus Jakarta typography', () => {
  const iosTheme = THEMES.find((t) => t.key === 'ios-liquid-glass');
  assert.ok(iosTheme, 'ios-liquid-glass deve existir na lista de temas');
  assert.equal(iosTheme.accentColor, '#0A84FF');
  assert.match(iosTheme.previewBg, /#000000/);
  const css = fs.readFileSync(path.join(ROOT, 'src/styles/ios-liquid-glass.css'), 'utf8');
  assert.match(css, /html\.theme-ios-liquid-glass/);
  assert.match(css, /--bg-primary:\s*#000000\s*!important/);
  assert.match(css, /backdrop-filter:\s*var\(--ios-glass-blur/);
  assert.match(css, /img\[src\*="logo\.png"\]/);
  assert.match(css, /filter:\s*none\s*!important/);
  assert.doesNotMatch(css, /hue-rotate|grayscale|invert\(|sepia\(/);
  assert.match(css, /SF Pro/);
  assert.match(css, /Plus Jakarta Sans/);
  assert.match(css, /\.mt-filter-body/);
  assert.match(css, /\.mt-days\.mt-days--late/);
  assert.match(css, /\.mt-status--programado/);
  assert.match(css, /\.apoio-group-fleet-checkbox/);
});

test('black-cyan and mobile-operations styles preserve dark contrast for Apoio cards, checkboxes, and recency padding', () => {
  const bcCss = fs.readFileSync(path.join(ROOT, 'src/styles/black-cyan-os.css'), 'utf8');
  const mobileCss = fs.readFileSync(path.join(ROOT, 'src/styles/mobile-operations-v1011.css'), 'utf8');
  const fleetCss = fs.readFileSync(path.join(ROOT, 'src/styles/apoio-fleet-filter.css'), 'utf8');
  assert.match(bcCss, /\.apoio-group-fleet-checkbox/);
  assert.match(bcCss, /\.mt-days\.mt-days--late/);
  assert.match(bcCss, /\.mt-status--programado/);
  assert.match(mobileCss, /\.apoio-operations-v1011\s+\.apoio-recency-panel[\s\S]*padding:\s*14px/);
  assert.match(fleetCss, /overflow-wrap:\s*break-word/);
});

test('LavagemPremiumLayout supports keyed fade and slide-up tab entrance animations', () => {
  const layoutSrc = fs.readFileSync(path.join(ROOT, 'src/components/LavagemPremiumLayout.tsx'), 'utf8');
  const lavagemCss = fs.readFileSync(path.join(ROOT, 'src/styles/lavagem-premium.css'), 'utf8');
  assert.match(layoutSrc, /activeTab\?:\s*string/);
  assert.match(layoutSrc, /lavagem-premium-tab-panel/);
  assert.match(lavagemCss, /@keyframes lavagemTabEnter/);
  assert.match(lavagemCss, /translate3d\(0,\s*14px,\s*0\)/);
  assert.match(lavagemCss, /prefers-reduced-motion:\s*reduce/);
});

test('verdan-os.css remains intact with chartreuse-lime identity', () => {
  const verdanCss = fs.readFileSync(path.join(ROOT, 'src/styles/verdan-os.css'), 'utf8');
  assert.match(verdanCss, /--verdan-lime:\s*#b7ed40/);
  assert.doesNotMatch(verdanCss, /theme-black-cyan/);
});

test('Oficina report presets keep 921x1600 default and scale tablet/computador with quality clamp', () => {
  assert.deepEqual({ ...OFICINA_TERCEIROS_IMAGE }, { width: 921, height: 1600 });
  assert.equal(normalizeOficinaFormat('tablet'), 'tablet');
  assert.equal(normalizeOficinaFormat('computador'), 'computador');
  assert.equal(normalizeOficinaFormat('desktop'), 'computador');
  assert.equal(normalizeOficinaFormat('invalid'), 'celular');

  assert.equal(normalizeOficinaQuality('padrao'), 'padrao');
  assert.equal(normalizeOficinaQuality('alta'), 'alta');
  assert.equal(normalizeOficinaQuality('ultra'), 'ultra');

  const mobileStd = resolveOficinaRenderDimensions('celular', 'padrao');
  assert.equal(mobileStd.cssWidth, 921);
  assert.equal(mobileStd.cssHeight, 1600);
  assert.equal(mobileStd.scale, 1);
  assert.equal(mobileStd.pixelWidth, 921);
  assert.equal(mobileStd.pixelHeight, 1600);

  const tabletHigh = resolveOficinaRenderDimensions('tablet', 'alta');
  assert.equal(tabletHigh.cssWidth, 1240);
  assert.equal(tabletHigh.scale, 2);
  assert.equal(tabletHigh.pixelWidth, 2480);
  assert.equal(tabletHigh.pixelHeight, 3120);

  const pcUltra = resolveOficinaRenderDimensions('computador', 'ultra');
  assert.equal(pcUltra.cssWidth, 1680);
  assert.equal(pcUltra.cssHeight, 945);
  assert.equal(pcUltra.scale, 2.5);
  assert.equal(pcUltra.pixelWidth, 4200);
  assert.equal(pcUltra.pixelHeight, 2363);

  // Huge vertical list clamps safely below canvas pixel/dimension caps
  const longPc = resolveOficinaRenderDimensions('computador', 'ultra', 9500);
  assert.ok(longPc.pixelHeight <= 16000);
  assert.ok(longPc.pixelWidth * longPc.pixelHeight <= 60_000_000 + 25000);
  assert.equal(longPc.clamped, true);
  assert.ok(OFICINA_REPORT_FORMATS.computador.width === 1680);
});

test('Oficina reports (Terceiros e Interna) and WhatsApp report resolve equipment thumbnails from the current registry beside the description', () => {
  const dataSrc = fs.readFileSync(path.join(ROOT, 'src/lib/apoioOficinaTerceirosData.ts'), 'utf8');
  const reportSrc = fs.readFileSync(path.join(ROOT, 'src/lib/apoioOficinaTerceirosReport.ts'), 'utf8');
  const whatsappSrc = fs.readFileSync(path.join(ROOT, 'src/lib/apoioWhatsAppReport.ts'), 'utf8');
  const pageSrc = fs.readFileSync(path.join(ROOT, 'src/pages/ControleApoio.tsx'), 'utf8');

  assert.match(dataSrc, /equipamento\?:\s*string;/);
  assert.match(dataSrc, /equipamento:\s*clean\(row\.equipamento\)/);
  assert.match(dataSrc, /grupo_id\?:\s*string;/);
  assert.match(dataSrc, /grupo_fonte\?:\s*string;/);
  assert.match(dataSrc, /grupo_fonte:\s*clean\(row\.grupo_fonte\)/);

  assert.match(reportSrc, /resolveCustomEquipmentImage/);
  assert.match(reportSrc, /refreshEquipmentImageOverrides/);
  assert.match(reportSrc, /preloadEquipmentImages/);
  assert.match(reportSrc, /resolveEquipmentImage/);
  assert.match(reportSrc, /oficina-equipment-thumb/);
  assert.match(reportSrc, /col2\.append\(thumbBox\)[\s\S]*?entry\.modelo/);

  assert.match(whatsappSrc, /resolveCustomEquipmentImage/);
  assert.match(whatsappSrc, /refreshEquipmentImageOverrides/);
  assert.match(whatsappSrc, /preloadEquipmentImages/);
  assert.match(whatsappSrc, /whatsapp-equipment-thumb/);
  assert.match(whatsappSrc, /descRow\.append\(thumbBox,\s*narrative\)/);

  assert.match(pageSrc, /className=\{`apoio-image-preview-row[\s\S]*?<EquipmentThumbnail/);
});

