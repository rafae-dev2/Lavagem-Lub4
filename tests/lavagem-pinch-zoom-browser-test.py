import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'tests' / '.tmp-lavagem-pinch-zoom'
OUT = ASSETS


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, url):
        file_name = url.split('?')[0].lstrip('/') or 'index.html'
        candidate = ASSETS / file_name
        return str(candidate if candidate.is_file() else ROOT / 'public' / file_name)

    def log_message(self, *_args):
        pass


def touch_point(x, y, point_id):
    return {
        'x': round(x),
        'y': round(y),
        'id': point_id,
        'radiusX': 8,
        'radiusY': 8,
        'force': 0.7,
    }


def raw_pinch(cdp, x, y, start_separation=72, end_separation=180, steps=16):
    cdp.send('Input.dispatchTouchEvent', {
        'type': 'touchStart',
        'touchPoints': [
            touch_point(x - start_separation / 2, y, 1),
            touch_point(x + start_separation / 2, y, 2),
        ],
    })
    for step in range(1, steps + 1):
        separation = start_separation + (end_separation - start_separation) * step / steps
        cdp.send('Input.dispatchTouchEvent', {
            'type': 'touchMove',
            'touchPoints': [
                touch_point(x - separation / 2, y, 1),
                touch_point(x + separation / 2, y, 2),
            ],
        })
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})


def touch_swipe(cdp, x1, y1, x2, y2, steps=14):
    cdp.send('Input.dispatchTouchEvent', {
        'type': 'touchStart',
        'touchPoints': [touch_point(x1, y1, 3)],
    })
    for step in range(1, steps + 1):
        fraction = step / steps
        cdp.send('Input.dispatchTouchEvent', {
            'type': 'touchMove',
            'touchPoints': [
                touch_point(x1 + (x2 - x1) * fraction, y1 + (y2 - y1) * fraction, 3),
            ],
        })
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})


def table_point(page):
    return page.evaluate('''() => {
      const rect = document.querySelector('.lub-table-scroll').getBoundingClientRect();
      const y = Math.min(innerHeight - 60, Math.max(rect.top + 48, rect.top + Math.min(rect.height / 3, 220)));
      return {
        x: Math.round(rect.left + Math.min(150, Math.max(90, rect.width / 2))),
        y: Math.round(y),
      };
    }''')


def metrics(page):
    return page.evaluate('''() => {
      const scroller = document.querySelector('.lub-table-scroll');
      const table = document.querySelector('.lub-table');
      const rect = scroller.getBoundingClientRect();
      const cs = getComputedStyle(scroller);
      let stylesheetTouchAction = '';
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            if (rule.selectorText?.includes('.lub-operations-v1011 .lub-table-scroll') && rule.style?.touchAction) {
              stylesheetTouchAction = rule.style.touchAction;
            }
          }
        } catch (_) {
          // Ignore cross-origin sheets; the fixture's local application CSS is same-origin.
        }
      }
      return {
        viewport: { width: innerWidth, height: innerHeight },
        metaViewport: document.querySelector('meta[name="viewport"]')?.content || '',
        touchAction: cs.touchAction,
        stylesheetTouchAction,
        scale: Number((visualViewport?.scale || 1).toFixed(4)),
        visualViewport: {
          width: visualViewport?.width || null,
          height: visualViewport?.height || null,
          offsetLeft: visualViewport?.offsetLeft || 0,
          offsetTop: visualViewport?.offsetTop || 0,
        },
        documentWidth: document.documentElement.scrollWidth,
        tableWidth: Math.round(table.getBoundingClientRect().width),
        scrollerWidth: Math.round(rect.width),
        scrollWidth: scroller.scrollWidth,
        clientWidth: scroller.clientWidth,
        scrollLeft: scroller.scrollLeft,
        scrollTop: scroller.scrollTop,
        windowScrollY: window.scrollY,
        point: { x: Math.round(rect.left + 90), y: Math.round(rect.top + 90) },
      };
    }''')


server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
checks = []

