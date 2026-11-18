from pathlib import Path
from playwright.sync_api import sync_playwright,expect
source=Path('src/App.tsx').read_text()
assert "window.location.hash === '#modo-tv-externas'" in source
assert 'case \'modo-tv-externas\':\n        return <ModoTV initialPanel="external" />;' in source
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1000})
 page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:3000/') else r.abort())
 page.goto('http://127.0.0.1:3000/tv-navigation-test.html#modo-tv-externas')
 expect(page.locator('.tv-monitor')).to_have_attribute('data-panel','external')
 expect(page.get_by_role('button',name='Modo TV — Ordens Externas',exact=True)).to_have_attribute('aria-current','page')
 page.get_by_role('button',name='Modo TV — Emergências',exact=True).click()
 expect(page.locator('.tv-monitor')).to_have_attribute('data-panel','emergency')
 page.get_by_role('button',name='Modo TV — Ordens Externas',exact=True).click()
 expect(page.locator('.tv-monitor')).to_have_attribute('data-panel','external')
 b.close()
print('OK: menus reais, navegação entre painéis, configuração de hash/case App; dados isolados e sem banco.')
