from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import base64,subprocess,json
ROOT=Path(__file__).resolve().parents[1];ASSETS=ROOT/'tests/.tmp-equipment-upload';OUT=Path('/home/ubuntu/work/v10.11-evidence');OUT.mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,url):
  f=url.split('?')[0].lstrip('/') or 'index.html';return str(ASSETS/f if (ASSETS/f).is_file() else ROOT/'public'/f)
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}';proof={}
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=browser.new_page(viewport={'width':1440,'height':1100},accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   u=r.request.url
   if u.startswith(base) or u.startswith('blob:') or u.startswith('data:'):r.continue_();return
   if '/storage/v1/object/public/equipment-group-images/' in u:
    key=u.split('/equipment-group-images/')[1];data=page.evaluate('(key)=>globalThis.__equipmentUploadMock.objects[key]',key)
    if data:r.fulfill(status=200,body=base64.b64decode(data),headers={'Content-Type':'image/webp' if key.endswith('webp') else 'image/png','Access-Control-Allow-Origin':'*'});return
   r.abort()
  page.route('**/*',route);page.goto(base,wait_until='networkidle');expect(page.get_by_text('editor autorizado',exact=True)).to_be_visible();expect(page.locator('#custom-consumer img')).to_have_count(0)
  page.locator('#equipment-image-upload').set_input_files('/home/ubuntu/work/v10.11-images/cacamba-transparent.png') if page.locator('#equipment-image-upload').count() else page.locator('input[type=file]').set_input_files('/home/ubuntu/work/v10.11-images/cacamba-transparent.png')
  expect(page.get_by_role('button',name='Salvar ilustração',exact=True)).to_be_enabled(timeout=15000);page.get_by_role('button',name='Salvar ilustração',exact=True).click();expect(page.get_by_text('Ilustração de Grupo de teste sem imagem salva com sucesso.',exact=True)).to_be_visible(timeout=30000)
  expect(page.locator('#custom-consumer img')).to_have_count(1);page.wait_for_function('document.querySelector("#custom-consumer img").naturalWidth>0');state=page.evaluate('globalThis.__equipmentUploadMock');metadata=state['images'][0];assert metadata['bytes']<=180000;assert max(metadata['width'],metadata['height'])<=640;assert metadata['bytes']<Path('/home/ubuntu/work/v10.11-images/cacamba-transparent.png').stat().st_size;assert [o['kind'] for o in state['operations'][:2]]==['upload','metadata'];old=metadata['object_path'];proof.update(metadata)
  page.wait_for_timeout(300);page.screenshot(path=str(OUT/'cadastro-imagens-computador.png'),full_page=True)
  # Transparência do objeto WebP/PNG comprimido, não apenas imagem original.
  png=base64.b64decode(state['objects'][old]);file=OUT/('imagem-comprimida.'+old.split('.')[-1]);file.write_bytes(png)
  from PIL import Image
  image=Image.open(file).convert('RGBA');assert image.getchannel('A').getextrema()==(0,255)
  for label,name in [('PDF com imagem do grupo','grupo-personalizado.pdf'),('Excel com imagem do grupo','grupo-personalizado.xlsx')]:
   with page.expect_download(timeout=60000) as info:page.get_by_role('button',name=label,exact=True).click()
   saved=OUT/name;info.value.save_as(saved)
   if name.endswith('pdf'):
    text=subprocess.check_output(['pdftotext','-layout',str(saved),'-'],text=True);assert 'OSCUSTOM001' in text;listing=subprocess.check_output(['pdfimages','-list',str(saved)],text=True);assert len(listing.splitlines())>2
   else:
    import openpyxl
    wb=openpyxl.load_workbook(saved);assert len(wb['Equipamentos ilustrados']._images)==1;assert wb['Equipamentos ilustrados']['B2'].value=='999001'
  # Falha na metadata mantém a imagem anterior; novo objeto é removido.
  page.evaluate('globalThis.__equipmentUploadMock.failMetadata=true');page.locator('input[type=file]').set_input_files(str(ROOT/'public/equipment-types/trator.png'));expect(page.get_by_role('button',name='Salvar ilustração',exact=True)).to_be_enabled();page.get_by_role('button',name='Salvar ilustração',exact=True).click();expect(page.get_by_text('Não foi possível salvar a ilustração:',exact=False)).to_be_visible();state=page.evaluate('globalThis.__equipmentUploadMock');assert state['images'][0]['object_path']==old;assert list(state['objects'])==[old]
  page.evaluate('globalThis.__equipmentUploadMock.failMetadata=false');page.get_by_role('button',name='Salvar ilustração',exact=True).click();expect(page.get_by_text('Ilustração de Grupo de teste sem imagem salva com sucesso.',exact=True)).to_be_visible();state=page.evaluate('globalThis.__equipmentUploadMock');assert state['images'][0]['object_path']!=old;assert old not in state['objects'];assert len(state['objects'])==1
  page.set_viewport_size({'width':390,'height':1000});page.screenshot(path=str(OUT/'cadastro-imagens-celular.png'),full_page=True);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  page.on('dialog',lambda dialog:dialog.accept());page.get_by_role('button',name='Restaurar ilustração padrão',exact=True).click();expect(page.get_by_text('Ilustração padrão restaurada.',exact=True)).to_be_visible();assert page.evaluate('globalThis.__equipmentUploadMock.images.length')==0;assert page.evaluate('Object.keys(globalThis.__equipmentUploadMock.objects).length')==0;expect(page.locator('#custom-consumer img')).to_have_count(0);assert not errors,errors;browser.close()
finally:server.shutdown();server.server_close()
(OUT/'validacao-upload.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n');print('OK navegador: compressão/alpha reais, grupo personalizado em tela/PDF/Excel, rollback de metadata, troca/limpeza e restauração; sem gravação real.')
