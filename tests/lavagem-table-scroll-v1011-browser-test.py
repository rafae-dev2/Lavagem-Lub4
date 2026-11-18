import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'tests' / '.tmp-lavagem-table-scroll-v1011'
OUT = ROOT / 'tests' / '.tmp-lavagem-table-scroll-v1011'

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, url):
        file_name = url.split('?')[0].lstrip('/') or 'index.html'
        candidate = ASSETS / file_name
        return str(candidate if candidate.is_file() else ROOT / 'public' / file_name)
    def log_message(self, *_args):
        pass

def touch_swipe(cdp, x1, y1, x2, y2, steps=12):
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x1, 'y': y1, 'radiusX': 8, 'radiusY': 8}]})
    for step in range(1, steps + 1):
        fraction = step / steps
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x1 + (x2 - x1) * fraction, 'y': y1 + (y2 - y1) * fraction, 'radiusX': 8, 'radiusY': 8}]})
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
results = []

try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        for width in (390, 768, 1366):
            context = browser.new_context(viewport={'width': width, 'height': 900}, is_mobile=True, has_touch=True)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
            page.goto(base, wait_until='networkidle')
            expect(page.locator('.lub-table-scroll')).to_be_visible()
            page.locator('.lub-table-scroll').scroll_into_view_if_needed()
            metrics = page.evaluate('''() => {
              const scroller = document.querySelector('.lub-table-scroll');
              const table = document.querySelector('.lub-table');
              const rect = scroller.getBoundingClientRect();
              const cs = getComputedStyle(scroller);
              return { width: innerWidth, documentWidth: document.documentElement.scrollWidth,
                tableWidth: table.getBoundingClientRect().width, scrollerWidth: rect.width,
                scrollWidth: scroller.scrollWidth, clientWidth: scroller.clientWidth,
                overflowY: cs.overflowY, touchAction: cs.touchAction,
                x: Math.round(rect.left + Math.min(90, rect.width / 2)),
                y: Math.round(rect.top + Math.min(260, Math.max(80, rect.height / 3))) };
            }''')
            assert metrics['documentWidth'] <= width + 1, (width, 'document overflow', metrics)
            if width < 900:
                assert metrics['tableWidth'] > metrics['scrollerWidth'], (width, 'missing horizontal overflow', metrics)
            else:
                assert metrics['tableWidth'] <= metrics['scrollerWidth'] + 1, (width, 'desktop horizontal overflow', metrics)
            assert metrics['overflowY'] in ('auto', 'scroll'), (width, 'vertical overflow blocked', metrics)
            assert 'pan-y' in metrics['touchAction'], (width, 'touch pan-y blocked', metrics)
            cdp = context.new_cdp_session(page)
            page.evaluate('window.scrollTo(0, 0)')
            before_y = page.evaluate('window.scrollY')
            touch_swipe(cdp, metrics['x'], metrics['y'], metrics['x'], metrics['y'] - 360)
            page.wait_for_timeout(250)
            after_y = page.evaluate('window.scrollY')
            assert after_y > before_y, (width, 'vertical page scroll did not move', before_y, after_y, metrics)

            after_x = 0
            if width < 900:
                page.evaluate('''() => { const s = document.querySelector('.lub-table-scroll'); s.scrollLeft = 0; window.scrollTo(0, 0); }''')
                horizontal_y = page.locator('.lub-table-scroll').bounding_box()['y'] + 260
                touch_swipe(cdp, metrics['x'], horizontal_y, metrics['x'] - 260, horizontal_y)
                page.wait_for_timeout(250)
                after_x = page.evaluate('document.querySelector(".lub-table-scroll").scrollLeft')
                assert after_x > 0, (width, 'horizontal table scroll did not move', after_x, metrics)
            results.append({'viewport': width, 'beforeY': before_y, 'afterY': after_y, 'afterX': after_x, 'touchAction': metrics['touchAction'], 'overflowY': metrics['overflowY']})
            assert not errors, (width, errors)
            context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()

(OUT / 'lavagem-table-scroll-v1011-validation.json').write_text(json.dumps({'checks': results, 'data': 'mock local, no Supabase/network'}, ensure_ascii=False, indent=2) + '\n')
print('OK: gestos CDP verticais e horizontais validados em 390/768/1366 px: página move no eixo Y e tabela no eixo X.')
