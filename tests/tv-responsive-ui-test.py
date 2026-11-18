from pathlib import Path
import json
import re

from playwright.sync_api import expect, sync_playwright

OUT = Path('/home/ubuntu/entrega-tv-cards-responsivos')
OUT.mkdir(exist_ok=True)
URL = 'http://127.0.0.1:3000/tv-test.html'
VIEWPORTS = [
    (390, 844),
    (800, 600),
    (1024, 768),
    (1236, 629),
    (1366, 768),
    (1920, 1080),
    (2560, 1440),
]
EPS = 2.0


def rect(locator):
    return locator.evaluate(
        """(el) => {
            const r = el.getBoundingClientRect();
            return {left:r.left, right:r.right, top:r.top, bottom:r.bottom,
                    width:r.width, height:r.height};
        }"""
    )


def ensure_normal(page):
    monitor = page.locator('.tv-monitor')
    if 'tv-monitor--presenting' in (monitor.get_attribute('class') or ''):
        page.locator("button[aria-label='Sair da apresentação TV']").click()
        page.wait_for_timeout(80)


def ensure_presentation(page, presenting):
    monitor = page.locator('.tv-monitor')
    is_presenting = 'tv-monitor--presenting' in (monitor.get_attribute('class') or '')
    if presenting != is_presenting:
        label = 'Sair da apresentação TV' if is_presenting else 'Apresentar na TV'
        page.locator(f"button[aria-label='{label}']").click()
        page.wait_for_timeout(100)


def ensure_theme(page, theme):
    monitor = page.locator('.tv-monitor')
    current = monitor.get_attribute('data-tv-theme')
    if current != theme:
        label = 'Ativar modo claro premium' if theme == 'light' else 'Ativar modo escuro premium'
        page.locator(f"button[aria-label='{label}']").click()
        page.wait_for_timeout(80)
    expect(monitor).to_have_attribute('data-tv-theme', theme)


def set_fixture_count(page, count):
    page.evaluate(f'window.tvTestResponsive({count})')
    expect(page.locator('.tv-summary > div').first.locator('strong')).to_have_text(f'{count:02d}')
    expect(page.locator('.tv-order').first).to_be_visible()


def assert_no_horizontal_overflow(page, label):
    metrics = page.evaluate(
        """() => {
            const root = document.getElementById('root');
            const rr = root ? root.getBoundingClientRect() : {right: 0};
            return {innerWidth: window.innerWidth, documentWidth: document.documentElement.scrollWidth,
                    bodyWidth: document.body.scrollWidth, rootRight: rr.right};
        }"""
    )
    assert metrics['documentWidth'] <= metrics['innerWidth'] + 1, f'{label}: document overflow {metrics}'
    assert metrics['bodyWidth'] <= metrics['innerWidth'] + 1, f'{label}: body overflow {metrics}'
    assert metrics['rootRight'] <= metrics['innerWidth'] + 1, f'{label}: root exceeds viewport {metrics}'


def parse_pagination(page):
    text = page.locator('.tv-page-controls').inner_text()
    page_match = re.search(r'Página\s+(\d+)\s+de\s+(\d+)', text)
    range_match = re.search(r'(\d+)[–-](\d+)\s+de\s+(\d+)\s+ordens', text)
    assert page_match and range_match, f'Paginação sem contagem legível: {text!r}'
    return {
        'text': text,
        'page': int(page_match.group(1)),
        'pages': int(page_match.group(2)),
        'start': int(range_match.group(1)),
        'end': int(range_match.group(2)),
        'total': int(range_match.group(3)),
    }


