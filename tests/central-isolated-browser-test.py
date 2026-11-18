from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
import subprocess,os
ROOT=Path(__file__).resolve().parents[1];ASSETS=ROOT/'tests/.tmp-central-visual'
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,url):
  f=url.split('?')[0].lstrip('/') or 'index.html';return str(ASSETS/f)
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start()
try:
 env=dict(os.environ,CENTRAL_TEST_BASE=f'http://127.0.0.1:{server.server_port}')
 print('Central isolada, somente fixtures locais.',flush=True)
 subprocess.run(['python3','-u','tests/central-browser-test.py'],cwd=ROOT,env=env,check=True)
finally:server.shutdown();server.server_close()
