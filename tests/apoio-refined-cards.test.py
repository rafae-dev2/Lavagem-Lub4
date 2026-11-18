from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import json
ROOT=Path(__file__).resolve().parents[1];ASSETS=ROOT/'tests/.tmp-apoio-table';OUT=Path('/home/ubuntu/work/v10.7-evidence');OUT.mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,url):
  f=url.split('?')[0].lstrip('/') or 'index.html';return str(ASSETS/f if (ASSETS/f).is_file() else ROOT/'public'/f)
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}';checks=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for theme,width,sidebar in [('light',390,0),('light',1366,256),('light',1920,256),('dark',390,0),('glassy-v18',390,0)]:
   page=browser.new_page(viewport={'width':width,'height':1000});page.set_default_timeout(8000);errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.add_init_script("localStorage.setItem('bp-theme-default-version','light-v10.7')")
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) or r.request.url.startswith('data:') else r.abort())
   page.goto(base+'/?theme='+theme,wait_until='networkidle');page.evaluate('s=>{const m=document.querySelector("main");m.style.width=`${innerWidth-s}px`;m.style.marginLeft=`${s}px`;}',sidebar)
   expect(page.locator('.apoio-order')).to_have_count(3);card=page.locator('.apoio-order').first
   style=card.evaluate('e=>{const s=getComputedStyle(e);return {border:s.borderLeftWidth,shadow:s.boxShadow,before:getComputedStyle(e,"::before").display,bg:s.backgroundColor,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}}')
   assert style['border']==('2px' if card.locator('.apoio-forecast-badge').count() else '1px'),style
   assert style['width']<=360.5,style
   assert card.evaluate('e=>getComputedStyle(e).borderLeftColor')==('rgb(181, 75, 75)' if card.locator('.apoio-forecast-badge').count() else 'rgb(31, 107, 69)')
   assert style['before']=='none',style
   assert not style['shadow'].startswith('-'),style
   assert card.locator('.apoio-order-top>.apoio-days').count()==1
   assert card.locator('.apoio-card-badges .apoio-days').count()==0
   assert card.locator('.apoio-order-fields>div').count()==4
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(theme,width,'overflow')
   if theme=='light':
    card.scroll_into_view_if_needed();card.screenshot(path=str(OUT/f'cartao-apoio-refinado-{width}px-v10.7.png'))
    if width==1366:page.locator('.apoio-order-list').screenshot(path=str(OUT/'cartoes-apoio-refinados-computador-v10.7.png'))
   page.get_by_role('button',name='Mostrar encerradas',exact=False).click();expect(page.locator('.apoio-order-closed')).to_have_count(1)
   closed=page.locator('.apoio-order-closed');assert closed.evaluate('e=>getComputedStyle(e).borderLeftWidth')=='1px';assert closed.evaluate('e=>getComputedStyle(e).borderLeftColor')=='rgb(31, 107, 69)';assert closed.locator('.apoio-closed-seal').count()==1;assert closed.locator('.apoio-preview-late').count()==0
   assert page.evaluate('window.__apoioMock.writes.length')==0
   assert not errors,errors
   checks.append({'theme':theme,'width':width,'card':style,'dados':'mock local','bordas_sem_faixa_dourada':True,'encerradas_preservadas':True,'writes':0});print('OK cartões refinados',theme,width,flush=True);page.close()
  browser.close()
finally:server.shutdown();server.server_close()
(OUT/'validacao-cartoes-refinados.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n')
