import struct
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'tests/.tmp-oficina-terceiros-ui'
OUT = Path('/home/ubuntu/output/evidencias')
OUT.mkdir(parents=True, exist_ok=True)


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, url):
        name = url.split('?')[0].lstrip('/') or 'index.html'
        candidate = ASSETS / name
        if candidate.is_file():
            return str(candidate)
        return str(ROOT / 'public' / name)

    def log_message(self, *args):
        pass


def png_size(path):
    raw = Path(path).read_bytes()
    assert raw[:8] == b'\x89PNG\r\n\x1a\n', 'arquivo baixado não é PNG'
    width, height = struct.unpack('>II', raw[16:24])
    return width, height, len(raw)


server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'


def open_app(browser, viewport):
    page = browser.new_page(viewport=viewport, accept_downloads=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) or route.request.url.startswith('data:') or route.request.url.startswith('blob:') else route.abort())
    page.goto(base + '/', wait_until='networkidle')
    return page, errors


try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        page, errors = open_app(browser, {'width': 1366, 'height': 900})

        # O painel de imagem começa minimizado e abre quando o usuário escolhe clicar no cabeçalho.
        panel = page.locator('details.apoio-image-reports')
        expect(panel).to_have_count(1)
        assert not panel.evaluate('element => element.open'), 'painel Relatórios em imagem deve iniciar minimizado'
        panel.locator('> summary').click()
        assert panel.evaluate('element => element.open'), 'painel Relatórios em imagem deve abrir ao clicar'
        expect(panel.get_by_role('heading', name='Equipamentos em Oficina de Terceiros')).to_be_visible()
        expect(panel.get_by_role('heading', name='Imagem premium')).to_be_visible()
        expect(panel.get_by_text('2 de 2 equipamentos em oficina de terceiros · PNG 921 px de largura', exact=True)).to_be_visible()
        expect(panel.get_by_text('2 de 2 marcados', exact=True)).to_be_visible()

        preview = panel.get_by_role('group', name='Equipamentos que sairão no relatório')
        expect(preview.get_by_role('checkbox')).to_have_count(2)
        box_4508 = preview.get_by_role('checkbox', name='Incluir frota 4508 no relatório')
        box_4512 = preview.get_by_role('checkbox', name='Incluir frota 4512 no relatório')
        assert box_4508.is_checked() and box_4512.is_checked(), 'todos começam marcados'

        # Desmarcar um equipamento individual: sai do PNG e o aviso muda.
        box_4512.uncheck()
        expect(panel.get_by_text('1 de 2 marcados', exact=True)).to_be_visible()
        expect(panel.get_by_text('1 desmarcado não sai no PNG', exact=True)).to_be_visible()
        expect(panel.get_by_text('1 de 2 equipamentos em oficina de terceiros · PNG 921 px de largura', exact=True)).to_be_visible()
        assert 'is-unmarked' in box_4512.evaluate('element => element.closest("label").className')

        # Download direto: um único PNG, sem ZIP.
        with page.expect_download() as download_info:
            panel.get_by_role('button', name='Baixar imagem PNG').click()
        download = download_info.value
        target = OUT / 'equipamentos-oficina-terceiros-selecao-v10.28.png'
        download.save_as(str(target))
        width, height, size = png_size(target)
        assert download.suggested_filename.startswith('equipamentos-oficina-terceiros-'), download.suggested_filename
        assert download.suggested_filename.endswith('.png'), download.suggested_filename
        assert not download.suggested_filename.endswith('.zip'), 'não deve baixar ZIP'
        assert (width, height) == (921, 1600), (width, height)
        assert size > 30000, size
        expect(page.get_by_text('Equipamentos em Oficina de Terceiros: imagem PNG 921 × 1600 baixada com 1 equipamento.')).to_be_visible()

        # Desmarcar todos desabilita a exportação; Marcar todos devolve tudo.
        panel.get_by_role('button', name='Desmarcar todos', exact=True).click()
        expect(panel.get_by_text('0 de 2 marcados', exact=True)).to_be_visible()
        expect(panel.get_by_text('2 desmarcados não saem no PNG', exact=True)).to_be_visible()
        export_button = panel.get_by_role('button', name='Baixar imagem PNG')
        assert export_button.is_disabled(), 'sem equipamentos marcados o download fica bloqueado'
        panel.get_by_role('button', name='Marcar todos', exact=True).click()
        expect(panel.get_by_text('2 de 2 marcados', exact=True)).to_be_visible()
        assert panel.get_by_role('button', name='Marcar todos', exact=True).is_disabled(), 'com tudo marcado não há o que remarcar'

        # Busca própria do relatório: não mexe na lista de ordens.
        search = panel.get_by_label('Pesquisar equipamento ou oficina', exact=True)
        search.fill('fratini')
        expect(panel.get_by_text('1 de 1 marcados', exact=True)).to_be_visible()
        expect(preview.get_by_role('checkbox')).to_have_count(1)
        assert '4508' in preview.inner_text() and '4512' not in preview.inner_text()
        expect(page.locator('.apoio-order, .apoio-table-row, .mt-card-grid > *')).to_have_count(3)

        # Dentro do filtro, desmarcar o único visível também vale.
        preview.get_by_role('checkbox', name='Incluir frota 4508 no relatório').uncheck()
        expect(panel.get_by_text('0 de 1 marcados', exact=True)).to_be_visible()
        assert export_button.is_disabled()
        panel.get_by_role('button', name='Marcar todos', exact=True).click()
        expect(panel.get_by_text('1 de 1 marcados', exact=True)).to_be_visible()

        # Limpar filtros do relatório devolve os dois equipamentos.
        panel.get_by_role('button', name='Limpar filtros do relatório').click()
        expect(panel.get_by_text('2 de 2 marcados', exact=True)).to_be_visible()

        # Seleção por oficina, além da busca livre.
        panel.get_by_role('button', name='Filtrar Oficina de terceiro').click()
        panel.get_by_role('checkbox', name='SERGIO MAIA ADAMANTINA - ME').check()
        page.keyboard.press('Escape')
        expect(panel.get_by_text('1 de 1 marcados', exact=True)).to_be_visible()
        assert '4512' in preview.inner_text() and '4508' not in preview.inner_text()
        panel.get_by_role('button', name='Limpar filtros do relatório').click()
        expect(panel.get_by_text('2 de 2 marcados', exact=True)).to_be_visible()

        assert not errors, errors
        panel.screenshot(path=str(OUT / 'painel-relatorios-imagem-selecao-computador-v10.28.png'))

        # Celular em pé: inicia minimizado e, ao abrir, mantém caixas de seleção e botão legíveis.
        mobile, mobile_errors = open_app(browser, {'width': 390, 'height': 844})
        mobile_panel = mobile.locator('details.apoio-image-reports')
        assert not mobile_panel.evaluate('element => element.open'), 'mobile também inicia minimizado'
        mobile_panel.locator('> summary').click()
        expect(mobile_panel.get_by_role('checkbox', name='Incluir frota 4508 no relatório')).to_be_visible()
        expect(mobile_panel.get_by_role('button', name='Baixar imagem PNG')).to_be_visible()
        mobile_panel.screenshot(path=str(OUT / 'painel-relatorios-imagem-selecao-celular-v10.28.png'))
        assert not mobile_errors, mobile_errors
        mobile.close()

        browser.close()
    print('OK: painel Relatórios em imagem com seleção individual, Marcar/Desmarcar todos, busca e oficina, download direto de um PNG 921 × 1600 (sem ZIP).')
finally:
    server.shutdown()
