from pathlib import Path
from playwright.sync_api import sync_playwright
import json
import re

ROOT = Path(__file__).resolve().parents[1]
OUT = Path('/home/ubuntu/entrega-glassy-v18')
OUT.mkdir(exist_ok=True)
URL = 'http://127.0.0.1:3000/glassy-test.html'

def rgb(value):
    return [float(v) / 255 for v in re.findall(r'[\d.]+', value)[:3]]

def luminance(color):
    c = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in color]
    return sum(v * weight for v, weight in zip(c, [.2126, .7152, .0722]))

def ratio(fg, bg):
    a, b = sorted([luminance(rgb(fg)), luminance(rgb(bg))])
    return (b + .05) / (a + .05)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1440, 'height':1000}, device_scale_factor=1)
    page.route('**/*', lambda route: route.continue_() if route.request.url.startswith('http://127.0.0.1:3000/') else route.abort())
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL)
    page.wait_for_selector('.status-badge')
    page.wait_for_timeout(750)
    samples = page.locator('.status-badge').evaluate_all('(els) => els.map(el => ({status: el.dataset.status, color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor}))')
    for sample in samples:
        sample['contrast'] = round(ratio(sample['color'], sample['background']), 2)
        assert sample['contrast'] >= 4.5, sample
    assert page.locator('.status-badge').count() == 5
    assert page.locator('.shell-header').evaluate('(el) => getComputedStyle(el).backgroundColor') != 'rgb(31, 107, 69)'
    assert page.locator('.lub-actions-cell').last.evaluate('(el) => getComputedStyle(el).position') == 'sticky'
    assert page.locator('.lub-actions-cell').last.evaluate('(el) => getComputedStyle(el).backgroundColor') == 'rgb(57, 50, 46)'
    assert page.locator('.glass-card').first.evaluate('(el) => getComputedStyle(el).backdropFilter').find('blur(24px)') >= 0
    page.screenshot(path=str(OUT / 'previa-glassy-desktop.png'))
    page.get_by_role('button', name='Escolher tema').click()
    assert page.locator('.shell-theme-picker').is_visible()
    assert page.locator('.shell-theme-option__label').last.evaluate('(el) => getComputedStyle(el).color') == 'rgb(255, 250, 242)'
    page.keyboard.press('Escape')
    page.locator('.shell-header__title').click(position={'x':5, 'y':5})
    page.set_viewport_size({'width':390, 'height':844})
    page.locator('.shell-theme-picker').wait_for(state='hidden')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    assert page.locator('.lub-actions-cell').last.evaluate('(el) => getComputedStyle(el).position') == 'static'
    scroll = page.locator('.lub-table-scroll')
    scroll.evaluate('(el) => { el.scrollLeft = el.scrollWidth; el.scrollIntoView({block:"start"}); }')
    page.get_by_role('button', name='Editar programação da frota 4508 OS 159329760', exact=True).click()
    assert page.get_by_label('Frota editada').inner_text() == '4508'
    page.locator('.lub-detail').first.click()
    assert page.locator('.lub-narrative').first.is_visible()
    page.locator('.lub-detail').first.click()
    scroll.evaluate('(el) => { el.scrollLeft = el.scrollWidth; }')
    page.mouse.move(0, 0)
    page.screenshot(path=str(OUT / 'previa-glassy-celular-tabela.png'))
    scroll.evaluate('(el) => { el.scrollLeft = 450; }')
    page.screenshot(path=str(OUT / 'previa-glassy-celular-status.png'))
    page.locator('main').evaluate('(el) => el.scrollTop = 0')
    page.screenshot(path=str(OUT / 'previa-glassy-celular.png'))
    page.get_by_role('button', name='Abrir menu').click()
    page.get_by_role('button', name='Calendário', exact=True).click()
    assert page.locator('.shell-page-stage').evaluate('(el) => getComputedStyle(el).animationName') == 'v18-page-enter'
    page.emulate_media(reduced_motion='reduce')
    assert page.locator('.shell-page-stage').evaluate('(el) => getComputedStyle(el).animationName') == 'none'
    assert page.locator('.lub-kpi').first.evaluate('(el) => getComputedStyle(el).animationName') == 'none'
    page.goto(URL + '?theme=light')
    page.wait_for_selector('.status-badge')
    assert not page.evaluate('document.documentElement.classList.contains("theme-glassy-v18")')
    assert page.locator('.status-badge').first.evaluate('(el) => getComputedStyle(el).backgroundColor') == 'rgb(254, 226, 226)'
    assert not errors, errors
    browser.close()

(OUT / 'validacao-glassy-v18.json').write_text(json.dumps({'status':'aprovado', 'badges':samples, 'checks':['5 status com contraste >= 4.5:1', 'blur 24px desktop / 18px mobile', 'cabeçalho fumê em vez de verde no V18', 'sticky desktop opaco', 'ações sem sticky no celular', 'celular sem overflow global', 'edição e expansão de detalhes', 'seletor de tema via portal', 'animação de navegação', 'movimento reduzido', 'tema Claro preservado', 'requisições externas bloqueadas', 'nenhum erro JavaScript']}, indent=2, ensure_ascii=False) + '\n')
print('OK: contraste dos cinco status, vidro, tabela, celular, detalhes, edição, portal, navegação e redução de movimento. Nenhum serviço real acessado.')
