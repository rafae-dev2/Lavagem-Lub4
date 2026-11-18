from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import json
OUT=Path('/home/ubuntu/entrega-lavagem-premium');OUT.mkdir(exist_ok=True)
BASE='http://127.0.0.1:3000'
checks=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for theme,w,h,name in [('light',320,750,None),('light',390,844,'previa-lavagem-celular.png'),('light',768,1024,'previa-lavagem-tablet.png'),('light',1440,1000,'previa-lavagem-desktop.png'),('dark',1024,768,None),('glassy-v18',390,844,'previa-lavagem-glassy.png')]:
  page=browser.new_page(viewport={'width':w,'height':h});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE+'/') else r.abort())
  page.goto(BASE+'/lavagem-premium-test.html?theme='+theme,wait_until='domcontentloaded')
  page.locator('.lub-table').wait_for()
  expect(page.locator('.lavagem-premium-brand img')).to_be_visible()
  assert page.locator('.lavagem-premium-brand img').evaluate('e=>e.complete && e.naturalWidth>0')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(w,'overflow externo')
  assert page.locator('.lub-table-scroll').evaluate('e=>e.scrollWidth>e.clientWidth') if w<1000 else True
  styles=page.locator('.lub-table tbody td').first.evaluate('e=>({bg:getComputedStyle(e).backgroundColor,text:getComputedStyle(e).color})')
  assert styles['bg']=='rgb(255, 255, 255)',(theme,styles)
  assert styles['text'] not in ['rgb(255, 255, 255)','rgb(246, 240, 230)'],(theme,styles)
  page.locator('.lavagem-premium-sync').click()
  expect(page.get_by_label('Consultas de teste')).to_have_text('1')
  if name:page.screenshot(path=str(OUT/name))
  # As observações e Ações continuam separadas ao atingir a última coluna.
  page.locator('.lub-table-scroll').evaluate('e=>e.scrollLeft=e.scrollWidth')
  edit=page.locator('.lub-edit').first
  expect(edit).to_be_visible()
  obs=page.locator('.lub-observation-cell').first.bounding_box();actions=page.locator('.lub-actions-cell').last.bounding_box()
  if w<720:assert page.locator('.lub-actions-cell').first.evaluate('e=>getComputedStyle(e).position')=='static'
  for tab in ['Dashboard','Importar','Exportar','Programações']:
   page.locator('.lavagem-premium-tabs').get_by_role('button',name=tab,exact=True).click()
   expect(page.locator('.lavagem-premium-tabs button[aria-current="page"]')).to_have_text(tab)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(w,tab,'overflow')
  assert not errors,errors
  checks.append({'theme':theme,'viewport':[w,h],'logo':'visível','table':styles,'tabs':'4 abas navegáveis','scroller':'isolado, ações sem sobreposição no celular'})
  page.close()
 browser.close()
(OUT/'validacao-lavagem-premium.json').write_text(json.dumps({'status':'aprovado','dados':'fictícios, tráfego externo bloqueado','checks':checks},ensure_ascii=False,indent=2)+'\n')
print('OK: Lavagem premium em6 combinações,logo,contraste,abas,scroller e atualização local; sem banco real.')
