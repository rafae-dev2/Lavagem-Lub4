from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'tests/.tmp-maintenance-visual'
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,url):
  file=url.split('?')[0].lstrip('/') or 'import-compat.html'
  return str((ASSETS/file) if (ASSETS/file).is_file() else ROOT/'public'/file)
 def log_message(self,*args):pass
(ASSETS/'import-compat.html').write_text('<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module" src="/import-compat.js"></script></body></html>')
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  page=b.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) else route.abort())
  page.goto(base,wait_until='networkidle');page.wait_for_function('typeof window.runImportCompatibility==="function"')
  result=page.evaluate('window.runImportCompatibility()')
  assert result['extraction'] and result['excelParser'];assert not errors,errors
  print('OK: PDF/worker '+result['pdf']+' e SheetJS '+result['xlsx']+' — extração e parsers originais compatíveis no Chromium, sem arquivos/rede de produção.')
  Path('/home/ubuntu/work/import-compat-evidence.json').write_text(json.dumps(result,indent=2)+'\n')
  b.close()
finally:server.shutdown();server.server_close()
