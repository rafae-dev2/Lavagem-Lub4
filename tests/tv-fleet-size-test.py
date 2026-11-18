from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('/home/ubuntu/entrega-tv-cards-responsivos')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1920,'height':1080})
 page.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:3000/') else r.abort())
 page.add_init_script("localStorage.setItem('bp-tv-monitor-v1',JSON.stringify({pageSize:12,rotate:false,alternate:false}));")
 page.goto('http://127.0.0.1:3000/tv-test.html');page.wait_for_selector('.tv-order');page.evaluate('window.tvTestResponsive(35)')
 for w,h in [(390,844),(800,600),(1024,768),(1236,629),(1366,768),(1920,1080),(2560,1440)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(300)
  for present in [False,True]:
   active='tv-monitor--presenting' in page.locator('.tv-monitor').get_attribute('class')
   if active!=present:page.get_by_role('button',name='Sair da apresentação TV' if active else 'Apresentar na TV',exact=True).click()
   page.wait_for_timeout(250)
   assert page.locator('.tv-equipment > div:first-child strong').evaluate_all('(els)=>els.every(e=>e.scrollWidth<=e.clientWidth+1)'),(w,h,present)
   assert page.locator('.tv-order').evaluate_all('(els)=>els.every(e=>e.querySelector("footer").getBoundingClientRect().bottom<=e.getBoundingClientRect().bottom+1)'),(w,h,present)
   if (w,h,present)==(1236,629,True):
    page.get_by_role('button',name='Ativar modo claro premium',exact=True).click();page.wait_for_timeout(200);page.screenshot(path=str(OUT/'repro-1236x629-claro.png'));page.get_by_role('button',name='Ativar modo escuro premium',exact=True).click()
   if (w,h,present)==(1920,1080,True):page.screenshot(path=str(OUT/'TV1920x1080.png'))
 b.close()
print('OK: frotas de9 dígitos cabem no track em7 resoluções, normal/TV, rodapés preservados.')