def assert_layout(page, width, height, count, presenting, theme):
    page.wait_for_timeout(180)  # ResizeObserver e remontagem do portal concluem antes da medição.
    label = f'{width}x{height}, count={count}, mode={"presenting" if presenting else "normal"}, theme={theme}'
    assert_no_horizontal_overflow(page, label)

    monitor = page.locator('.tv-monitor')
    viewport = page.locator('.tv-board-viewport')
    board = viewport.locator('.tv-board')
    pagination = page.locator('.tv-pagination')
    assert viewport.count() == 1, f'{label}: wrapper .tv-board-viewport ausente'
    assert board.count() == 1, f'{label}: .tv-board ausente dentro do wrapper'
    assert pagination.count() == 1, f'{label}: rodapé global ausente'

    monitor_rect = rect(monitor)
    viewport_rect = rect(viewport)
    board_rect = rect(board)
    pagination_rect = rect(pagination)
    assert viewport_rect['width'] > 0 and viewport_rect['height'] > 0, f'{label}: viewport sem área útil'
    assert viewport_rect['left'] >= monitor_rect['left'] - EPS, f'{label}: wrapper saiu pela esquerda'
    assert viewport_rect['right'] <= monitor_rect['right'] + EPS, f'{label}: wrapper saiu pela direita'
    assert board_rect['left'] >= viewport_rect['left'] - EPS, f'{label}: board saiu pela esquerda do wrapper'
    assert board_rect['right'] <= viewport_rect['right'] + EPS, f'{label}: board saiu pela direita do wrapper'

    if presenting:
        assert pagination_rect['top'] >= viewport_rect['bottom'] - 1, f'{label}: rodapé atravessou o wrapper'
    else:
        assert pagination_rect['top'] >= board_rect['bottom'] - 1, f'{label}: rodapé atravessou o board'

    cards = page.locator('.tv-order')
    assert cards.count() > 0, f'{label}: nenhum card renderizado'
    page_size = int(monitor.get_attribute('data-page-size') or '0')
    assert page_size > 0, f'{label}: capacidade de página não informada'
    assert cards.count() <= page_size, f'{label}: {cards.count()} cards excedem capacidade {page_size}'

    if presenting:
        # Na apresentação o board ocupa apenas a capacidade que cabe no viewport;
        # não pode haver uma linha de cards escondida atrás da paginação.
        for index in range(cards.count()):
            card_rect = rect(cards.nth(index))
            assert card_rect['bottom'] <= viewport_rect['bottom'] + EPS, f'{label}: card {index} excede a altura do wrapper'

    for index in range(cards.count()):
        card = cards.nth(index)
        card_rect = rect(card)
        assert card_rect['left'] >= viewport_rect['left'] - EPS, f'{label}: card {index} saiu pela esquerda'
        assert card_rect['right'] <= viewport_rect['right'] + EPS, f'{label}: card {index} saiu pela direita'

        card_footer = card.locator('footer')
        assert card_footer.count() == 1 and card_footer.is_visible(), f'{label}: footer do card {index} não está visível'
        footer_rect = rect(card_footer)
        assert footer_rect['top'] >= card_rect['top'] - EPS, f'{label}: footer do card {index} saiu por cima'
        assert footer_rect['bottom'] <= card_rect['bottom'] + EPS, f'{label}: footer do card {index} saiu por baixo'

        fleet = card.locator('.tv-equipment > div').first
        equipment_name = card.locator('.tv-equipment-name')
        assert fleet.locator('strong').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'), f'{label}: número de frota saiu do track no card {index}'
        fleet_rect = rect(fleet)
        name_rect = rect(equipment_name)
        assert fleet_rect['right'] <= name_rect['left'] + EPS, f'{label}: frota e nome se sobrepõem no card {index}'

        narrative = card.locator('.tv-order-problem')
        dates = card.locator('.tv-order-dates')
        narrative_rect = rect(narrative)
        dates_rect = rect(dates)
        horizontal_overlap = narrative_rect['left'] < dates_rect['right'] - EPS and dates_rect['left'] < narrative_rect['right'] - EPS
        vertical_overlap = narrative_rect['top'] < dates_rect['bottom'] - EPS and dates_rect['top'] < narrative_rect['bottom'] - EPS
        assert not (horizontal_overlap and vertical_overlap), f'{label}: narrativa e datas se sobrepõem no card {index}'

    pagination_state = parse_pagination(page)
    assert pagination_state['total'] == count, f'{label}: paginação indica {pagination_state["total"]}, esperado {count}'
    assert pagination_state['end'] - pagination_state['start'] + 1 == cards.count(), f'{label}: faixa da paginação não corresponde aos cards'
    return pagination_state


