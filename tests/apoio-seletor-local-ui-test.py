from pathlib import Path
from playwright.sync_api import sync_playwright
import os

out = Path('/home/ubuntu/entrega-apoio-seletor-local')
out.mkdir(exist_ok=True)
base = os.environ.get('GLASSY_TEST_URL','http://127.0.0.1:8768/tests/.tmp-glassy/index.html')

def open_group(page, name):
    button = page.locator('.apoio-group-fleet-tile-main').filter(has_text=name)
    button.click()
    picker=page.locator('.apoio-group-fleet-picker')
    picker.wait_for()
    return button,picker

def check_position(page, button, picker):
    page.wait_for_timeout(120)
    b=button.bounding_box(); panel=picker.bounding_box()
    assert b and panel
    assert panel['y'] >= b['y']+b['height']-1, (b,panel)
    assert panel['y']-(b['y']+b['height']) < 28, 'O seletor abriu longe da linha clicada'
    assert page.evaluate("document.querySelector('.apoio-group-fleet-grid').contains(document.querySelector('.apoio-group-fleet-picker'))")
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), 'Overflow horizontal'

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    for theme,width,height,filename in [('light',390,844,'previa-celular.png'),('light',1440,1050,'previa-desktop.png'),('glassy-v18',390,844,'previa-glassy-celular.png'),('glassy-v18',1440,1050,'previa-glassy-desktop.png'),('light',320,750,None)]:
        page=browser.new_page(viewport={'width':width,'height':height})
        page.set_default_timeout(7000)
        page.route('**/*',lambda route: route.continue_() if route.request.url.startswith('http://127.0.0.1:8768/') else route.abort())
        errors=[]
        page.on('pageerror',lambda error: errors.append(str(error)))
        page.goto(base+'?fixture=12&theme='+theme)
        tiles=page.locator('.apoio-group-fleet-tile')
        tiles.first.wait_for()
        assert tiles.count()==12
        positions=[tiles.nth(i).bounding_box() for i in range(2)]
        assert abs(positions[0]['y']-positions[1]['y']) < 2, 'Grupos ainda empilhados em uma coluna'
        button,picker=open_group(page,'Área de Vivência')
        check_position(page,button,picker)
        assert picker.locator('.apoio-group-fleet-option').count()==16
        assert picker.locator('.apoio-group-fleet-option').first.evaluate("e=>Array.from(e.children).every(c=>c.getBoundingClientRect().bottom <= e.getBoundingClientRect().bottom+1)"), 'Texto da frota cortado ou sobreposto'
        picker.get_by_role('button',name='Nenhuma',exact=True).click()
        row=picker.locator('.apoio-group-fleet-option').filter(has_text='Frota 8000')
        row.click()
        input=row.locator('input[type="checkbox"]')
        assert input.is_checked()
        row.click(); assert not input.is_checked(), 'Um clique deve alternar uma vez'
        row.click(); assert input.is_checked()
        assert page.locator('article.apoio-order').count()==1
        button.click()
        assert page.locator('.apoio-group-fleet-picker').count()==0, 'Repetir clique deve fechar sem limpar seleção'
        button,picker=open_group(page,'Caminhão Caçamba')
        assert page.locator('article.apoio-order').count()==7, 'União de dois grupos precisa manter a frota anterior'
        check_position(page,button,picker)
        page.keyboard.press('Escape')
        assert page.locator('.apoio-group-fleet-picker').count()==0
        button,picker=open_group(page,'Área de Vivência')
        assert picker.locator('.apoio-group-fleet-option').filter(has_text='Frota 8000').locator('input').is_checked()
        assert not picker.locator('.apoio-group-fleet-option').filter(has_text='Frota 8001').locator('input').is_checked()
        picker.get_by_role('textbox',name='Buscar número da frota').fill('8001')
        assert picker.locator('.apoio-group-fleet-option').count()==1
        picker.get_by_role('textbox',name='Buscar número da frota').fill('')
        check_position(page,button,picker)
        if filename:
            page.evaluate("document.querySelector('.apoio-group-fleet-filter').scrollIntoView({block:'start'})")
            page.screenshot(path=str(out/filename))
        picker.get_by_role('button',name='Concluir',exact=True).click()
        assert page.locator('.apoio-group-fleet-picker').count()==0
        # A late group must insert its own panel after its row, not after all groups.
        button,picker=open_group(page,'Reboque Prancha')
        check_position(page,button,picker)
        page.set_viewport_size({'width':760 if width<720 else 390,'height':950})
        check_position(page,button,picker)
        picker.get_by_role('button',name='Remover grupo',exact=True).click()
        assert page.locator('.apoio-group-fleet-picker').count()==0
        assert button.evaluate('e=>e===document.activeElement'), 'Remover grupo precisa devolver o foco'
        page.locator('.apoio-group-fleet-all').click()
        assert page.locator('.apoio-group-fleet-picker').count()==0
        assert not errors, errors
        page.close()
    browser.close()
print('OK: 12 grupos, duas colunas a 320/390px, desktop, tema Claro e Glassy, painel após linha clicada, redimensionamento, clique único, multi-grupo, busca, Escape/Concluir e limpar; sem acesso ao banco.',flush=True)
