import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'tests' / '.tmp-lavagem-full-table'
OUT = ROOT / 'tests' / 'lavagem-full-table-validation.json'

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, url):
        file_name = url.split('?', 1)[0].lstrip('/') or 'index.html'
        candidate = ASSETS / file_name
        return str(candidate if candidate.is_file() else ROOT / 'public' / file_name)
    def log_message(self, *_args):
        pass

def touch_swipe(cdp, x1, y1, x2, y2, steps=14):
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x1, 'y': y1, 'id': 1, 'radiusX': 8, 'radiusY': 8, 'force': 0.7}]})
    for step in range(1, steps + 1):
        fraction = step / steps
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x1 + (x2 - x1) * fraction, 'y': y1 + (y2 - y1) * fraction, 'id': 1, 'radiusX': 8, 'radiusY': 8, 'force': 0.7}]})
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})

def metrics(page):
    return page.evaluate('''() => {
      const scroll = document.querySelector('.lub-table-scroll');
      const table = document.querySelector('.lub-table');
      const thead = table?.tHead;
      const tbody = table?.tBodies[0];
      const row = tbody?.rows[0];
      const cells = row ? [...row.cells] : [];
      const scrollerRect = scroll?.getBoundingClientRect();
      const rowYs = cells.map(cell => Math.round(cell.getBoundingClientRect().y * 10) / 10);
      const pseudo = cells.map(cell => getComputedStyle(cell, '::before').content);
      const tableStyle = getComputedStyle(table);
      const theadStyle = getComputedStyle(thead);
      const tbodyStyle = getComputedStyle(tbody);
      const rowStyle = getComputedStyle(row);
      const cellStyle = getComputedStyle(cells[0]);
      const actions = [...document.querySelectorAll('.lub-actions-cell')];
      const actionCell = actions[actions.length - 1];
      return {
        viewport: { width: innerWidth, height: innerHeight },
        rows: tbody?.rows.length || 0,
        tableDisplay: tableStyle.display,
        theadDisplay: theadStyle.display,
        tbodyDisplay: tbodyStyle.display,
        rowDisplay: rowStyle.display,
        cellDisplay: cellStyle.display,
        pseudoContents: pseudo,
        tableBorderStyle: tableStyle.borderStyle,
        rowBorderStyle: rowStyle.borderStyle,
        tbodyGridTemplateColumns: tbodyStyle.gridTemplateColumns,
        rowGridTemplateColumns: rowStyle.gridTemplateColumns,
        cellPadding: cellStyle.padding,
        rowYs,
        sameRowY: rowYs.length > 0 && Math.max(...rowYs) - Math.min(...rowYs) <= 1,
        scroll: {
          overflowX: getComputedStyle(scroll).overflowX,
          overflowY: getComputedStyle(scroll).overflowY,
          touchAction: getComputedStyle(scroll).touchAction,
          clientWidth: scroll.clientWidth,
          scrollWidth: scroll.scrollWidth,
          scrollLeft: scroll.scrollLeft,
          width: Math.round(scrollerRect.width),
        },
        tableWidth: Math.round(table.getBoundingClientRect().width),
        actionVisibleAtRight: Boolean(actionCell && actionCell.getBoundingClientRect().right <= scroll.getBoundingClientRect().right + 2),
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        windowScrollY: window.scrollY,
      };
    }''')

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
results = []
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        cases = ((390, 844, 'portrait'), (428, 926, 'portrait'), (844, 390, 'landscape'), (1366, 900, 'desktop'))
        for width, height, orientation in cases:
            for theme in ('light', 'dark'):
                context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=width < 900, has_touch=width < 900)
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(f'pageerror: {error}'))
                page.on('console', lambda message: errors.append(f'console.error: {message.text}') if message.type == 'error' and 'Failed to load resource' not in message.text else None)
                suffix = f'?theme={theme}'
                page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())

                page.goto(base + '/baseline.html' + suffix, wait_until='networkidle')
                expect(page.locator('.lavagem-premium .lub-module.lub-operations-v1011 .lub-table')).to_be_visible()
                expect(page.locator('.lub-table tbody tr')).to_have_count(70)
                before = metrics(page)
                if width < 720:
                    assert before['tableDisplay'] == 'block', (width, theme, 'baseline table', before)
                    assert before['theadDisplay'] == 'block', (width, theme, 'baseline thead', before)
                    assert before['tbodyDisplay'] in ('block', 'grid'), (width, theme, 'baseline tbody', before)
                    assert before['tbodyDisplay'] != 'table-row-group', (width, theme, 'baseline tbody unexpectedly real table', before)
                    assert before['rowDisplay'] == 'grid', (width, theme, 'baseline row', before)
                    assert before['cellDisplay'] == 'grid', (width, theme, 'baseline cell', before)
                    assert any(value not in ('none', 'normal') for value in before['pseudoContents']), (width, theme, 'baseline labels', before)

                page.goto(base + '/index.html' + suffix, wait_until='networkidle')
                expect(page.locator('.lavagem-premium .lub-module.lub-operations-v1011 .lub-table')).to_be_visible()
                expect(page.locator('.lub-table tbody tr')).to_have_count(70)
                after = metrics(page)
                assert after['rows'] == 70, (width, theme, 'row count', after)
                assert after['tableDisplay'] == 'table', (width, theme, 'table display', after)
                assert after['theadDisplay'] == 'table-header-group', (width, theme, 'thead display', after)
                assert after['tbodyDisplay'] == 'table-row-group', (width, theme, 'tbody display', after)
                assert after['rowDisplay'] == 'table-row', (width, theme, 'row display', after)
                assert after['cellDisplay'] == 'table-cell', (width, theme, 'cell display', after)
                assert all(value in ('none', 'normal') for value in after['pseudoContents']), (width, theme, 'data-label pseudo', after)
                assert after['tableBorderStyle'] == 'none', (width, theme, 'table card border', after)
                assert after['rowBorderStyle'] == 'none', (width, theme, 'row card border', after)
                assert after['tbodyGridTemplateColumns'] == 'none', (width, theme, 'tbody grid', after)
                assert after['rowGridTemplateColumns'] == 'none', (width, theme, 'row grid', after)
                assert after['sameRowY'], (width, theme, 'cells not aligned on same row Y', after)
                assert after['documentWidth'] <= width + 1, (width, theme, 'page horizontal overflow', after)
                assert 'auto' in after['scroll']['overflowX'], (width, theme, 'horizontal scroller', after)
                assert (('pan-x' in after['scroll']['touchAction'] and 'pan-y' in after['scroll']['touchAction']) or after['scroll']['touchAction'] == 'manipulation'), (width, theme, 'touch pan', after)
                if width < 720:
                    assert after['cellPadding'] not in ('8px 9px', '8px 7px'), (width, theme, 'legacy card padding', after)
                    assert after['tableWidth'] > after['scroll']['width'], (width, theme, 'mobile horizontal overflow missing', after)
                elif width < 1000:
                    assert after['tableWidth'] > after['scroll']['width'], (width, theme, 'landscape horizontal overflow missing', after)
                else:
                    assert after['tableWidth'] <= after['scroll']['width'] + 1, (width, theme, 'desktop should not need page overflow', after)

                page.evaluate('''() => { const s = document.querySelector('.lub-table-scroll'); s.scrollLeft = 0; window.scrollTo(0, 0); }''')
                scroll_before = metrics(page)
                scroll_box = page.locator('.lub-table-scroll').bounding_box()
                x = scroll_box['x'] + min(130, max(70, scroll_box['width'] / 2))
                y = min(height - 35, scroll_box['y'] + 100)
                cdp = context.new_cdp_session(page)
                scroll_after = metrics(page)
                if scroll_before['scroll']['scrollWidth'] > scroll_before['scroll']['clientWidth'] + 1:
                    touch_swipe(cdp, x, y, x - 300, y)
                    page.wait_for_timeout(180)
                    scroll_after = metrics(page)
                    assert scroll_after['scroll']['scrollLeft'] > scroll_before['scroll']['scrollLeft'], (width, theme, 'horizontal gesture', scroll_before, scroll_after)
                else:
                    scroll_after = scroll_before
                page.evaluate('''() => { const s = document.querySelector('.lub-table-scroll'); s.scrollLeft = s.scrollWidth; }''')
                actions_right = page.evaluate('''() => {
                  const s = document.querySelector('.lub-table-scroll');
                  const cells = [...document.querySelectorAll('.lub-table tbody .lub-actions-cell')];
                  const last = cells[cells.length - 1];
                  const r = last.getBoundingClientRect();
                  const sr = s.getBoundingClientRect();
                  return { actionText: last.textContent.trim(), left: r.left, right: r.right, scrollerRight: sr.right, visible: r.left >= sr.left - 2 && r.right <= sr.right + 2 };
                }''')
                assert actions_right['visible'] and 'Editar' in actions_right['actionText'], (width, theme, 'Ações inaccessible', actions_right)

                page.evaluate('window.scrollTo(0, 0)')
                vertical_before = page.evaluate('window.scrollY')
                page.evaluate('''() => {
                  const hero = document.querySelector('.lavagem-premium-hero');
                  hero?.scrollIntoView({block: 'start'});
                  window.scrollTo(0, 0);
                }''')
                hero_box = page.locator('.lavagem-premium-hero').bounding_box()
                touch_swipe(cdp, min(width - 20, max(20, hero_box['x'] + 40)), min(height - 30, hero_box['y'] + 80), min(width - 20, max(20, hero_box['x'] + 40)), min(height - 30, hero_box['y'] - 250))
                page.wait_for_timeout(180)
                vertical_after = page.evaluate('window.scrollY')
                assert vertical_after > vertical_before, (width, theme, 'vertical page gesture', vertical_before, vertical_after, after)
                assert not errors, (width, theme, errors)
                results.append({'viewport': {'width': width, 'height': height, 'orientation': orientation, 'theme': theme}, 'before': before, 'after': after, 'horizontal': {'before': scroll_before['scroll']['scrollLeft'], 'after': scroll_after['scroll']['scrollLeft'], 'actions': actions_right}, 'vertical': {'before': vertical_before, 'after': vertical_after}, 'errors': errors})
                context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()

OUT.write_text(json.dumps({'data': 'mock local, no Supabase/network; before = local legacy selector fixture; after = current full application CSS', 'checks': results}, ensure_ascii=False, indent=2) + '\n')
print(f'OK: full table validated before/after in {len(results)} viewport-theme cases; metrics at {OUT}')
