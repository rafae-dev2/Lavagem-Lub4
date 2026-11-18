from playwright.sync_api import sync_playwright
from pathlib import Path
import json,os
BASE=os.environ.get('CENTRAL_TEST_BASE','http://127.0.0.1:3000')
OUT=Path('/home/ubuntu/work/central-evidence');OUT.mkdir(exist_ok=True)
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in [1366,1024,390]:
  context=browser.new_context(viewport={'width':width,'height':1000},accept_downloads=True,locale='pt-BR',timezone_id='America/Sao_Paulo')
  page=context.new_page();page.set_default_timeout(8000);errors=[];blocked=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   if r.request.url.startswith(BASE):r.continue_()
   else:blocked.append(r.request.url);r.abort()
  page.route('**/*',route);page.goto(BASE,wait_until='domcontentloaded');page.wait_for_selector('.bi-kpi');page.wait_for_timeout(500)
  assert page.locator('.bi-kpi').count()==8
  assert page.locator('.bi-chart-panel').count()==8
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),page.evaluate('({w:innerWidth,s:document.documentElement.scrollWidth})')
  initial=page.locator('.bi-kpi').first.locator('strong').inner_text()
  assert initial=='61',initial
  if width==1366:
   page.screenshot(path=str(OUT/'central-gerencial-computador.png'),full_page=False)
  if width==390:page.screenshot(path=str(OUT/'central-gerencial-celular.png'),full_page=False)
  if width<=760:page.get_by_role('button',name='Mais filtros',exact=True).click()
  # Four groups hidden only in Lavagem are all available in this module.
  page.get_by_role('button',name='Filtrar Grupos de equipamentos',exact=True).click()
  for name in ['Carretas Canavieiras','Trator Transbordo','Colhedoras','Carretas Rodomuda']:
   assert page.get_by_role('group',name='Opções de Grupos de equipamentos').get_by_text(name,exact=True).count()==1
  page.get_by_role('checkbox',name='Carretas Canavieiras',exact=False).check();page.keyboard.press('Escape')
  assert page.locator('.bi-kpi').first.locator('strong').inner_text()=='5'
  page.get_by_role('button',name='Limpar seleção',exact=True).click()
  # Search and Enter route to orders without losing the query.
  page.get_by_role('textbox',name='Pesquisar ordens gerenciais').fill('TEST-OS-31');page.keyboard.press('Enter');page.wait_for_selector('.bi-orders-table')
  assert page.locator('.bi-orders-table tbody tr').count()==1
  page.get_by_role('button',name='Detalhes da OS TEST-OS-31',exact=True).click()
  assert page.locator('.bi-full-narrative').inner_text().startswith('DADO SINTÉTICO')
  page.get_by_role('button',name='Limpar seleção',exact=True).click()
  # Numeric age filter includes work in progress; date error is visible and blocks exports.
  if page.get_by_role('button',name='Mais filtros',exact=True).get_attribute('aria-expanded')!='true':page.get_by_role('button',name='Mais filtros',exact=True).click()
  page.get_by_role('spinbutton',name='Idade mínima em dias').fill('3');page.get_by_role('spinbutton',name='Idade máxima em dias').fill('2')
  assert page.get_by_role('alert').filter(has_text='mínima').count()==1
  assert page.get_by_role('button',name='Relatório PDF',exact=True).is_disabled()
  page.get_by_role('button',name='Limpar seleção',exact=True).click()
  page.get_by_role('button',name='Painel gerencial',exact=True).click();page.wait_for_selector('[data-chart-key="bi-chart-aging"]')
  print('Central',width,'busca/filtros/detalhes OK',flush=True)
  # Chart selection and table show same population, including fractional ages.
  age_button=page.locator('[data-chart-key="bi-chart-aging"] .bi-chart-actions button').filter(has_text='3–7 dias').first
  age_caption=age_button.inner_text();expected=age_caption.split('(')[-1].rstrip(')');age_button.click()
  assert page.locator('.bi-kpi').first.locator('strong').inner_text()==expected,(expected,page.locator('.bi-kpi').first.inner_text())
  page.get_by_role('button',name='Limpar seleção',exact=True).click()
  # Heatmap jointly selects group and age band; no lost update from callbacks.
  cell=page.locator('[data-chart-key="bi-chart-heatmap"] .bi-heat-cell:not(.is-zero)').first
  expected=cell.inner_text();cell.click()
  assert page.locator('.bi-kpi').first.locator('strong').inner_text()==expected
  page.locator('[data-chart-key="bi-chart-heatmap"] .bi-heat-cell:not(.is-zero)').first.click()
  assert page.locator('.bi-kpi').first.locator('strong').inner_text()==expected,'clique repetido mantém grupo+faixa'
  page.get_by_role('button',name='Limpar seleção',exact=True).click()
  page.get_by_role('button',name='Consulta de ordens',exact=False).click();page.wait_for_selector('.bi-orders-table')
  assert page.locator('.bi-orders-table tbody tr').count()==25
  page.get_by_role('button',name='Próxima página de ordens',exact=True).click();assert page.locator('.bi-pagination').inner_text().startswith('26')
  if width==1366:
   page.screenshot(path=str(OUT/'central-gerencial-consulta.png'),full_page=False)
   with page.expect_download() as event:page.get_by_role('button',name='Excel',exact=True).click()
   download=event.value;assert download.suggested_filename.endswith('.xlsx');download.save_as(str(OUT/'teste-central-gerencial.xlsx'))
   with page.expect_download(timeout=30000) as event:page.get_by_role('button',name='Relatório PDF',exact=True).click()
   download=event.value;assert download.suggested_filename.endswith('.pdf');download.save_as(str(OUT/'teste-central-gerencial.pdf'))
  assert not errors,errors
  results.append({'largura':width,'checks':'8 KPIs,8 gráficos,todos grupos,busca,detalhes,idade inválida,faixa,heatmap,paginação','erros_javascript':errors,'dados':'mock isolado, zero Supabase'})
  print('OK Central',width,flush=True);context.close()
 browser.close()
(OUT/'resultado.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
