import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  WCAG_AA_NORMAL,
  auditThemeSurfaceContrast,
  compositeOver,
  contrastRatio,
  meetsWcagAA,
  parseCssColor,
  relativeLuminance,
} from '../src/lib/wcagContrast';

const ROOT = path.resolve(import.meta.dirname, '..');

function extractCssBlock(source: string, selectorRegex: RegExp): string {
  const match = source.match(selectorRegex);
  assert.ok(match && match.index !== undefined, `Selector block not found for ${selectorRegex}`);
  const start = source.indexOf('{', match.index);
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, i);
    }
  }
  throw new Error(`Unclosed CSS block for ${selectorRegex}`);
}

function readToken(block: string, tokenName: string): string {
  const escaped = tokenName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`${escaped}\\s*:\\s*([^;]+);`));
  assert.ok(match, `Missing token ${tokenName}`);
  return match[1].replace(/\s*!important\s*$/i, '').trim();
}

function extractCardColorStop(rawBg: string): string {
  const cleaned = rawBg.trim();
  if (/^(#|rgba?\()/i.test(cleaned)) return cleaned;
  // For gradient glass surfaces, take the mid/end body color stop that text actually sits on
  const matches = [...cleaned.matchAll(/rgba?\([^)]+\)/gi)].map((m) => m[0]);
  assert.ok(matches.length >= 1, `Expected at least one rgba() stop in ${rawBg}`);
  return matches.length >= 2 ? matches[1] : matches[0];
}

test('WCAG 2.1 primitives parse hex/rgba, composite semitransparent backgrounds, and score luminance accurately', () => {
  const white = parseCssColor('#ffffff');
  const black = parseCssColor('#000000');
  assert.equal(relativeLuminance(white), 1);
  assert.equal(relativeLuminance(black), 0);
  assert.equal(contrastRatio('#ffffff', '#000000'), 21);
  assert.equal(contrastRatio('#e2e8f0', '#253347') >= WCAG_AA_NORMAL, true);
  assert.equal(meetsWcagAA(4.5), true);
  assert.equal(meetsWcagAA(4.49), false);
  assert.equal(meetsWcagAA(3.0, true), true);

  // Alpha compositing: translucent light tint over dark backdrop lightens effective background
  const blended = compositeOver(parseCssColor('rgba(255, 255, 255, 0.5)'), parseCssColor('#000000'));
  assert.equal(Math.round(blended.r), 128);
  assert.equal(Math.round(blended.g), 128);
  assert.equal(Math.round(blended.b), 128);
});

test('All themes defined in src/index.css meet WCAG AA (>= 4.5:1) for primary, secondary, tertiary, and muted text over --bg-card and composited --glass-card-bg', () => {
  const indexCss = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');

  const themes: Array<{ name: string; selector: RegExp }> = [
    { name: ':root (Industrial Dark)', selector: /:root\s*\{/ },
    { name: '.dark', selector: /\.dark\s*\{/ },
    { name: '.theme-ocean', selector: /\.theme-ocean\s*\{/ },
    { name: '.theme-sunset', selector: /\.theme-sunset\s*\{/ },
    { name: '.theme-forest', selector: /\.theme-forest\s*\{/ },
    { name: '.theme-midnight', selector: /\.theme-midnight\s*\{/ },
    { name: '.theme-copper', selector: /\.theme-copper\s*\{/ },
    { name: '.theme-light', selector: /\.theme-light,\s*\nhtml:not\(/ },
    { name: '.theme-rose', selector: /\.theme-rose\s*\{/ },
    { name: '.theme-arctic', selector: /\.theme-arctic\s*\{/ },
    { name: '.theme-lavender', selector: /\.theme-lavender\s*\{/ },
    { name: '.theme-glass', selector: /\.theme-glass\s*\{/ },
  ];

  for (const entry of themes) {
    const block = extractCssBlock(indexCss, entry.selector);
    const result = auditThemeSurfaceContrast({
      theme: entry.name,
      backdrop: readToken(block, '--bg-primary'),
      bgCard: readToken(block, '--bg-card'),
      glassCardStop: extractCardColorStop(readToken(block, '--glass-card-bg')),
      textPrimary: readToken(block, '--text-primary'),
      textSecondary: readToken(block, '--text-secondary'),
      textTertiary: readToken(block, '--text-tertiary'),
      textMuted: readToken(block, '--text-muted'),
    });

    assert.equal(
      result.allPassAA,
      true,
      `${entry.name} failed WCAG AA: ${JSON.stringify(result)}`,
    );
  }
});

test('Light themes provide dark-accessible --glass-button-hover-color instead of pastel lime/cyan/pink hover text', () => {
  const indexCss = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
  assert.match(indexCss, /color:\s*var\(--glass-button-hover-color,\s*var\(--brand-green\)\)/);

  for (const selector of [
    /\.theme-light,\s*\nhtml:not\(/,
    /\.theme-rose\s*\{/,
    /\.theme-arctic\s*\{/,
    /\.theme-lavender\s*\{/,
    /\.theme-glass\s*\{/,
  ]) {
    const block = extractCssBlock(indexCss, selector);
    const hoverColor = readToken(block, '--glass-button-hover-color');
    const bgCard = readToken(block, '--bg-card');
    const bgPrimary = readToken(block, '--bg-primary');
    assert.ok(
      contrastRatio(hoverColor, bgCard, bgPrimary) >= WCAG_AA_NORMAL,
      `Hover color ${hoverColor} failed AA contrast on ${bgCard}`,
    );
  }
});

test('Premium glass themes (glassy-v18, liquid-glass-v18, ios-liquid-glass, dashboard-v32, verdan, black-cyan) pass WCAG AA over composited card surfaces', () => {
  const specs = [
    {
      file: 'src/styles/glassy-v18.css',
      selector: /^html\.theme-glassy-v18\s*\{/m,
      worstCaseBackdrop: '#806f61',
      name: 'glassy-v18',
    },
    {
      file: 'src/styles/liquid-glass-v18.css',
      selector: /^html\.theme-liquid-glass-v18\s*\{/m,
      worstCaseBackdrop: '#182442',
      name: 'liquid-glass-v18',
    },
    {
      file: 'src/styles/ios-liquid-glass.css',
      selector: /^html\.theme-ios-liquid-glass\s*\{/m,
      worstCaseBackdrop: '#0b1220',
      name: 'ios-liquid-glass',
    },
    {
      file: 'src/styles/dashboard-v32.css',
      selector: /^html\.theme-dashboard-v32\s*\{/m,
      worstCaseBackdrop: '#0e0f11',
      name: 'dashboard-v32',
    },
    {
      file: 'src/styles/verdan-os.css',
      selector: /^html\.theme-verdan\s*\{/m,
      worstCaseBackdrop: '#0c1f13',
      name: 'verdan',
    },
    {
      file: 'src/styles/black-cyan-os.css',
      selector: /^html\.theme-black-cyan\s*\{/m,
      worstCaseBackdrop: '#000000',
      name: 'black-cyan',
    },
    {
      file: 'src/styles/vitrea.css',
      selector: /^html\.theme-vitrea\s*\{/m,
      worstCaseBackdrop: '#1d1d21',
      name: 'vitrea',
    },
  ];

  for (const spec of specs) {
    const css = fs.readFileSync(path.join(ROOT, spec.file), 'utf8');
    const block = extractCssBlock(css, spec.selector);
    const result = auditThemeSurfaceContrast({
      theme: spec.name,
      backdrop: spec.worstCaseBackdrop,
      bgCard: readToken(block, '--bg-card'),
      glassCardStop: extractCardColorStop(readToken(block, '--glass-card-bg')),
      textPrimary: readToken(block, '--text-primary'),
      textSecondary: readToken(block, '--text-secondary'),
      textTertiary: readToken(block, '--text-tertiary'),
      textMuted: readToken(block, '--text-muted'),
    });

    assert.equal(
      result.allPassAA,
      true,
      `${spec.name} failed WCAG AA: ${JSON.stringify(result)}`,
    );
  }
});

test('Apoio module surface tokens (--bg-card, --bg-hover, --text-secondary) pass WCAG AA in both light and dark modes', () => {
  const apoioCss = fs.readFileSync(path.join(ROOT, 'src/styles/apoio.css'), 'utf8');
  const lightBlock = extractCssBlock(apoioCss, /^\.apoio-module\s*\{/m);
  const darkBlock = extractCssBlock(apoioCss, /^html\.dark\s+\.apoio-module\s*\{/m);

  assert.ok(contrastRatio(readToken(lightBlock, '--apoio-muted'), '#ffffff') >= WCAG_AA_NORMAL);
  assert.ok(contrastRatio(readToken(lightBlock, '--apoio-muted'), readToken(lightBlock, '--apoio-soft')) >= WCAG_AA_NORMAL);
  assert.ok(contrastRatio(readToken(darkBlock, '--apoio-muted'), readToken(darkBlock, '--apoio-surface')) >= WCAG_AA_NORMAL);
  assert.ok(contrastRatio(readToken(darkBlock, '--apoio-muted'), readToken(darkBlock, '--apoio-soft')) >= WCAG_AA_NORMAL);
});
