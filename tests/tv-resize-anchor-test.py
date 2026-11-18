import re
from playwright.sync_api import sync_playwright

def bounds(page):
 text=page.locator('.tv-page-controls').inner_text()
 m=re.search(r'(\d+)–(\d+) de (\d+) ordens',text)
 assert m,text
 return tuple(map(int,m.groups()))
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':800,'height':600})
 page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:3000/') else r.abort())
 page.add_init_script("localStorage.setItem('bp-tv-monitor-v1',JSON.stringify({pageSize:12,rotate:false,alternate:false}));")
 page.goto('http://127.0.0.1:3000/tv-test.html');page.wait_for_selector('.tv-order');page.evaluate('window.tvTestResponsive(35)')
 page.get_by_role('button',name='Apresentar na TV',exact=True).click();page.wait_for_timeout(350)
 for _ in range(7):page.get_by_role('button',name='Próxima página',exact=True).click()
 for w,h in [(1024,768),(1920,1080),(800,600)]:
  anchor=bounds(page)[0]
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(400)
  low,high,total=bounds(page)
  assert low<=anchor<=high,(anchor,low,high,w,h)
  assert total==35
 b.close()
print('OK: resize remapeia o primeiro índice sem salto indevido para a última página.')
