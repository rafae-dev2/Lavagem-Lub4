from pathlib import Path
from playwright.sync_api import sync_playwright
import os

out = Path(os.environ.get('GLASSY_OUTPUT_DIR','/home/ubuntu/entrega-apoio-frotas-glassy'))
out.mkdir(exist_ok=True)
url = os.environ.get('GLASSY_TEST_URL','http://127.0.0.1:8768/tests/.tmp-glassy/index.html')
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True,args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
    page.route('**/*',lambda route: route.continue_() if route.request.url.startswith('http://127.0.0.1:8768/') else route.abort())
    errors=[]
    page.on('pageerror',lambda error: errors.append(str(error)))
    page.goto(url)
    page.wait_for_selector('.apoio-group-fleet-grid')
    page.wait_for_function("document.documentElement.classList.contains('theme-glassy-v18')")
    cards=page.locator('article.apoio-order')
    assert cards.count()==3, cards.count()
    group=page.locator('.apoio-group-fleet-tile-main').filter(has_text='Caminhões — Demonstração')
    group.click()
    picker=page.locator('.apoio-group-fleet-picker')
    picker.wait_for()
    assert picker.locator('.apoio-group-fleet-option').count()==3
    picker.get_by_role('button',name='Nenhuma',exact=True).click()
    assert cards.count()==0
    picker.locator('.apoio-group-fleet-option').filter(has_text='Frota 4508').click()
    assert cards.count()==1 and '4508' in cards.first.inner_text()
    page.locator('.apoio-group-fleet-tile-main').filter(has_text='Caminhonetes — Demonstração').click()
    assert cards.count()==2
    picker=page.locator('.apoio-group-fleet-picker')
    assert '7010' in picker.inner_text()
    group.click()
    picker=page.locator('.apoio-group-fleet-picker')
    assert picker.locator('.apoio-group-fleet-option').filter(has_text='Frota 4508').locator('input[type="checkbox"]').is_checked()
    assert not picker.locator('.apoio-group-fleet-option').filter(has_text='Frota 4512').locator('input[type="checkbox"]').is_checked()
    picker.get_by_role('textbox',name='Buscar número da frota').fill('4512')
    assert picker.locator('.apoio-group-fleet-option').count()==1
    picker.get_by_role('textbox',name='Buscar número da frota').fill('')
    page.screenshot(path=str(out/'previa-glassy-desktop.png'),full_page=False)
    page.locator('.apoio-group-fleet-all').click()
    assert cards.count()==3
    assert page.locator('.apoio-group-fleet-picker').count()==0, 'Limpar seleção fecha o seletor'
    page.set_viewport_size({'width':390,'height':844})
    group.click()
    picker=page.locator('.apoio-group-fleet-picker')
    picker.get_by_role('button',name='Nenhuma',exact=True).click()
    picker.locator('.apoio-group-fleet-option').filter(has_text='Frota 4512').click()
    assert cards.count()==1 and '4512' in cards.first.inner_text()
    page.evaluate("document.querySelector('.apoio-group-fleet-filter').scrollIntoView({block:'start'})")
    page.screenshot(path=str(out/'previa-glassy-celular.png'),full_page=False)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), 'Overflow horizontal no celular'
    assert not errors, errors
    page.goto(url+'?theme=light')
    page.wait_for_selector('.apoio-group-fleet-grid')
    assert not page.evaluate("document.documentElement.classList.contains('theme-glassy-v18')")
    assert page.locator('article.apoio-order').count()==3
    browser.close()
print('OK: grupos e frotas, seleção nenhuma/múltiplos grupos, pesquisa, limpar, celular sem overflow, tema adicional e Claro preservado; nenhum serviço real acessado.',flush=True)
