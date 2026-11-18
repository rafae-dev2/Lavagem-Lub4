import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'tests' / '.tmp-mobile-operations-v1011'
OUT = ROOT / 'tests' / '.tmp-mobile-operations-v1011'

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, url):
        file_name = url.split('?')[0].lstrip('/') or 'index.html'
        candidate = ASSETS / file_name
        return str(candidate if candidate.is_file() else ROOT / 'public' / file_name)
    def log_message(self, *_args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
checks = []

try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        for width in (390, 768, 955, 1024, 1440):
            page = browser.new_page(viewport={'width': width, 'height': 900})
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) or route.request.url.startswith('data:') else route.abort())
            page.goto(base, wait_until='networkidle')
            expect(page.locator('.apoio-operations-v1011')).to_be_visible()
            page.wait_for_selector('.apoio-shared-card-container .mt-order', timeout=10000)
            expect(page.locator('.apoio-shared-card-container .mt-order')).to_have_count(3)
            page.locator('.apoio-filter-center').evaluate('(node) => { node.open = true; }')
            expect(page.locator('#apoio-direct-search')).to_be_visible()

            metrics = page.evaluate('''() => {
              const root = document.querySelector('.apoio-operations-v1011');
              const toolbar = document.querySelector('.apoio-direct-toolbar');
              const search = document.querySelector('.apoio-direct-search-control');
              const multi = document.querySelector('.apoio-multiselect-grid');
              const tabs = document.querySelector('.mt-status-tabs');
              const cards = [...document.querySelectorAll('.apoio-shared-card-container .mt-order')];
              return {
                viewport: innerWidth,
                documentWidth: document.documentElement.scrollWidth,
                rootWidth: root?.getBoundingClientRect().width || 0,
                toolbarWidth: toolbar?.getBoundingClientRect().width || 0,
                searchWidth: search?.getBoundingClientRect().width || 0,
                filterDisplay: document.querySelector('.apoio-filter-center .mt-filter-body') && getComputedStyle(document.querySelector('.apoio-filter-center .mt-filter-body')).display,
                multiColumns: multi ? getComputedStyle(multi).gridTemplateColumns.split(' ').length : 0,
                multiHeight: multi?.getBoundingClientRect().height || 0,
                tabsDisplay: tabs ? getComputedStyle(tabs).display : '',
                tabHeight: tabs?.getBoundingClientRect().height || 0,
                cardHeights: cards.map(card => Math.round(card.getBoundingClientRect().height)),
                cardHeightStyles: cards.map(card => getComputedStyle(card).height),
              };
            }''')
            assert metrics['documentWidth'] <= width + 1, (width, 'overflow horizontal', metrics)
            assert metrics['rootWidth'] <= width + 1, (width, 'root width', metrics)
            assert metrics['toolbarWidth'] >= metrics['searchWidth'] > 0, (width, 'search width', metrics)
            assert metrics['filterDisplay'] == 'flex', (width, 'filter body became columns', metrics)
            assert metrics['multiHeight'] < 240, (width, 'multiselect group stretched', metrics)
            assert metrics['tabsDisplay'] == 'flex' and metrics['tabHeight'] < 150, (width, 'tabs stretched', metrics)
            assert all(height < 800 for height in metrics['cardHeights']), (width, 'card height', metrics)
            assert all(style not in ('100%', 'stretch') for style in metrics['cardHeightStyles']), (width, 'equal-height card style', metrics)
            expected_columns = 1 if width < 720 else 2 if width < 901 else 3
            assert metrics['multiColumns'] == expected_columns, (width, 'filter grid columns', metrics)
            assert not errors, (width, errors)
            checks.append(metrics)
            page.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()

(OUT / 'mobile-operations-v1011-validation.json').write_text(json.dumps({'checks': checks, 'data': 'mock local, no Supabase/network'}, ensure_ascii=False, indent=2) + '\n')
print('OK: Controle Apoio validado em 390/768/955/1024/1440 px; filtros em fluxo, busca full-width, tabs sem stretch, cards sem equal-height e sem overflow.')
