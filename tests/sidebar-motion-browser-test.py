from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import json,subprocess
ROOT=Path(__file__).resolve().parents[1];ASSETS=ROOT/'tests/.tmp-menu-hierarchy';OUT=Path('/home/ubuntu/work/v10.9-evidence');OUT.mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,url):
  f=url.split('?')[0].lstrip('/') or 'index.html';return str(ASSETS/f if (ASSETS/f).is_file() else ROOT/'public'/f)
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}';results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':1440,'height':900},record_video_dir=str(OUT/'raw'),record_video_size={'width':1440,'height':900});page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort());page.goto(base,wait_until='networkidle');page.mouse.move(700,450);page.wait_for_timeout(450)
  aside=page.locator('aside');panel=page.locator('.shell-sidebar__panel');main=page.locator('main');rail=aside.bounding_box()['width'];assert rail<=90,rail;left=main.bounding_box()['x'];page.screenshot(path=str(OUT/'menu-recolhido-v10.9.png'))
  button=aside.get_by_role('button',name='Reformas — Equipamentos Apoio',exact=True);button.hover();page.wait_for_timeout(550);assert panel.bounding_box()['width']>=250;assert abs(main.bounding_box()['x']-left)<1;popup=page.get_by_label('Atalhos de Controle de Reformas',exact=True);expect(popup).to_be_visible();assert popup.bounding_box()['x']>=panel.bounding_box()['x']+panel.bounding_box()['width'];page.screenshot(path=str(OUT/'menu-expandido-v10.9.png'))
  popup.get_by_role('button',name='Reforma — Colhedoras',exact=True).hover();page.wait_for_timeout(350);popup.get_by_role('button',name='Reforma — Colhedoras',exact=True).click();assert page.evaluate('window.__menuNavigated')=='reformas-colhedoras'
  page.mouse.move(900,450);page.wait_for_timeout(550);assert panel.bounding_box()['width']<=90;button.focus();page.wait_for_timeout(350);assert panel.bounding_box()['width']>=250;expect(popup).to_be_visible();page.keyboard.press('Escape');page.wait_for_timeout(250);expect(popup).not_to_be_visible()
  page.mouse.move(600,300);page.wait_for_timeout(400);aside.get_by_role('button',name='Central Gerencial',exact=True).hover();page.wait_for_timeout(500);page.mouse.move(800,400);page.wait_for_timeout(500);assert not errors,errors;video=page.video;ctx.close();raw=video.path();subprocess.run(['ffmpeg','-v','error','-y','-i',raw,'-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'demonstracao-barra-lateral-v10.9.mp4')],check=True);results.append({'modo':'desktop','rail':rail,'mainLeft':left,'erroJS':errors})
  for mode in ['touch','reduced']:
   context=browser.new_context(viewport={'width':390 if mode=='touch' else 1366,'height':900},has_touch=mode=='touch',is_mobile=mode=='touch',reduced_motion='reduce' if mode=='reduced' else 'no-preference');pg=context.new_page();pg.route('**/*',lambda r:r.continue_() if r.request.url.startswith(base) else r.abort());pg.goto(base,wait_until='networkidle')
   if mode=='touch':
    pg.get_by_role('button',name='Abrir menu',exact=True).click();expect(pg.locator('aside').get_by_role('button',name='Central Gerencial',exact=True)).to_be_visible();pg.screenshot(path=str(OUT/'menu-celular-v10.9.png'));pg.keyboard.press('Escape');expect(pg.get_by_role('button',name='Abrir menu',exact=True)).to_have_attribute('aria-expanded','false')
   else:
    pg.locator('aside').get_by_role('button',name='Central Gerencial',exact=True).focus();pg.wait_for_timeout(50);assert max(float(t.strip().removesuffix('s')) for t in pg.locator('.shell-sidebar__panel').evaluate('e=>getComputedStyle(e).transitionDuration').split(','))<0.02
   assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1');results.append({'modo':mode,'ok':True});context.close()
  browser.close()
finally:server.shutdown();server.server_close()
(OUT/'validacao-barra.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n');print('OK: trilho/expansão sem reflow, atalhos navegáveis, foco/Escape, touch e movimento reduzido.')
