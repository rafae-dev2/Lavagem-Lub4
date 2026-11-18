"""Teste finito no navegador local, sem chamadas ao Supabase ou alterações em dados reais."""
import json
import sys
import zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

root = Path(__file__).resolve().parents[1]
out = root / 'tests/.tmp'
source = json.loads(Path(sys.argv[1]).read_text())
rows = []
for order in source['ordens'][:12]:
    rows.append(dict(chave=f"{order['eq']}|{order['os']}", os=str(order['os']), frota=str(order['eq']), modelo=order.get('modelo', ''), grupo_fonte=order.get('grupo', ''), setor=order.get('setor', ''), ponto=order.get('ponto', ''), origem=order.get('origem', ''), prestador=order.get('prestador', ''), status=order.get('status', ''), entrada=order.get('entrada', ''), previsao=order.get('prev', ''), narrativa=order.get('narrativa', ''), ativo=True, primeira_vista=source['atualizado'], ultima_vista=source['atualizado'], ausente_desde=None, apoio='Amostra técnica — sem classificação própria', equipamento=order.get('modelo', '')))
options = dict(rows=rows, filters=['filterCanary — filtro que não deve aparecer', 'Local: todos', 'Status: todos'], sourceUpdated=source['atualizado'], lastSynced=source['atualizado'], view='VIEW_CANARY', sourceError='Dados desatualizados para teste.')
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
    page.goto('http://127.0.0.1:8767/tests/.tmp/image-test.html')
    page.wait_for_function('window.testImages !== undefined')
    for format in ['celular', 'desktop', 'instagram-feed', 'instagram-story']:
        result = page.evaluate('async ([options,format]) => window.testImages(options,format)', [options, format])
        print('OK composição:', json.dumps(result, ensure_ascii=False), flush=True)
    # Texto longo verifica a continuação sem cortes em formato de feed.
    long_options = {**options, 'rows': [{**rows[0], 'narrativa': rows[0]['narrativa'] * 12}]}
    print('OK continuação:', page.evaluate('async (options) => window.testImages(options,"instagram-feed")', long_options), flush=True)
    small = {**options, 'rows': rows[:1], 'filters': ['Amostra técnica — equipamento não cadastrado como próprio']}
    for format, expected in [('desktop', (3840,2160)), ('instagram-feed', (2160,2700)), ('celular',(2160,3840))]:
        with page.expect_download(timeout=120000) as download_info:
            page.evaluate('async ([options,format]) => window.downloadImages(options,format,"ultra")', [small, format])
        download = download_info.value
        path = out / download.suggested_filename
        download.save_as(path)
        if path.suffix == '.zip':
            with zipfile.ZipFile(path) as z:
                names = z.namelist()
                assert names and all(name.endswith('.png') for name in names)
                z.extract(names[0], out)
                image = out / names[0]
        else:
            image = path
        with Image.open(image) as img:
            assert img.size == expected, (format, img.size, expected)
        (out / f'preview-{format}.png').write_bytes(image.read_bytes())
        print('OK PNG Ultra:', format, expected, flush=True)
    browser.close()
