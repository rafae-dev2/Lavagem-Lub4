from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import json
ROOT=Path(__file__).resolve().parents[1];ASSETS=ROOT/'tests/.tmp-apoio-table';OUT=Path('/home/ubuntu/work/v10.3-evidence');OUT.mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,url):
  f=url.split('?')[0].lstrip('/') or 'index.html'
  return str(ASSETS/f if (ASSETS/f).is_file() else ROOT/'public'/f)
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}';checks=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for theme,w,h,sidebar in [('light',320,750,0),('light',390,844,0),('light',768,1024,0),('light',1366,900,256),('light',1920,1080,256),('dark',390,844,0),('glassy-v18',390,844,0)]:
   page=browser.new_page(viewport={'width':w,'height':h});errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) or r.request.url.startswith('data:') else r.abort())
   page.goto(base+'/?theme='+theme,wait_until='networkidle')
   page.evaluate('''s=>{const m=document.querySelector('main');m.style.width=`${innerWidth-s}px`;m.style.marginLeft=`${s}px`;}''',sidebar)
   expect(page.locator('.apoio-order')).to_have_count(3)
   search=page.get_by_role('textbox',name='Pesquisar frota, OS ou narrativa',exact=True);expect(search).to_be_visible()
   assert page.locator('.apoio-filter-center').evaluate('e=>!e.open')
   if w==1366 and theme=='light':
    page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(OUT/'apoio-cartoes-computador-v10.3.png'),full_page=True)
   for q in ['15115','159330468','confirmacao da peca']:
    search.fill(q);expect(page.locator('.apoio-order')).to_have_count(1)
   search.fill('15115')
   page.get_by_role('button',name='Tabela',exact=True).click();expect(page.locator('.apoio-table-row')).to_have_count(1)
   assert page.locator('.apoio-table-row').first.inner_text().find('159330468')>=0
   page.locator('.apoio-table-details-button').first.click();expect(page.locator('.apoio-table-details-button').first).to_have_attribute('aria-expanded','true')
   expect(page.get_by_text('Narrativa completa',exact=True)).to_be_visible()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(w,'overflow tabela')
   assert page.get_by_role('button',name='Tabela',exact=True).evaluate('e=>getComputedStyle(e).color')=='rgb(255, 255, 255)'
   assert page.locator('.apoio-orders-table').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(255, 255, 255)'
   search.fill('');expect(page.locator('.apoio-table-row')).to_have_count(3)
   page.get_by_role('button',name='Mostrar encerradas',exact=False).click();expect(page.locator('.apoio-table-row')).to_have_count(1)
   expect(page.locator('.apoio-table-row-closed')).to_have_count(1)
   assert page.locator('.apoio-table-late').count()==0
   page.get_by_role('button',name='Voltar às abertas',exact=True).click();expect(page.locator('.apoio-table-row')).to_have_count(3)
   if w in [390,1366] and theme=='light':
    page.locator('.apoio-table-scroll').evaluate('e=>e.scrollLeft=0');page.locator('.apoio-direct-toolbar').scroll_into_view_if_needed();page.screenshot(path=str(OUT/f'apoio-tabela-{w}px-v10.3.png'))
   assert page.evaluate('window.__apoioMock.writes.length')==0
   page.reload(wait_until='networkidle');expect(page.locator('.apoio-orders-table')).to_be_visible()
   assert not errors,(theme,w,errors)
   checks.append({'theme':theme,'width':w,'sidebar':sidebar,'table':True,'search_fleet_os_narrative':True,'closed':True,'overflow':False,'writes':0})
   page.close()
  browser.close()
finally:server.shutdown();server.server_close()
(OUT/'apoio-table-validation.json').write_text(json.dumps({'data':'mock local, sem Supabase','checks':checks},ensure_ascii=False,indent=2)+'\n')
print('OK: tabela Apoio em 7 combinações; busca frota/OS/narrativa sem acentos, detalhes, encerradas sem atraso, preferência e ausência de overflow; zero gravações.')
