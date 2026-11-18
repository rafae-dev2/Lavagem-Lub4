from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import json
ROOT=Path(__file__).resolve().parents[1];ASSETS=ROOT/'tests/.tmp-apoio-reformas-layout';OUT=Path('/home/ubuntu/work/v10.8-evidence');OUT.mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,url):
  f=url.split('?')[0].lstrip('/') or 'index.html';return str(ASSETS/f if (ASSETS/f).is_file() else ROOT/'public'/f)
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}';results=[]
measure='''e=>{const s=getComputedStyle(e);const r=e.getBoundingClientRect();return {width:r.width,height:r.height,font:s.fontFamily,bg:s.backgroundColor,border:s.borderTopColor,left:s.borderLeftColor,leftWidth:s.borderLeftWidth,radius:s.borderRadius,shadow:s.boxShadow,headerPadding:getComputedStyle(e.querySelector('.mt-order-head')).padding,quadrantsFont:getComputedStyle(e.querySelector('.mt-quadrant dd')).fontSize}}'''
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for width in [2240,1366,1024,390]:
   context=browser.new_context(viewport={'width':width,'height':1080},locale='pt-BR',timezone_id='America/Sao_Paulo');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) or r.request.url.startswith('data:') else r.abort());page.goto(base,wait_until='networkidle');expect(page.locator('.mt-order')).to_have_count(4)
   assert page.locator('.mt-kpis>.mt-kpi').count()==4
   own=page.locator('.mt-order').first.evaluate(measure)
   margin=page.evaluate('(()=>{const m=document.querySelector("main").getBoundingClientRect();const h=document.querySelector(".mt-hero").getBoundingClientRect();return h.left-m.left})()');assert margin>=15,(width,margin)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
   page.screenshot(path=str(OUT/f'apoio-padrao-reformas-{width}px.png'))
   page.locator('.apoio-filter-center>summary').click();page.get_by_role('textbox',name='Pesquisar frota, OS ou narrativa').fill('159330468');expect(page.locator('.mt-order')).to_have_count(1);page.get_by_role('button',name='Limpar busca',exact=True).click();expect(page.locator('.mt-order')).to_have_count(4);page.locator('.apoio-filter-center>summary').click()
   page.locator('.mt-order').first.get_by_role('button',name='Ver detalhes',exact=True).click();expect(page.get_by_label('Apoio da frota 15101')).to_be_visible();page.locator('.mt-order').first.get_by_role('button',name='Ocultar detalhes',exact=True).click()
   page.get_by_role('button',name='Tabela',exact=True).click();expect(page.locator('.apoio-table-row')).to_have_count(4);page.get_by_role('button',name='Cartões',exact=True).click()
   page.locator('.apoio-filter-center>summary').click();page.get_by_role('combobox',name='Período de recência',exact=False).select_option('1h');page.locator('.apoio-filter-center>summary').click();page.get_by_role('button',name='Mostrar encerradas',exact=True).click();expect(page.locator('.mt-order--closed')).to_have_count(1);assert page.locator('.mt-order--closed.mt-order--late').count()==0;page.get_by_role('button',name='Voltar às abertas',exact=True).click();expect(page.locator('.mt-order')).to_have_count(4)
   switcher=page.get_by_role('group',name='Seções do Controle Apoio');expect(switcher).to_be_visible();assert page.locator('.apoio-extra-tools').evaluate('e=>!e.open');switcher.get_by_role('button',name='Grupos Apoio e nossas frotas',exact=True).click();expect(page.get_by_role('heading',name='Criar ou editar grupo Apoio',exact=True)).to_be_visible();expect(page.get_by_role('button',name='Criar grupo',exact=True)).to_be_visible();assert page.locator('.apoio-extra-tools').evaluate('e=>!e.open');page.get_by_role('button',name='Ordens e relatórios',exact=True).click();expect(page.locator('.mt-order')).to_have_count(4)
   page.get_by_role('button',name='Encerrado',exact=False).click();expect(page.locator('.mt-order--closed')).to_have_count(1);page.get_by_role('button',name='Todas',exact=False).click();expect(page.locator('.mt-order')).to_have_count(4);assert page.locator('.mt-order--closed').count()==0;assert page.evaluate('window.__apoioMock.writes.length')==0;assert not errors,errors
   page.goto(base+'/?reference=1',wait_until='networkidle');expect(page.locator('.mt-order')).to_have_count(4);reference=page.locator('.mt-order').first.evaluate(measure)
   for key in own:
    if key in ['width','height']:assert abs(own[key]-reference[key])<=1,(width,key,own[key],reference[key])
    else:assert own[key]==reference[key],(width,key,own[key],reference[key])
   results.append({'viewport':width,'margem_hero':margin,'apoio':own,'reformas':reference,'escritas':0});context.close();print('OK Apoio/Reformas iguais + recursos',width,flush=True)
  browser.close()
finally:server.shutdown();server.server_close()
(OUT/'comparacao-apoio-reformas.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