def open_filters(page):
    ensure_normal(page)
    page.locator("button[aria-label='Configurar filtros do monitor']").click()
    expect(page.locator('.tv-dialog')).to_be_visible()


def close_filters(page):
    if page.locator('.tv-dialog').count():
        page.keyboard.press('Escape')
        expect(page.locator('.tv-dialog')).to_have_count(0)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1920, 'height': 1080}, device_scale_factor=1)
    page.route(
        '**/*',
        lambda route: route.continue_()
        if route.request.url.startswith('http://127.0.0.1:3000/') or route.request.url.startswith('http://localhost:3000/')
        else route.abort(),
    )
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script(
        """localStorage.setItem('bp-tv-monitor-v1', JSON.stringify({
            pageSize: 0, seconds: 60, rotate: true, alternate: false,
            screenSeconds: 60, theme: 'dark'
        }));"""
    )
    page.goto(URL)
    page.wait_for_selector('.tv-order')
    set_fixture_count(page, 5)

    # Matriz completa: contagens pequenas e grandes, dois modos e ambos os temas.
    for width, height in VIEWPORTS:
        page.set_viewport_size({'width': width, 'height': height})
        page.wait_for_timeout(100)
        ensure_normal(page)
        page.locator("button[aria-label='Painel Emergenciais']").click()
        for count in (5, 35):
            set_fixture_count(page, count)
            for theme in ('dark', 'light'):
                ensure_theme(page, theme)
                for presenting in (False, True):
                    ensure_presentation(page, presenting)
                    assert_layout(page, width, height, count, presenting, theme)
                    if (width, height, count, theme, presenting) == (1236, 629, 35, 'light', True):
                        page.screenshot(path=str(OUT / 'repro-1236x629-claro.png'))
                    if (width, height, count, theme, presenting) == (1920, 1080, 35, 'dark', True):
                        page.screenshot(path=str(OUT / 'TV1920x1080.png'))
                ensure_normal(page)

    # As origens alternadas precisam alimentar o painel externo, sem perder o cadastro das frotas.
    page.set_viewport_size({'width': 1920, 'height': 1080})
    ensure_normal(page)
    ensure_theme(page, 'dark')
    set_fixture_count(page, 35)
    page.locator("button[aria-label='Painel Ordens Externas']").click()
    expect(page.locator('.tv-summary > div').first.locator('strong')).to_have_text('17')
    assert page.locator('.tv-external').count() == page.locator('.tv-order').count()
    assert 'Oficina Terceirizada Especializada' in page.locator('.tv-order').first.inner_text()
    page.locator("button[aria-label='Painel Emergenciais']").click()
    expect(page.locator('.tv-summary > div').first.locator('strong')).to_have_text('35')

    # A paginação deve visitar as 35 frotas; os textos longos permanecem no DOM sem causar colisão.
    ensure_normal(page)
    ensure_theme(page, 'dark')
    seen_fleets = set()
    pagination = parse_pagination(page)
    for page_index in range(pagination['pages']):
        current = parse_pagination(page)
        cards = page.locator('.tv-order')
        for index in range(cards.count()):
            card = cards.nth(index)
            seen_fleets.add(card.locator('.tv-equipment > div').first.locator('strong').inner_text())
            assert len(card.locator('.tv-order-problem p').inner_text()) >= 1000
        assert current['end'] - current['start'] + 1 == cards.count()
        if page_index < pagination['pages'] - 1:
            before = current['text']
            page.get_by_role('button', name='Próxima página', exact=True).click()
            page.wait_for_timeout(80)
            assert page.locator('.tv-page-controls').inner_text() != before
    assert len(seen_fleets) == 35, f'Paginação não mostrou todas as 35 frotas: {len(seen_fleets)}'
    assert '123456789' in seen_fleets, 'Frota longa 123456789 não chegou a nenhuma página'

    # Filtros: a abertura pausa o rodízio e a configuração persiste em ambas as direções de resize.
    page.reload()
    page.wait_for_selector('.tv-order')
    set_fixture_count(page, 35)
    page.set_viewport_size({'width': 1366, 'height': 768})
    open_filters(page)
    dialog = page.locator('.tv-dialog')
    dialog.get_by_label('Situação', exact=True).select_option('abertas')
    dialog.get_by_label('Ordenação', exact=True).select_option('fleet')
    dialog.get_by_label('Intervalo do rodízio', exact=True).select_option('10')
    dialog.locator('.tv-primary').click()
    expect(page.locator('.tv-dialog')).to_have_count(0)
    expect(page.locator('.tv-summary > div').first.locator('strong')).to_have_text('35')

    open_filters(page)
    frozen_pagination = page.locator('.tv-page-controls').inner_text()
    page.wait_for_timeout(10_500)
    assert page.locator('.tv-page-controls').inner_text() == frozen_pagination, 'Rodízio avançou com filtros abertos'
    close_filters(page)

    for width, height in ((1366, 768), (800, 600), (1920, 1080), (800, 600), (1366, 768)):
        page.set_viewport_size({'width': width, 'height': height})
        page.wait_for_timeout(120)
        page.evaluate('window.tvTestResponsive(35)')
        expect(page.locator('.tv-summary > div').first.locator('strong')).to_have_text('35')
        open_filters(page)
        resized_dialog = page.locator('.tv-dialog')
        expect(resized_dialog.get_by_label('Situação', exact=True)).to_have_value('abertas')
        expect(resized_dialog.get_by_label('Ordenação', exact=True)).to_have_value('fleet')
        resized_dialog.locator('.tv-primary').click()
        expect(page.locator('.tv-summary > div').first.locator('strong')).to_have_text('35')
        assert page.locator('.tv-order').count() > 0, f'Ordens perdidas após resize {width}x{height}'

    # Mesmo com a preferência manual de 12, uma apresentação estreita só mostra a capacidade que cabe.
    ensure_theme(page, 'light')
    page.set_viewport_size({'width': 1236, 'height': 629})
    open_filters(page)
    page.locator('.tv-dialog').get_by_label('Ordens por página', exact=True).select_option('12')
    page.locator('.tv-dialog .tv-primary').click()
    ensure_presentation(page, True)
    manual_capacity = assert_layout(page, 1236, 629, 35, True, 'light')
    effective_page_size = int(page.locator('.tv-monitor').get_attribute('data-page-size') or '0')
    assert effective_page_size <= 12, f'Capacidade manual excedeu 12: {effective_page_size}'
    assert manual_capacity['end'] - manual_capacity['start'] + 1 <= effective_page_size

    assert not errors, errors
    browser.close()

(OUT / 'validacao-tv-cards-responsivos.json').write_text(
    json.dumps(
        {
            'status': 'aprovado',
            'dados': 'fictícios; somente localhost; sem acesso ao banco',
            'viewports': VIEWPORTS,
            'checks': [
                'wrapper tv-board-viewport e rodapé sem sobreposição',
                'cards e footers contidos em todos os viewports',
                'frota/nome e narrativa/datas sem colisão',
                '5 e 35 ordens nos modos normal e apresentação',
                'temas claro e escuro',
                'paginação visita todas as 35 frotas',
                'filtros pausam o rodízio e persistem no resize ida e volta',
                'preferência manual de 12 respeita a capacidade disponível',
                'overflow horizontal global bloqueado',
            ],
            'screenshots': ['repro-1236x629-claro.png', 'TV1920x1080.png'],
        },
        ensure_ascii=False,
        indent=2,
    )
    + '\n'
)
print('OK: responsividade do Modo TV, cards extremos, paginação, filtros, resize e temas; sem tráfego externo.')
