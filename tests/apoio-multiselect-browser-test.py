from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];ASSETS=ROOT/'tests/.tmp-apoio-table';OUT=Path('/home/ubuntu/work/v10.7-evidence');OUT.mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,url):
  f=url.split('?')[0].lstrip('/') or 'index.html';return str(ASSETS/f if (ASSETS/f).is_file() else ROOT/'public'/f)
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for width,sidebar in [(1366,256),(390,0)]:
   page=browser.new_page(viewport={'width':width,'height':1000});page.set_default_timeout(8000);errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) or r.request.url.startswith('data:') else r.abort());page.goto(base+'/?theme=light',wait_until='networkidle');page.evaluate('s=>{const m=document.querySelector("main");m.style.width=`${innerWidth-s}px`;m.style.marginLeft=`${s}px`;}',sidebar)
   expect(page.locator('.apoio-order')).to_have_count(3)
   page.get_by_role('button',name='Tabela',exact=True).click();expect(page.locator('.apoio-table-row')).to_have_count(3)
   assert page.locator('.apoio-table-row-forecast-late').count()==1
   if width==1366:page.locator('.apoio-table-scroll').screenshot(path=str(OUT/'apoio-tabela-premium-v10.7.png'))
   page.get_by_role('button',name='Cartões',exact=True).click();page.locator('.apoio-filter-center>summary').click()
   page.get_by_role('button',name='Filtrar Status operacional',exact=True).click();dialog=page.get_by_role('dialog',name='Opções de Status operacional')
   assert dialog.locator('label').filter(has_text='Andamento').locator('small').inner_text()=='1'
   dialog.get_by_role('checkbox',name='Programada',exact=False).check();dialog.get_by_role('checkbox',name='Andamento',exact=False).check();page.keyboard.press('Escape');expect(page.locator('.apoio-order')).to_have_count(2)
   page.get_by_role('button',name='Remover Programada de Status operacional',exact=True).click();expect(page.locator('.apoio-order')).to_have_count(1)
   page.get_by_role('button',name='Remover Andamento de Status operacional',exact=True).click();expect(page.locator('.apoio-order')).to_have_count(3)
   page.get_by_role('button',name='Filtrar Origem',exact=True).click();dialog=page.get_by_role('dialog',name='Opções de Origem');dialog.get_by_role('checkbox',name='Oficina Externa',exact=False).check();dialog.get_by_role('checkbox',name='Oficina Interna',exact=False).check();page.keyboard.press('Escape');expect(page.locator('.apoio-order')).to_have_count(2)
   page.get_by_role('button',name='Remover Oficina Externa de Origem',exact=True).click();expect(page.locator('.apoio-order')).to_have_count(1)
   page.get_by_role('button',name='Remover Oficina Interna de Origem',exact=True).click();expect(page.locator('.apoio-order')).to_have_count(3)
   page.get_by_role('button',name='Filtrar Prestador externo',exact=True).click();dialog=page.get_by_role('dialog',name='Opções de Prestador externo');dialog.get_by_role('textbox',name='Pesquisar opções de Prestador externo').fill('sao joao');dialog.get_by_role('button',name='Selecionar visíveis',exact=False).click();page.keyboard.press('Escape');expect(page.locator('.apoio-order')).to_have_count(1)
   page.get_by_role('button',name='Limpar filtros',exact=True).first.click();expect(page.locator('.apoio-order')).to_have_count(3)
   page.get_by_role('button',name='Filtrar Origem',exact=True).click();dialog=page.get_by_role('dialog',name='Opções de Origem');rect=dialog.bounding_box();assert rect and rect['x']>=0 and rect['x']+rect['width']<=width+1,(width,rect)
   if width==1366:dialog.screenshot(path=str(OUT/'apoio-filtros-multisselecao-v10.7.png'))
   dialog.get_by_role('textbox',name='Pesquisar opções de Origem').fill('nenhuma-opcao-xyz');expect(dialog.get_by_text('Nenhuma opção encontrada.',exact=True)).to_be_visible();assert dialog.get_by_role('button',name='Selecionar visíveis',exact=False).is_disabled();page.keyboard.press('Escape')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,'overflow')
   assert page.evaluate('window.__apoioMock.writes.length')==0;assert not errors,errors;page.close();print('OK Apoio filtros múltiplos/tabela',width,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
