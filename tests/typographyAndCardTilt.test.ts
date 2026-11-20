import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateCardTilt,
  DEFAULT_CARD_TILT_OPTIONS,
  NEUTRAL_CARD_TILT,
  shouldSuppressTiltTarget,
} from '../src/lib/cardTilt';

const ROOT = path.resolve(import.meta.dirname, '..');

test('calculateCardTilt returns neutral values at the center of a card', () => {
  const rect = { left: 100, top: 200, width: 300, height: 180 };
  const result = calculateCardTilt(250, 290, rect);
  assert.equal(result.rotateX, 0);
  assert.equal(result.rotateY, 0);
  assert.equal(result.glareX, 50);
  assert.equal(result.glareY, 50);
  assert.equal(result.scale, DEFAULT_CARD_TILT_OPTIONS.scale);
  assert.equal(result.translateY, DEFAULT_CARD_TILT_OPTIONS.translateY);
  assert.ok(result.glareOpacity > 0 && result.glareOpacity < DEFAULT_CARD_TILT_OPTIONS.glareMaxOpacity);
});

test('calculateCardTilt produces physically accurate tilt signs and glare positions at edges', () => {
  const rect = { left: 0, top: 0, width: 200, height: 100 };

  // Top-left corner: pressing top pushes top back (+rotateX), pressing left pushes left back (-rotateY)
  const topLeft = calculateCardTilt(0, 0, rect, { maxTiltDeg: 6, scale: 1.02, glareMaxOpacity: 0.2 });
  assert.equal(topLeft.rotateX, 6);
  assert.equal(topLeft.rotateY, -6);
  assert.equal(topLeft.glareX, 0);
  assert.equal(topLeft.glareY, 0);
  assert.equal(topLeft.glareOpacity, 0.2);

  // Bottom-right corner: negative rotateX, positive rotateY
  const bottomRight = calculateCardTilt(200, 100, rect, { maxTiltDeg: 6, scale: 1.02, glareMaxOpacity: 0.2 });
  assert.equal(bottomRight.rotateX, -6);
  assert.equal(bottomRight.rotateY, 6);
  assert.equal(bottomRight.glareX, 100);
  assert.equal(bottomRight.glareY, 100);
  assert.equal(bottomRight.glareOpacity, 0.2);
});

test('calculateCardTilt safely guards zero/negative rects, non-finite inputs, and out-of-bounds clamping', () => {
  assert.deepEqual(calculateCardTilt(50, 50, { left: 0, top: 0, width: 0, height: 100 }), NEUTRAL_CARD_TILT);
  assert.deepEqual(calculateCardTilt(50, 50, { left: 0, top: 0, width: 100, height: -10 }), NEUTRAL_CARD_TILT);
  assert.deepEqual(calculateCardTilt(Number.NaN, 50, { left: 0, top: 0, width: 100, height: 100 }), NEUTRAL_CARD_TILT);

  const clamped = calculateCardTilt(9999, -500, { left: 10, top: 10, width: 200, height: 120 }, { maxTiltDeg: 5 });
  assert.equal(clamped.rotateX, 5);
  assert.equal(clamped.rotateY, 5);
  assert.equal(clamped.glareX, 100);
  assert.equal(clamped.glareY, 0);
});

test('shouldSuppressTiltTarget suppresses interactive form inputs while allowing card surfaces', () => {
  for (const tag of ['SELECT', 'select', 'OPTION', 'INPUT', 'input', 'TEXTAREA']) {
    assert.equal(shouldSuppressTiltTarget(tag), true);
  }
  for (const tag of ['DIV', 'ARTICLE', 'BUTTON', 'SPAN', null, undefined]) {
    assert.equal(shouldSuppressTiltTarget(tag), false);
  }
});

test('premium typography hierarchy loads Plus Jakarta Sans for display headings and Inter for dense body copy', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const indexCss = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
  const v18Css = fs.readFileSync(path.join(ROOT, 'src/styles/liquid-glass-v18.css'), 'utf8');
  const v32Css = fs.readFileSync(path.join(ROOT, 'src/styles/dashboard-v32.css'), 'utf8');
  const tvCss = fs.readFileSync(path.join(ROOT, 'src/styles/tv-monitor.css'), 'utf8');
  const apoioCss = fs.readFileSync(path.join(ROOT, 'src/styles/apoio.css'), 'utf8');
  const biCss = fs.readFileSync(path.join(ROOT, 'src/styles/central-gerencial.css'), 'utf8');
  const lubCss = fs.readFileSync(path.join(ROOT, 'src/styles/lubrificacao.css'), 'utf8');

  assert.match(html, /Plus\+Jakarta\+Sans/);
  assert.match(html, /Inter:wght@/);

  assert.match(indexCss, /--font-display:\s*'Plus Jakarta Sans'/);
  assert.match(indexCss, /--font-family:\s*'Inter'/);
  assert.match(indexCss, /font-feature-settings:\s*"cv02",\s*"cv03",\s*"cv04",\s*"cv11"/);
  assert.match(indexCss, /font-variant-numeric:\s*tabular-nums/);

  assert.match(v18Css, /--font-family:\s*'Inter'/);
  assert.match(v32Css, /--font-family:\s*'Inter'/);
  assert.match(tvCss, /\.tv-topbar h2[\s\S]*?'Plus Jakarta Sans'/);
  assert.match(apoioCss, /Plus Jakarta Sans/);
  assert.match(biCss, /Plus Jakarta Sans/);
  assert.match(lubCss, /Plus Jakarta Sans/);
});

test('3D tilt CSS and React equipment cards are wired safely without breaking backdrop-filter or reduced-motion', () => {
  const mainTsx = fs.readFileSync(path.join(ROOT, 'src/main.tsx'), 'utf8');
  const tiltCss = fs.readFileSync(path.join(ROOT, 'src/styles/card-tilt.css'), 'utf8');

  assert.match(mainTsx, /import ['"]\.\/styles\/card-tilt\.css['"];/);
  assert.match(tiltCss, /\.tilt-card\.is-tilting/);
  assert.match(tiltCss, /perspective\(920px\)\s+rotateX\(var\(--tilt-rx/);
  assert.match(tiltCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(tiltCss, /transform-style:\s*preserve-3d/i);

  const componentFiles = [
    'src/pages/Dashboard.tsx',
    'src/components/AlertasEquipamentos.tsx',
    'src/components/MaintenanceOrderCard.tsx',
    'src/components/LubricationScheduleTable.tsx',
    'src/components/TurnoKanban.tsx',
    'src/pages/ControleApoio.tsx',
    'src/components/ApoioGroupFleetFilter.tsx',
  ];

  for (const relPath of componentFiles) {
    const content = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    assert.match(content, /getCardTiltProps/, `${relPath} must use getCardTiltProps`);
    assert.match(content, /tilt-card/, `${relPath} must apply tilt-card class`);
  }
});
