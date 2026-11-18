from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from functools import partial
from playwright.sync_api import sync_playwright,expect
import json

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'tests/.tmp-maintenance-visual'
OUT=Path('/home/ubuntu/work/maintenance-visual-evidence');OUT.mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,url):
  file=url.split('?')[0].lstrip('/') or 'index.html'
  return str((ASSETS/file) if (ASSETS/file).is_file() else ROOT/'public'/file)
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
checks=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for module in ['preventivas','lubrificacao','reformas','reformas-rodomuda','reformas-colhedoras','reformas-trator-transbordo','reformas-trator-reboque']:
   for theme in ['light','dark','glassy-v18']:
    for w,h,sidebar,col in [(320,750,0,1),(390,844,0,1),(768,1024,0,2),(1024,768,0,2),(1366,768,256,3),(1920,1080,256,4)]:
     page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
     errors=[];blocked=[]
     page.on('pageerror',lambda error:errors.append(str(error)))
     page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) or route.request.url.startswith('data:') else (blocked.append(route.request.url),route.abort())[1])
     page.goto(f'{base}/?module={module}&theme={theme}',wait_until='networkidle')
     page.evaluate('''sidebar=>{const m=document.querySelector('main');m.style.width=`${innerWidth-sidebar}px`;m.style.marginLeft=`${sidebar}px`;}''',sidebar)
     cards=page.locator('.mt-order');expect(cards).to_have_count(24)
     columns=page.locator('.mt-card-grid').evaluate('e=>getComputedStyle(e).gridTemplateColumns.split(" ").length')
     assert columns==col,(module,theme,w,columns,col)
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(module,theme,w,'overflow inicial',page.evaluate('''[...document.querySelectorAll('*')].map(e=>({tag:e.tagName,cls:e.className,x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(e=>e.right>innerWidth+1).slice(0,25)'''))
     assert page.locator('.mt-hero img').evaluate('e=>e.complete&&e.naturalWidth>0')
     assert cards.first.evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(255, 255, 255)',(module,theme,w,'card opaco')
     cards.first.get_by_role('button',name='Ver detalhes').click();expect(cards.first.locator('.mt-observations')).to_be_visible()
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(w,'overflow detalhes')
     assert not errors,(module,theme,w,errors)
     assert not [url for url in blocked if not url.startswith('https://fonts.googleapis.com/')],(module,theme,w,'tentativa de rede externa não tipográfica',blocked)
     if module=='preventivas' and theme=='light' and w in [390,1024,1920]:
      cards.first.get_by_role('button',name='Ocultar detalhes').click()
      page.evaluate('window.scrollTo(0,0)')
      page.screenshot(path=str(OUT/f'preventivas-{w}px.png'))
     checks.append({'module':module,'theme':theme,'viewport':[w,h],'sidebar':sidebar,'columns':columns,'cards':24,'overflow':False})
     page.close()
    print(f"Visual: {module} / {theme} — seis larguras aprovadas",flush=True)
  page=browser.new_page(viewport={'width':1200,'height':850})
  page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) or route.request.url.startswith('data:') else route.abort())
  page.goto(base+'/?module=preventivas',wait_until='networkidle')
  page.get_by_role('button',name='Encerrado',exact=False).filter(has=page.locator('b')).first.click()
  assert page.locator('.mt-order').count()==8
  assert page.locator('.mt-status').all_text_contents() and all('Encerrado' in text for text in page.locator('.mt-status').all_text_contents())
  page.get_by_role('button',name='Todas',exact=False).filter(has=page.locator('b')).first.click()
  page.get_by_role('button',name='Próxima página').click();expect(page.locator('.mt-order')).to_have_count(2)
  page.get_by_role('button',name='Página anterior').click();expect(page.locator('.mt-order')).to_have_count(24)
  page.locator('.mt-filters summary').click();page.get_by_placeholder('Frota, OS, equipamento ou serviço').fill('VISUAL-25');expect(page.locator('.mt-order')).to_have_count(1)
  page.get_by_role('button',name='Limpar filtros').click();expect(page.locator('.mt-order')).to_have_count(24)
  page.get_by_role('button',name='Visualizar em tabela').click();expect(page.locator('.mt-table')).to_be_visible()
  page.set_viewport_size({'width':320,'height':750});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  browser.close()
finally:server.shutdown();server.server_close()
(OUT/'validacao-visual.json').write_text(json.dumps({'status':'aprovado','dados':'sintéticos, sem rede externa ou escrita no banco','checks':checks,'interacoes':['encerradas por saída','paginação','busca','limpar','tabela móvel','detalhes']},ensure_ascii=False,indent=2)+'\n')
print(f'OK: {len(checks)} cenários visuais (7 módulos ×3 temas ×6 larguras),1/2/3/4 colunas,320–1920px,sidebar,logo,detalhes,sem overflow; filtros/paginação/busca/tabela funcionais.')
