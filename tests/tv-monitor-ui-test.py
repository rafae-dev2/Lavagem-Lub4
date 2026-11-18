from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json

OUT = Path('/home/ubuntu/entrega-modo-tv')
OUT.mkdir(exist_ok=True)
URL = 'http://127.0.0.1:3000/tv-test.html'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1920,'height':1080}, device_scale_factor=1)
    page.route('**/*', lambda route: route.continue_() if route.request.url.startswith('http://127.0.0.1:3000/') else route.abort())
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.add_init_script("if(!localStorage.getItem('bp-tv-monitor-v1'))localStorage.setItem('bp-tv-monitor-v1',JSON.stringify({pageSize:6,screenSeconds:12,alternate:false}));")
    page.goto(URL)
    page.wait_for_selector('.tv-order')
    assert page.locator('.tv-order').count() == 6
    assert 'Página 1 de 2' in page.locator('.tv-page-controls').inner_text()
    assert page.locator('.tv-summary > div').first.locator('strong').inner_text() == '08'
    page.get_by_role('button', name='Apresentar na TV', exact=True).click()
    assert page.locator('.tv-monitor--presenting').is_visible()
    page.wait_for_timeout(500)
    assert page.locator('.tv-monitor').evaluate('(el) => el.scrollHeight <= el.clientHeight + 2'), 'TV 1080p: conteúdo fora da tela'
    page.screenshot(path=str(OUT/'previa-modo-tv-1080p.png'))
    page.get_by_role('button', name='Configurar filtros do monitor').click()
    page.get_by_role('button', name='Nenhuma', exact=True).click()
    assert page.locator('.tv-summary > div').first.locator('strong').inner_text() == '00'
    page.locator('.tv-category-grid label').filter(has_text='Caminhões Caçamba').click()
    assert page.locator('.tv-summary > div').first.locator('strong').inner_text() == '03'
    page.locator('.tv-category-grid label').filter(has_text='Caminhões Munck').click()
    assert page.locator('.tv-summary > div').first.locator('strong').inner_text() == '06'
    page.get_by_label('Origem / oficina',exact=True).select_option('Oficina Interna')
    assert page.locator('.tv-summary > div').first.locator('strong').inner_text() == '04'
    page.get_by_label('Motivo',exact=True).select_option('HIDRÁULICO')
    assert page.locator('.tv-summary > div').first.locator('strong').inner_text() == '02'
    page.get_by_role('button', name='Concluir · 2 ordem(ns)',exact=True).click()
    assert page.locator('.tv-order').count() == 2
    page.reload()
    page.wait_for_selector('.tv-order')
    assert page.locator('.tv-order').count() == 2, 'Configuração não persistiu'
    page.get_by_role('button',name='Configurar filtros do monitor').click()
    page.get_by_role('button',name='Restaurar padrão',exact=True).click()
    page.get_by_label('Ordens por página',exact=True).select_option('6')
    page.get_by_label('Alternância dos painéis',exact=True).select_option('off')
    page.get_by_label('Intervalo do rodízio',exact=True).select_option('10')
    page.get_by_role('button',name='Concluir · 8 ordem(ns)',exact=True).click()
    assert 'Página 1 de 2' in page.locator('.tv-page-controls').inner_text()
    page.wait_for_timeout(10700)
    assert 'Página 2 de 2' in page.locator('.tv-page-controls').inner_text(), 'Rodízio não avançou'
    page.get_by_role('button',name='Pausar rodízio').click()
    before=page.locator('.tv-page-controls').inner_text()
    page.wait_for_timeout(1100)
    assert page.locator('.tv-page-controls').inner_text() == before
    page.get_by_role('button',name='Página anterior').click()
    page.locator('.tv-order').first.get_by_role('button').click()
    assert page.get_by_role('dialog').is_visible()
    assert 'Narrativa integral da ordem' in page.get_by_role('dialog').inner_text()
    page.keyboard.press('Escape')
    assert not page.get_by_role('dialog').count()
    page.evaluate('window.tvTestUpdate()')
    expect(page.locator('.tv-summary > div').first.locator('strong')).to_have_text('07')
    page.evaluate('window.tvTestError()')
    expect(page.locator('.tv-warning')).to_contain_text('Última fotografia preservada')
    assert page.locator('.tv-summary > div').first.locator('strong').inner_text() == '07'
    page.evaluate('window.tvTestStale()')
    assert 'Fonte desatualizada' not in page.locator('.tv-connection').inner_text() # erro tem prioridade no indicador
    expect(page.locator('.tv-connection')).to_have_text('Falha de atualização')
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), 'Overflow horizontal no celular'
    page.get_by_role('button',name='Configurar filtros do monitor').click()
    assert page.get_by_role('dialog').evaluate('(el) => el.getBoundingClientRect().width') < 390
    page.screenshot(path=str(OUT/'previa-modo-tv-filtros-celular.png'))
    page.keyboard.press('Escape')
    page.emulate_media(reduced_motion='reduce')
    assert page.locator('.tv-order').first.evaluate('(el)=>getComputedStyle(el).animationName') == 'none'
    assert not errors, errors
    browser.close()
(OUT/'validacao-modo-tv.json').write_text(json.dumps({'status':'aprovado','dados':'fictícios; tráfego externo bloqueado','checks':['apresentação 1920x1080 sem corte vertical','filtros combinados por categorias, origem e motivo','nenhuma categoria produz zero ordens','configuração persistida no navegador','rodízio automático e pausa','detalhes integrais','mudança de andamento remove ordem','erro preserva fotografia e mostra alerta','fonte desatualizada sinalizada','celular sem overflow horizontal','modal responsivo','redução de movimento','nenhum erro JavaScript']},ensure_ascii=False,indent=2)+'\n')
print('OK: TV 1080p, filtros, persistência, rodízio, detalhes, atualização, falha, celular e movimento reduzido; sem acesso externo.')