try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path='/usr/bin/chromium',
            headless=True,
            args=['--no-sandbox'],
        )
        for width, height, orientation in ((390, 844, 'portrait'), (844, 390, 'landscape')):
            context = browser.new_context(
                viewport={'width': width, 'height': height},
                is_mobile=True,
                has_touch=True,
            )
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(f'pageerror: {error}'))
            page.on(
                'console',
                lambda message: errors.append(f'console.error: {message.text}')
                if message.type == 'error' and 'Failed to load resource' not in message.text
                else None,
            )
            page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
            page.goto(base, wait_until='networkidle')
            expect(page.locator('.lub-table-scroll')).to_be_visible()
            expect(page.locator('.lub-table tbody tr')).to_have_count(70)
            assert page.locator('meta[name="viewport"]').get_attribute('content') == 'width=device-width,initial-scale=1'

            # Parent may already have changed the application CSS. Force a higher-specificity
            # pan-only baseline so the control case is deterministic and does not edit app files.
            baseline_style = page.add_style_tag(content='''
              html body .lub-operations-v1011 .lub-table-scroll {
                touch-action: pan-x pan-y !important;
              }
            ''',)
            baseline = metrics(page)
            assert 'pan-x' in baseline['touchAction'] and 'pan-y' in baseline['touchAction'], (orientation, baseline)
            assert 'pinch-zoom' not in baseline['touchAction'], (orientation, baseline)
            assert baseline['scale'] <= 1.01, (orientation, 'baseline scale', baseline)
            assert baseline['tableWidth'] > baseline['scrollerWidth'], (orientation, 'horizontal overflow', baseline)
            assert baseline['documentWidth'] <= width + 1, (orientation, 'document overflow', baseline)

            cdp = context.new_cdp_session(page)
            point = table_point(page)
            raw_pinch(cdp, point['x'], point['y'])
            page.wait_for_timeout(300)
            blocked_pinch = metrics(page)
            assert blocked_pinch['scale'] <= 1.01, (orientation, 'pan-only pinch unexpectedly zoomed', blocked_pinch)

            # Remove only the test baseline style. The computed style now comes from the
            # application CSS (expected to include pan-x pan-y pinch-zoom after the fix).
            baseline_style.evaluate('(node) => node.remove()')
            enabled = metrics(page)
            assert 'pinch-zoom' in enabled['stylesheetTouchAction'], (orientation, 'pinch-zoom missing in app CSS', enabled)
            # Chromium serializes the equivalent pan-x/pan-y/pinch-zoom tuple as
            # `manipulation` in getComputedStyle; keep both computed and raw evidence.
            assert 'pinch-zoom' in enabled['touchAction'] or enabled['touchAction'] == 'manipulation', (
                orientation,
                'pinch-zoom missing in computed style',
                enabled,
            )
            assert (
                ('pan-x' in enabled['touchAction'] and 'pan-y' in enabled['touchAction'])
                or enabled['touchAction'] == 'manipulation'
            ), (orientation, enabled)
            assert enabled['scale'] <= 1.01, (orientation, 'scale changed before enabled gesture', enabled)

            # Horizontal table scrolling is checked with pinch-zoom enabled but
            # before zooming, while the table region is the visible touch target.
            page.evaluate('''() => {
              window.scrollTo(0, 0);
              const scroller = document.querySelector('.lub-table-scroll');
              scroller.scrollTop = 0;
              scroller.scrollLeft = 0;
            }''')
            point = table_point(page)
            before_horizontal = metrics(page)
            touch_swipe(cdp, point['x'], point['y'], point['x'] - 260, point['y'])
            page.wait_for_timeout(250)
            after_horizontal = metrics(page)
            assert after_horizontal['scrollLeft'] > before_horizontal['scrollLeft'], (
                orientation,
                'horizontal table gesture did not move',
                before_horizontal,
                after_horizontal,
            )

            page.evaluate('''() => document.querySelector('.lub-table-scroll').scrollLeft = 0''')
            raw_pinch(cdp, point['x'], point['y'])
            page.wait_for_timeout(400)
            zoomed = metrics(page)
            assert zoomed['scale'] > 1.0, (orientation, 'raw CDP pinch did not zoom', zoomed)

            # Check one-finger vertical panning still works after zoom.
            page.evaluate('''() => {
              window.scrollTo(0, 0);
              const scroller = document.querySelector('.lub-table-scroll');
              scroller.scrollTop = 0;
              scroller.scrollLeft = 0;
            }''')
            point = table_point(page)
            before_vertical = metrics(page)
            touch_swipe(cdp, point['x'], point['y'], point['x'], point['y'] - 260)
            page.wait_for_timeout(250)
            after_vertical = metrics(page)
            visual_viewport_vertical_delta = (
                after_vertical['visualViewport']['offsetTop']
                - before_vertical['visualViewport']['offsetTop']
            )
            vertical_delta = max(
                after_vertical['windowScrollY'] - before_vertical['windowScrollY'],
                after_vertical['scrollTop'] - before_vertical['scrollTop'],
                visual_viewport_vertical_delta,
            )
            assert vertical_delta > 0, (orientation, 'vertical gesture did not move', before_vertical, after_vertical)
            assert not errors, (orientation, errors)

            checks.append({
                'orientation': orientation,
                'viewport': {'width': width, 'height': height, 'isMobile': True, 'hasTouch': True},
                'baselinePanOnly': {
                    'touchAction': baseline['touchAction'],
                    'stylesheetTouchAction': baseline['stylesheetTouchAction'],
                    'scale': baseline['scale'],
                },
                'blockedPinch': {
                    'touchAction': blocked_pinch['touchAction'],
                    'stylesheetTouchAction': blocked_pinch['stylesheetTouchAction'],
                    'scale': blocked_pinch['scale'],
                },
                'enabledPinch': {
                    'touchAction': enabled['touchAction'],
                    'stylesheetTouchAction': enabled['stylesheetTouchAction'],
                    'scaleBefore': enabled['scale'],
                    'scaleAfter': zoomed['scale'],
                },
                'scroll': {
                    'verticalDelta': vertical_delta,
                    'visualViewportVerticalDelta': visual_viewport_vertical_delta,
                    'horizontalBefore': before_horizontal['scrollLeft'],
                    'horizontalAfter': after_horizontal['scrollLeft'],
                },
                'errors': errors,
            })
            context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()

(OUT / 'lavagem-pinch-zoom-validation.json').write_text(
    json.dumps({'data': 'mock local, no Supabase/network', 'checks': checks}, ensure_ascii=False, indent=2) + '\n'
)
print(json.dumps(checks, ensure_ascii=False, indent=2))
print('OK: CDP raw two-finger pinch validated in 390x844 portrait and 844x390 landscape, with pan-only scale 1, pinch-zoom scale > 1, vertical/horizontal scroll, and no JS errors.')
