from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];assets=root/'tests/.tmp-lavagem-table-mobile';out=Path('/home/ubuntu/work/v10.11-evidence')
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,path):
  f=path.split('?')[0].lstrip('/') or 'index.html';return str(assets/f if (assets/f).is_file() else root/'public'/f)
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}'
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page(viewport={'width':390,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url) else r.abort());page.goto(url,wait_until='networkidle');expect(page.locator('thead')).to_be_visible();assert page.evaluate('getComputedStyle(document.querySelector("table")).display')=='table';assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');assert page.locator('.lub-table-scroll').evaluate('(e)=>e.scrollWidth>e.clientWidth');page.screenshot(path=str(out/'lavagem-tabela-celular.png'),full_page=True);page.get_by_role('button',name='Cartões',exact=True).click();expect(page.locator('.lub-schedule-cards')).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');page.screenshot(path=str(out/'lavagem-cartoes-celular.png'),full_page=True);assert not errors,errors;browser.close()
finally:server.shutdown();server.server_close()
print('OK Lavagem real: tabela/cabeçalho/rolagem horizontal em390px, alternância para cartões compactos, sem overflow da página.')
