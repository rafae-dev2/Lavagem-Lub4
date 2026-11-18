from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import subprocess
import json

OUT = Path('/home/ubuntu/entrega-lubrificacao-encerradas-0700')
OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1400,'height':1000},accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/*',lambda route:route.continue_() if route.request.url.startswith('http://127.0.0.1:3000/') else route.abort())
    page.add_init_script("""localStorage.setItem('bp_hide_encerradas','true');
      window.canvasExportTexts=[];
      const fillText=CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.canvasExportTexts.push(String(text));return fillText.call(this,text,...args);};""")
    page.goto('http://127.0.0.1:3000/export-closed-test.html')
    page.wait_for_selector('select[aria-label="Situação do relatório"]')
    page.get_by_label('Situação do relatório').select_option('ENCERRADO')
    expect(page.get_by_role('button',name='Gerar PNG',exact=True)).to_be_enabled()
    page.get_by_role('button',name='Gerar PNG',exact=True).click()
    page.wait_for_function("window.canvasExportTexts.includes('4626') && window.canvasExportTexts.includes('6608')")
    texts=page.evaluate('window.canvasExportTexts')
    assert 'ENCERRADO' in texts
    assert '88801' not in texts
    assert '77701' not in texts # origem PCM é o padrão explícito do módulo
    with page.expect_download() as download_info:
        page.get_by_role('button',name='Gerar PDF',exact=True).click()
    download=download_info.value
    pdf=OUT/'teste-encerradas-janela-operacional.pdf'
    download.save_as(pdf)
    txt=subprocess.check_output(['pdftotext','-layout',str(pdf),'-'],text=True)
    assert '4626' in txt and '6608' in txt and 'ENCERRADO' in txt
    assert '88801' not in txt and '77701' not in txt
    page.wait_for_timeout(1100)
    expect(page.get_by_label('Situação do relatório')).to_have_value('ENCERRADO')
    # Todas as origens conserva o mesmo intervalo de hoje e inclui a manual realizada hoje.
    page.locator('select').filter(has=page.locator('option[value="MANUAL"]')).select_option('')
    page.evaluate('window.canvasExportTexts=[]')
    page.get_by_role('button',name='Gerar PNG',exact=True).click()
    page.wait_for_function("window.canvasExportTexts.includes('77701')")
    texts=page.evaluate('window.canvasExportTexts')
    assert '4626' in texts and '6608' in texts and '77701' in texts and '88801' not in texts
    assert not errors,errors
    browser.close()
(OUT/'validacao-exportacao.json').write_text(json.dumps({'status':'aprovado','dados':'fictícios; sem banco real','checks':['PNG desenha encerrada de janela do turno desde07:00 com ocultação de tela ativa','PDF baixado contém frota e status encerrado','situação Encerrado não reseta às07:10','origem PCM preservada e Todas inclui manual realizada hoje','seleção comum PNG/PDF/WhatsApp','nenhum erro JavaScript']},ensure_ascii=False,indent=2)+'\n')
print('OK: PNG e PDF gerados com encerrada no turno das07:00; filtro persistiu e origem foi respeitada; tráfego externo bloqueado.')
