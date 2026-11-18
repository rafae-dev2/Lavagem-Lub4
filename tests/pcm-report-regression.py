"""Verificação local dos geradores, sem acesso ou gravação ao Supabase."""
import json
import base64
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
j = json.loads((root/'tests/fixtures/pcm-ordens-exemplo.json').read_text())
orders = [o for o in j['ordens'] if str(o['os']) in ['159329765','159330811','159331192']]
rows = []
for o in orders:
    rows.append(dict(id='pcm-'+o['os'], frota=o['eq'], descricaoPonto='LAVADOR', tipoPreventiva='Troca de Óleo' if o['os']=='159330811' else 'Lavagem / Lubrificação', dataProgramada=o['entrada'][:10], horarioAgendado=o['entrada'][11:16], situacao='ATRASADO' if o['entrada'][:10]<'2026-11-04' else 'PROGRAMADO', dataRealizada='', observacao='OS '+o['os']))
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True,args=['--no-sandbox'])
    page = browser.new_page()
    page.goto('http://127.0.0.1:8768/tests/.tmp/pcm-test.html')
    page.wait_for_function('Boolean(window.render_before && window.render_after)')
    themes = ['light','dark','ocean','sunset','forest','midnight','rose','arctic','copper','lavender','glass']
    for theme in themes:
        for size in ['original','instagram','whatsapp']:
            result = page.evaluate('async ([rows,theme,size]) => { const before=await window.render_before(rows,theme,size); const after=await window.render_after(rows,theme,size); return {same:before===after,after}; }',[rows,theme,size])
            assert result['same'], f'Relatório diferente: {theme}/{size}'
            if theme=='light' and size=='original':
                (root/'tests/.tmp/pcm-relatorio-amostra.png').write_bytes(base64.b64decode(result['after'].split(',')[1]))
        print('OK desenho idêntico:',theme,'nos três formatos',flush=True)
    browser.close()
print('OK: 33 combinações de tema/formato preservadas com as três ordens reais dos exemplos.')
