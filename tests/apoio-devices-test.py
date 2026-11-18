from pathlib import Path
import ast,json
from playwright.sync_api import sync_playwright,expect
source=Path('tests/apoio-premium-ui-test.py');tree=ast.parse(source.read_text());parts=[]
for n in tree.body:
 if isinstance(n,(ast.Import,ast.ImportFrom,ast.FunctionDef)):parts.append(n)
 elif isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id in {'OUT','BASE','MOCK'} for t in n.targets):parts.append(n)
ns={};exec(compile(ast.Module(body=parts,type_ignores=[]),str(source),'exec'),ns)
OUT=Path('/home/ubuntu/entrega-apoio-desktop-tablet');OUT.mkdir(exist_ok=True)
checks=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for w,h,sidebar,expected,name in [(320,750,0,1,None),(390,844,0,1,'previa-apoio-celular.png'),(768,1024,0,1,'previa-apoio-tablet-retrato.png'),(1024,768,0,2,'previa-apoio-tablet-paisagem.png'),(1366,768,256,2,None),(1920,1080,256,3,'previa-apoio-desktop.png')]:
  page,errors=ns['open_page'](b,'light',w,h)
  # Largura real de um main ao lado da sidebar do app; não altera o viewport.
  page.evaluate('''sidebar=>{const m=document.querySelector('main');m.style.padding='0';m.style.width=`${innerWidth-sidebar}px`;m.style.marginLeft=`${sidebar}px`;}''',sidebar)
  page.wait_for_timeout(200)
  logo=page.locator('.apoio-logo');expect(logo).to_be_visible()
  assert logo.evaluate('e=>e.complete && e.naturalWidth>0'),'Logo não carregou'
  columns=page.locator('.apoio-order-list').evaluate("e=>getComputedStyle(e).gridTemplateColumns.split(' ').length")
  assert columns==expected,(w,sidebar,columns)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(w,'overflow')
  metrics=page.locator('.apoio-order').evaluate_all('''els=>els.map(e=>{const r=e.getBoundingClientRect();return {width:r.width,inside:[...e.querySelectorAll('.apoio-fleet-title,.apoio-card-bottom,select,.apoio-details-button')].every(x=>{const a=x.getBoundingClientRect();return a.left>=r.left-1 && a.right<=r.right+1 && a.bottom<=r.bottom+1})}})''')
  assert all(m['inside'] for m in metrics),(w,metrics)
  page.locator('.apoio-order').first.locator('.apoio-details-button').click()
  expect(page.locator('.apoio-order').first.locator('.apoio-observations')).to_be_visible()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  if name:
   page.locator('.apoio-order').first.locator('.apoio-details-button').click()
   page.evaluate('window.scrollTo(0,0)')
   page.screenshot(path=str(OUT/name))
  # Redimensionar o mesmo documento confirma transição dinâmica de1 para2 colunas.
  page.set_viewport_size({'width':1000,'height':850})
  page.evaluate("const m=document.querySelector('main');m.style.width='100%';m.style.marginLeft='0'")
  page.wait_for_timeout(100)
  assert page.locator('.apoio-order-list').evaluate("e=>getComputedStyle(e).gridTemplateColumns.split(' ').length")==2
  assert not errors,errors
  checks.append({'viewport':[w,h],'sidebar':sidebar,'columns':columns,'logo':'carregado e visível','cards':metrics,'resize':'aprovado'})
  page.close()
 b.close()
(OUT/'validacao-dispositivos.json').write_text(json.dumps({'status':'aprovado','dados':'mockados, sem escrita no Supabase','checks':checks},ensure_ascii=False,indent=2)+'\n')
print('OK: logo visível,1/2/3 colunas por espaço útil,320–1920px, tablet nas duas orientações, sidebar, resize, detalhes e nenhum overflow.')
