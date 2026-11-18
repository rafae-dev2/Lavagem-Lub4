from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];ASSETS=ROOT/'tests/.tmp-menu-hierarchy';OUT=Path('/home/ubuntu/work/v10.7-evidence');OUT.mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,url):
  f=url.split('?')[0].lstrip('/') or 'index.html';return str(ASSETS/f if (ASSETS/f).is_file() else ROOT/'public'/f)
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for width in [1366,390]:
   page=browser.new_page(viewport={'width':width,'height':1000});errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort());page.goto(base,wait_until='networkidle')
   if width==390:page.get_by_role('button',name='Abrir menu',exact=True).click()
   expect(page.locator('.shell-nav-section')).to_have_count(7);labels=page.locator('.shell-nav-section').all_inner_texts()
   assert labels.index('Rotina de Frotas')==labels.index('Operação & Manutenção')+1,labels
   assert page.locator('.shell-nav-section').first.evaluate('e=>getComputedStyle(e).fontWeight')=='800'
   assert page.locator('.shell-nav-section').first.evaluate('e=>getComputedStyle(e).opacity')=='1'
   assert page.locator('.shell-nav-section.is-current-section').inner_text()=='Operação & Manutenção'
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   page.screenshot(path=str(OUT/f'menu-organizado-{width}px-v10.7.png'))
   if width==390:page.keyboard.press('Escape');expect(page.get_by_role('button',name='Abrir menu',exact=True)).to_have_attribute('aria-expanded','false')
   assert not errors,errors;page.close();print('OK menu',width,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
