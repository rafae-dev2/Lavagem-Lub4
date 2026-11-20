import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

test('vitrea theme is registered as an isolated dark theme without altering existing theme ordering', () => {
  const ctx = readFile('src/contexts/ThemeContext.tsx');
  assert.match(ctx, /'vitrea'/);
  assert.match(ctx, /key:\s*'vitrea',\s*label:\s*'Vitrea Glass'/);
  assert.match(ctx, /DARK_THEMES[\s\S]*'vitrea'/);
  assert.match(ctx, /'theme-vitrea'/);

  // Preserve original ordering of primary themes (verdan, liquid-glass-v18, dashboard-v32 before vitrea)
  const verdanIdx = ctx.indexOf("key: 'verdan'");
  const v18Idx = ctx.indexOf("key: 'liquid-glass-v18'");
  const v32Idx = ctx.indexOf("key: 'dashboard-v32'");
  const vitreaIdx = ctx.indexOf("key: 'vitrea'");
  assert.ok(verdanIdx > -1 && v18Idx > verdanIdx && v32Idx > v18Idx && vitreaIdx > v32Idx,
    'vitrea must appear after verdan, liquid-glass-v18, and dashboard-v32');
});

test('index.html, main.tsx, brandWatermarkConfig.ts, shell-theme.css, and sw.js wire Vitrea cleanly', () => {
  const html = readFile('index.html');
  assert.match(html, /Urbanist:wght@400;500;600;700/);
  assert.match(html, /vitrea:\s*1/);
  assert.match(html, /'theme-vitrea'/);
  assert.match(html, /active === 'vitrea' \? '#111113'/);

  const mainTsx = readFile('src/main.tsx');
  assert.match(mainTsx, /import\s+['"]\.\/styles\/vitrea\.css['"]/);

  const watermark = readFile('src/lib/brandWatermarkConfig.ts');
  assert.match(watermark, /vitrea:\s*0\.22/);
  assert.match(watermark, /vitrea:\s*\{[\s\S]*accentColor:\s*'#7aaef0'/);

  const shellTheme = readFile('src/styles/shell-theme.css');
  assert.match(shellTheme, /:not\(\.theme-vitrea\)/);

  const swJs = readFile('src/sw.js');
  assert.match(swJs, /CSS_CACHE_VERSION\s*=\s*'liquid-glass-v18-(?:[7-9]|[1-9]\d+)'/);
});

test('src/styles/vitrea.css faithfully defines Vitrea tokens, graphite wallpaper, conic glass rim, and strict scoping', () => {
  const css = readFile('src/styles/vitrea.css');

  // Core Vitrea tokens & typography
  assert.match(css, /^html\.theme-vitrea\s*\{/m);
  assert.match(css, /'Urbanist'/);
  assert.match(css, /#7aaef0/i);
  assert.match(css, /#071a33/i);
  assert.match(css, /#68c0b8/i);
  assert.match(css, /#8fdca8/i);
  assert.match(css, /#f3cd7e/i);
  assert.match(css, /#f6a59c/i);

  // Conic specular glass rim & graphite curved-orb SVG wallpaper
  assert.match(css, /conic-gradient\(\s*from 300deg/);
  assert.match(css, /mask:[^\n]*exclude/);
  assert.match(css, /-webkit-mask-composite:\s*xor/);
  assert.match(css, /data:image\/svg\+xml/);
  assert.match(css, /border-radius:\s*999px/);
  assert.match(css, /border-radius:\s*34px/);

  // Brand logo preservation + reduced transparency / motion accessibility
  assert.match(css, /filter:\s*none\s*!important/);
  assert.match(css, /prefers-reduced-transparency:\s*reduce/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);

  // Strict scoping check: every individual selector outside @-rules must start with html.theme-vitrea
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  let depth = 0;
  let inKeyframes = false;
  let keyframeDepth = -1;
  let buf = '';
  const badSelectors: string[] = [];

  while (i < stripped.length) {
    const ch = stripped[i];
    if (ch === '{') {
      const header = buf.trim();
      buf = '';
      if (header.startsWith('@keyframes')) {
        inKeyframes = true;
        keyframeDepth = depth;
      } else if (!header.startsWith('@') && !inKeyframes) {
        // Split top-level comma-separated selectors (respecting parentheses like :is(...))
        let pDepth = 0;
        let current = '';
        const parts: string[] = [];
        for (const c of header) {
          if (c === '(') pDepth += 1;
          else if (c === ')') pDepth -= 1;
          if (c === ',' && pDepth === 0) {
            parts.push(current.trim());
            current = '';
          } else {
            current += c;
          }
        }
        if (current.trim()) parts.push(current.trim());
        for (const sel of parts) {
          if (!/^html(?:\.dark)?\.theme-vitrea\b/.test(sel)) {
            badSelectors.push(sel);
          }
        }
      }
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      buf = '';
      if (inKeyframes && depth === keyframeDepth) {
        inKeyframes = false;
        keyframeDepth = -1;
      }
    } else if (ch === ';' && depth > 0 && !headerLike(buf)) {
      buf = '';
    } else {
      buf += ch;
    }
    i += 1;
  }

  assert.deepEqual(badSelectors, [], `Unscoped CSS selectors found in vitrea.css: ${badSelectors.join(' | ')}`);
});

function headerLike(text: string): boolean {
  return text.includes('@');
}

test('Layout, Programacoes, Dashboard, and CentralGerencial wire Vitrea accents and widgets', () => {
  const layout = readFile('src/components/Layout.tsx');
  assert.match(layout, /t\.key === "vitrea"/);

  const programacoes = readFile('src/pages/Programacoes.tsx');
  assert.match(programacoes, /const isVitrea = theme === 'vitrea'/);
  assert.match(programacoes, /isVitrea \? '#68c0b8'/);

  const dashboard = readFile('src/pages/Dashboard.tsx');
  assert.match(dashboard, /const isVitrea = theme === 'vitrea'/);
  assert.match(dashboard, /isVitrea \? '#7aaef0'/);

  const central = readFile('src/pages/CentralGerencial.tsx');
  assert.match(central, /const isVitrea = theme === 'vitrea'/);
});
