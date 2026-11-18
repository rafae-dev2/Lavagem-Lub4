from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright, expect
import json
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'tests/.tmp-maintenance-visual'
OUT=Path('/home/ubuntu/work/closed-v10.2-evidence');OUT.mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,url):
  file=url.split('?')[0].lstrip('/') or 'index.html'
  return str(ASSETS/file if (ASSETS/file).is_file() else ROOT/'public'/file)
 def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
checks=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for module in ['preventivas','lubrificacao','reformas']:
   page=browser.new_page(viewport={'width':390,'height':844})
   # O relógio do harness é fixo; alinhar Date de preferências ao mesmo instante.
   page.add_init_script("""{const NativeDate=Date;const stamp=NativeDate.parse('2026-11-08T12:00:00-03:00');window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[stamp]));}static now(){return stamp;}};}""")
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) or r.request.url.startswith('data:') else r.abort())
   page.goto(base+'/?module='+module,wait_until='networkidle')
   expect(page.locator('.mt-order')).to_have_count(24)
   page.locator('.mt-filters summary').click()
   checkbox=page.locator('.mt-filters input[type=checkbox]')
   if checkbox.count(): checkbox.first.check()
   page.locator('.mt-visibility-toggle').click()
   expect(page.locator('.mt-order')).to_have_count(8)
   expect(page.locator('.mt-closed-ribbon')).to_have_count(8)
   assert page.locator('.mt-status').all_text_contents() and all('Encerrado' in t for t in page.locator('.mt-status').all_text_contents())
   if checkbox.count(): assert not checkbox.first.is_checked()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   page.locator('.mt-filters summary').click()
   page.locator('.mt-order').first.scroll_into_view_if_needed()
   if module=='preventivas': page.locator('.mt-order').first.screenshot(path=str(OUT/'encerradas-celular-v10.2.png'))
   page.locator('.mt-visibility-toggle').click()
   expect(page.locator('.mt-order')).to_have_count(24)
   checks.append({'module':module,'arquivo':8,'retorno_operacao':24,'filtro_atraso_removido':True,'overflow':False})
   page.close()
  browser.close()
finally: server.shutdown();server.server_close()
(OUT/'closed-selection-validation.json').write_text(json.dumps({'dados':'sintéticos sem Supabase','checks':checks},ensure_ascii=False,indent=2)+'\n')
print('OK: Mostrar encerradas seleciona 8 fechadas, limpa atraso e retorna à operação nos 3 módulos; celular390px sem overflow.')
