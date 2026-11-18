from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'tests/.tmp-equipment-editor-auth'

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, url):
        file_name = url.split('?')[0].lstrip('/') or 'index.html'
        candidate = ASSETS / file_name
        return str(candidate if candidate.is_file() else ROOT / 'public' / file_name)
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.goto(base, wait_until='networkidle')
        expect(page.get_by_text('somente leitura', exact=True)).to_be_visible()

        email = page.locator('#equipment-image-editor-email')
        credential = page.locator('#equipment-image-editor-credential')
        email.fill('editor@example.test')
        page.get_by_role('button', name='Enviar link de acesso', exact=True).click()
        page.wait_for_function("globalThis.__equipmentEditorAuthMock.sendPayload !== null")
        sent = page.evaluate('globalThis.__equipmentEditorAuthMock.sendPayload')
        assert sent['email'] == 'editor@example.test'
        assert sent['options']['emailRedirectTo'] == f'{base}/?editor_login=1'
        assert sent['options']['shouldCreateUser'] is True

        page.get_by_role('button', name='Mock inválido', exact=True).click()
        credential.fill('http://localhost:3000/#access_token=not-accepted')
        page.get_by_role('button', name='Confirmar acesso', exact=True).click()
        expect(page.get_by_text('não use a URL localhost', exact=False)).to_be_visible()
        assert page.evaluate('globalThis.__equipmentEditorAuthMock.verifyPayloads.length') == 0

        page.get_by_role('button', name='Mock expirado', exact=True).click()
        credential.fill('123456')
        page.get_by_role('button', name='Confirmar acesso', exact=True).click()
        expect(page.get_by_text('expirou ou já foi usado', exact=False)).to_be_visible()
        expired_payload = page.evaluate('globalThis.__equipmentEditorAuthMock.verifyPayloads.slice(-1)[0]')
        assert expired_payload == {'email': 'editor@example.test', 'token': '123456', 'type': 'email'}
        assert page.get_by_text('somente leitura', exact=True).is_visible()

        page.get_by_role('button', name='Mock sucesso sem permissão', exact=True).click()
        credential.fill('234567')
        page.get_by_role('button', name='Confirmar acesso', exact=True).click()
        expect(page.get_by_text('este e-mail não está autorizado', exact=False)).to_be_visible()
        assert page.get_by_text('somente leitura', exact=True).is_visible(), 'RPC falso mantém edição protegida'

        page.get_by_role('button', name='Mock sucesso autorizado', exact=True).click()
        credential.fill('345678')
        page.get_by_role('button', name='Confirmar acesso', exact=True).click()
        expect(page.get_by_text('editor autorizado', exact=True)).to_be_visible()
        expect(page.locator('#equipment-image-editor-credential')).to_have_count(0)
        assert page.evaluate('globalThis.__equipmentEditorAuthMock.verifyPayloads.slice(-1)[0]') == {'email': 'editor@example.test', 'token': '345678', 'type': 'email'}
        browser.close()
finally:
    server.shutdown()
    server.server_close()
print('OK browser mock: payload de envio, URL localhost rejeitada, OTP expirado, sucesso sem permissão e sucesso autorizado.')
