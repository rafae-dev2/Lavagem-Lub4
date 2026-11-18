from pathlib import Path
from playwright.sync_api import sync_playwright
import base64
import subprocess
import json
import os

out = Path('/home/ubuntu/entrega-apoio-arquivo-unico')
out.mkdir(exist_ok=True)
base = dict(modelo='Demonstração', grupo_fonte='', setor='', ponto='', status='Andamento', entrada='2026-11-04', previsao='', ativo=True, primeira_vista='2026-11-04T10:00:00-03:00', ultima_vista='2026-11-05T08:00:00-03:00', ausente_desde=None, apoio='Demonstração', equipamento='Demonstração')
rows = [dict(base, chave=f'demo-{i}', os=f'DEMO-{i:03}', frota=str(4508+i), origem='Terceiro' if i%2 else 'Oficina', prestador='Fratini' if i%2 else '', narrativa=f'EXEMPLO FICTÍCIO {i}: verificar vazamento e ruído do equipamento. Informar andamento e previsão de liberação.') for i in range(5)]
options = dict(rows=rows, filters=['FILTER_CANARY: Local / grupo'], sourceUpdated='2026-11-05T08:00:00-03:00', lastSynced='2026-11-05T08:30:00-03:00', view='Demonstração', sourceError=None)
original = json.dumps(options, sort_keys=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':480,'height':900}, device_scale_factor=2)
    page.goto(os.environ.get('APOIO_UNICO_TEST_URL','http://127.0.0.1:8768/tests/.tmp-whatsapp/unico.html'))
    page.wait_for_function('window.inspectSingle !== undefined')
    check = page.evaluate('options => window.inspectSingle(options)', options)
    assert check['previousPages'] > 1 and check['singlePages'] == 1 and check['cards'] == len(rows)
    assert 'Fratini' in check['text'] and check['height'] > 900
    image = page.evaluate('options => window.generateSingle(options)', options)
    assert len(image) == 1 and image[0]['width'] == 960 and image[0]['height'] > 1800
    assert image[0]['filename'].endswith('-imagem-unica.png')
    png = base64.b64decode(image[0]['dataUrl'].split(',')[1])
    assert png.startswith(b'\x89PNG\r\n\x1a\n')
    (out/'demonstracao-imagem-unica.png').write_bytes(png)
    pdf = page.evaluate('options => window.generateSinglePDF(options)', options)
    assert pdf['pages'] == check['previousPages']
    pdf_path = out/'demonstracao-relatorio-unico.pdf'
    data = base64.b64decode(pdf['dataUrl'].split(',')[1]); assert data.startswith(b'%PDF')
    pdf_path.write_bytes(data)
    info = subprocess.check_output(['pdfinfo',str(pdf_path)],text=True)
    assert f"Pages:           {pdf['pages']}" in info
    oversized = {**options, 'rows':[{**rows[0], 'narrativa':'Texto longo integral. ' * 4000}]}
    limit = page.evaluate('options => window.checkSingleLimit(options)', oversized)
    assert 'PDF único' in limit
    assert original == json.dumps(options, sort_keys=True)
    assert page.locator('[data-whatsapp-page]').count() == 0
    browser.close()
print(f"OK: todas as {len(rows)} ordens em um PNG {image[0]['width']}x{image[0]['height']}; PDF único com {pdf['pages']} páginas; modo anterior preservado; limite sem corte.", flush=True)
