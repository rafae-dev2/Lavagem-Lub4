"""Confere somente leitura da interface nova. Qualquer escrita remota é bloqueada."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True,args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':1440,'height':1100},timezone_id='America/Sao_Paulo')
    page = context.new_page()
    blocked = []
    def protect(route):
        req = route.request
        allowed = req.method in ['GET','HEAD','OPTIONS'] or (req.method=='POST' and any('/rpc/'+rpc in req.url for rpc in ['carregar_lavagem_programacoes','carregar_pcm_revisao','carregar_apoio_controle']))
        if allowed: route.continue_()
        else: blocked.append(req.url); route.abort()
    page.route('**/*.supabase.co/**',protect)
    page.goto('http://127.0.0.1:8769/')
    search = page.get_by_placeholder('Buscar frota, OS, apoio, narrativa...')
    expect(search).to_be_visible(timeout=30000)
    origin = page.locator('select').filter(has=page.locator('option[value="PCM"]')).filter(has=page.locator('option',has_text='Origem: PCM'))
    origin.select_option('PCM')
    search.fill('4508')
    expect(page.locator('table [title="OS 159329765"]').first).to_be_visible(timeout=30000)
    expect(page.locator('table [title="OS 159330811"]').first).to_be_visible(timeout=30000)
    body = page.locator('body').inner_text()
    assert 'Troca de Óleo' in body and 'Lavagem / Lubrificação' in body
    assert 'ATRASADO' in body and 'Caminhão Munck' in body
    page.screenshot(path=str(root/'tests/.tmp/pcm-interface-desktop.png'),full_page=True)
    page.locator('input[type="date"]').last.fill('2026-11-04')
    expect(page.locator('table [title="OS 159330811"]').first).to_be_visible()
    expect(page.locator('table [title="OS 159329765"]').first).not_to_be_visible()
    page.get_by_role('button',name='Limpar semana',exact=True).click()
    search.fill('4588')
    expect(page.locator('table [title="OS 159331192"]').first).to_be_visible()
    page.set_viewport_size({'width':412,'height':915})
    page.wait_for_timeout(600)  # Concluir a transição CSS responsiva do menu lateral.
    page.screenshot(path=str(root/'tests/.tmp/pcm-interface-celular.png'),full_page=True)
    assert not blocked, f'A interface tentou gravar dados: {blocked}'
    browser.close()
print('OK: interface compilada mostra as três OS reais; filtro semanal mantém óleo04/11 e exclui lavagem01/11; desktop/celular verificados sem gravações remotas.')
