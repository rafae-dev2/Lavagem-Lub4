from pathlib import Path
from playwright.sync_api import sync_playwright
import base64
import json
import os

root = Path(__file__).resolve().parents[1]
out = Path('/home/ubuntu/entrega-apoio-whatsapp')
out.mkdir(exist_ok=True)
base = dict(modelo='Equipamento de demonstração', grupo_fonte='', setor='', ponto='', prestador='', status='Andamento', entrada='2026-11-04', previsao='', ativo=True, primeira_vista='2026-11-04T10:00:00-03:00', ultima_vista='2026-11-05T08:00:00-03:00', ausente_desde=None, apoio='Grupo de demonstração', equipamento='Equipamento de demonstração')
rows = [
    dict(base, chave='demo-1', os='DEMO-001', frota='4508', origem='Oficina', narrativa='EXEMPLO FICTÍCIO: vazamento na linha hidráulica. Verificar conexões e informar previsão de liberação.'),
    dict(base, chave='demo-2', os='DEMO-002', frota='4512', origem='Terceiro', prestador='Fratini', narrativa='EXEMPLO FICTÍCIO: falha no sistema de freios. Informar o diagnóstico e a previsão do reparo.'),
]
options = dict(rows=rows, filters=['FILTER_CANARY: Apoio secreto', 'FILTER_CANARY: Oficina externa'], sourceUpdated='2026-11-05T08:00:00-03:00', lastSynced='2026-11-05T08:30:00-03:00', view='Demonstração', sourceError=None)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':480,'height':900}, device_scale_factor=2)
    page.goto(os.environ.get('APOIO_TEST_URL', 'http://127.0.0.1:8768/tests/.tmp-whatsapp/index.html'))
    page.wait_for_function('window.inspectWhatsApp !== undefined')
    small = page.evaluate('options => window.inspectWhatsApp(options)', options)
    assert all(w == 480 for w in small['widths'])
    assert 'Oficina Interna' in small['text'] and 'Oficina Externa' in small['text']
    assert 'Fratini' in small['text'], 'Nome da oficina externa precisa aparecer' 
    assert 'Por favor, informar andamento e previsão.' in small['text']
    original = json.dumps(options, sort_keys=True)
    long_options = {**options, 'rows':[{**rows[0], 'narrativa':('Texto técnico completo sem cortes. Equipamento com ruído e falha hidráulica. 🔧 ' * 80).strip()}]}
    long_result = page.evaluate('options => window.inspectWhatsApp(options)', long_options)
    assert long_result['pages'] > 1
    history_options = {**options, 'sourceError':'erro de sincronização', 'rows':[{**rows[0], 'ativo':False, 'narrativa':''}]}
    history = page.evaluate('options => window.inspectWhatsApp(options)', history_options)
    assert 'Histórico: confirmar situação atual.' in history['text']
    assert 'Atualização pendente.' in history['text']
    assert 'Descrição não informada.' in history['text']
    for quality, size in [('alta',(960,1800)), ('ultra',(1440,2700))]:
        result = page.evaluate('([options,quality]) => window.generateWhatsApp(options,quality)', [options,quality])
        for image in result:
            assert image['width'] == size[0] and 300 < image['height'] <= size[1]
            assert image['bytes'] > 10000
            data = base64.b64decode(image['dataUrl'].split(',')[1])
            assert data.startswith(b'\x89PNG\r\n\x1a\n')
        if quality == 'alta':
            (out/'demonstracao-relatorio-whatsapp.png').write_bytes(base64.b64decode(result[0]['dataUrl'].split(',')[1]))
        print(f'OK PNG {quality}: {len(result)} páginas, {size}', flush=True)
    assert original == json.dumps(options, sort_keys=True)
    browser.close()
print(f'OK: narrativa integral em {long_result["pages"]} páginas, filtros ocultos, oficinas, histórico, fallback e PNG móvel.', flush=True)
