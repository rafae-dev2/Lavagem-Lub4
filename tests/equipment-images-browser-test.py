from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import subprocess,json,zipfile
ROOT=Path(__file__).resolve().parents[1];ASSETS=ROOT/'tests/.tmp-equipment-images';OUT=Path('/home/ubuntu/work/v10.10-evidence');OUT.mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,url):
  f=url.split('?')[0].lstrip('/') or 'index.html';return str(ASSETS/f if (ASSETS/f).is_file() else ROOT/'public'/f)
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}';proof=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=browser.new_page(viewport={'width':1440,'height':1100},accept_downloads=True);errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) or r.request.url.startswith('data:') or r.request.url.startswith('blob:') else r.abort());page.goto(base,wait_until='networkidle');expect(page.locator('.equipment-thumbnail img')).to_have_count(13)
  for w in [1440,768,390]:
   page.set_viewport_size({'width':w,'height':1100});page.locator('.equipment-thumbnail img').last.scroll_into_view_if_needed();page.wait_for_timeout(200);assert page.locator('.equipment-thumbnail img').evaluate_all('imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(OUT/f'equipamentos-{w}px.png'),full_page=w==1440)
  page.set_viewport_size({'width':1440,'height':1100})
  for label,name in [('PDF Acompanhamento','acompanhamento-ilustrado.pdf'),('PDF Apoio','apoio-ilustrado.pdf'),('PDF Central','central-ilustrada.pdf'),('Excel ilustrado','equipamentos-ilustrados.xlsx'),('PNG Apoio','apoio-png-ilustrado'),('PNG Lavagem','lavagem-ilustrada.png')]:
   with page.expect_download(timeout=120000) as info:page.get_by_role('button',name=label,exact=True).click()
   download=info.value;filename=name if '.' in name else name+Path(download.suggested_filename).suffix;file=OUT/filename;download.save_as(file);expect(page.locator('[role=alert]')).to_have_text('');assert file.stat().st_size>0
   if file.suffix=='.pdf':
    txt=subprocess.check_output(['pdftotext','-layout',str(file),'-'],text=True);assert all(f'OSIMAGEM{i}' in txt for i in range(13)),label
    listing=subprocess.check_output(['pdfimages','-list',str(file)],text=True);images=[line for line in listing.splitlines()[2:] if line.strip()];assert len(images)>=13,(label,len(images));proof.append({'arquivo':filename,'imagens':len(images),'ordens':13})
   elif file.suffix=='.xlsx':
    import openpyxl
    wb=openpyxl.load_workbook(file);assert len(wb['Equipamentos ilustrados']._images)==13;assert wb['Ordens'].max_row==14;proof.append({'arquivo':filename,'imagens':13,'ordens':13})
   elif file.suffix=='.zip':
    with zipfile.ZipFile(file) as z:assert z.testzip() is None;assert any(n.endswith('.png') for n in z.namelist());proof.append({'arquivo':filename,'png':len(z.namelist())})
   print('OK arquivo',filename,flush=True)
  assert not errors,errors;browser.close()
finally:server.shutdown();server.server_close()
(OUT/'validacao-imagens.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n');print('OK 13 tipos nas telas responsivas, imagens PDF reais, Excel com mídia e exportação PNG; sem rede externa.')
