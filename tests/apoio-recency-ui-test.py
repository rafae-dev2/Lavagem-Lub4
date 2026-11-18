from pathlib import Path
import ast,json
from playwright.sync_api import sync_playwright,expect
source=Path('tests/apoio-premium-ui-test.py');tree=ast.parse(source.read_text());parts=[]
for n in tree.body:
 if isinstance(n,(ast.Import,ast.ImportFrom,ast.FunctionDef)):parts.append(n)
 elif isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id in {'OUT','BASE','MOCK'} for t in n.targets):parts.append(n)
ns={};exec(compile(ast.Module(body=parts,type_ignores=[]),str(source),'exec'),ns)
BASE=ns['BASE']
mock=ns['MOCK'].replace("const groups=",r'''orders[0].entrada=new Date(Date.now()-2*3600000).toISOString();
orders[0].primeira_vista=new Date(Date.now()-30*60000).toISOString();
orders[1].entrada=new Date(Date.now()-60*60000).toISOString();
orders[1].primeira_vista=new Date(Date.now()-3*3600000).toISOString();
orders[2].entrada='';
orders[2].primeira_vista=new Date(Date.now()-10*60000).toISOString();
const groups=''')
OUT=Path('/home/ubuntu/entrega-apoio-ordens-recentes');OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1000});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE+'/') else r.abort())
 page.route('**/src/lib/apoioService.ts*',lambda r:r.fulfill(status=200,content_type='application/javascript',body=mock))
 page.goto(BASE+'/apoio-premium-test.html?theme=light')
 page.locator('.apoio-order').first.wait_for()
 page.locator('.apoio-filter-center > summary').click()
 page.get_by_role('button',name='Recentes · Programadas e andamento',exact=True).click()
 expect(page.locator('.apoio-order')).to_have_count(2)
 expect(page.locator('.apoio-order').first.locator('.apoio-fleet-title')).to_have_text('FROTA 15115')
 page.get_by_role('button',name='Recentes · Programadas',exact=True).click()
 expect(page.locator('.apoio-order')).to_have_count(1)
 expect(page.locator('.apoio-order').first.locator('.apoio-fleet-title')).to_have_text('FROTA 15101')
 page.get_by_label('Período de recência').select_option('1h')
 expect(page.locator('.apoio-order')).to_have_count(0)
 page.get_by_label('Data de referência').select_option('primeira_vista')
 expect(page.locator('.apoio-order')).to_have_count(1)
 page.get_by_role('button',name='Recentes · Em andamento',exact=True).click()
 expect(page.locator('.apoio-order')).to_have_count(0)
 page.get_by_label('Período de recência').select_option('24h')
 expect(page.locator('.apoio-order')).to_have_count(1)
 page.get_by_role('button',name='Recentes · Programadas e andamento',exact=True).click()
 expect(page.locator('.apoio-order')).to_have_count(2)
 # Entrada e primeira detecção produzem ordenações distintas.
 expect(page.locator('.apoio-order').first.locator('.apoio-fleet-title')).to_have_text('FROTA 15101')
 page.get_by_label('Data de referência').select_option('entrada')
 expect(page.locator('.apoio-order').first.locator('.apoio-fleet-title')).to_have_text('FROTA 15115')
 page.get_by_label('Local',exact=True).select_option('Campo')
 expect(page.locator('.apoio-order')).to_have_count(1)
 page.get_by_label('Local',exact=True).select_option('')
 page.get_by_label('Período de recência').select_option('custom')
 page.get_by_label('Data inicial',exact=True).fill('2026-11-08')
 page.get_by_label('Data final',exact=True).fill('2026-11-07')
 expect(page.locator('.apoio-recency-error')).to_be_visible()
 expect(page.locator('.apoio-order')).to_have_count(0)
 page.get_by_role('button',name='Limpar filtros',exact=True).click()
 expect(page.locator('.apoio-order')).to_have_count(3)
 expect(page.get_by_label('Ordenar ordens')).to_have_value('organized')
 page.get_by_role('button',name='Recentes · Programadas e andamento',exact=True).click()
 page.get_by_label('Período de recência').select_option('24h')
 page.locator('.apoio-recency-panel').screenshot(path=str(OUT/'previa-filtro-recentes-desktop.png'))
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 page.locator('.apoio-recency-panel').screenshot(path=str(OUT/'previa-filtro-recentes-celular.png'))
 assert page.evaluate('window.__apoioMock.writes.length')==0
 assert not errors,errors
 b.close()
(OUT/'validacao-interface-recentes.json').write_text(json.dumps({'status':'aprovado','checks':['atalhos por status','entrada vs primeira detecção','janela1h/24h','combinação com local','intervalo invertido','limpar filtros','responsivo390px','nenhuma gravação'],'dados':'fictícios, conexões externas bloqueadas'},ensure_ascii=False,indent=2)+'\n')
print('OK: recência e status combinados,períodos,bases,intervalo,reset e responsividade; nenhum dado real alterado.')
