from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect

OUT=Path('/home/ubuntu/entrega-apoio-fundo-referencia')
OUT.mkdir(exist_ok=True)
BASE='http://127.0.0.1:3000'
MOCK=r'''
const date=new Date().toISOString();
const orders=[
 {chave:'OS-15101',os:'159325249',frota:'15101',modelo:'Carretas Área de Vivência',grupo_fonte:'Carretas Área de Vivência',setor:'Ofc. Elétrica',ponto:'Kango 8838',origem:'Campo',prestador:'',status:'Programada',entrada:'2026-10-08T14:45:00-03:00',previsao:'2026-10-30T23:00:00-03:00',narrativa:'Verificar o conjunto elétrico da carreta, revisar conectores e confirmar o funcionamento antes de liberar o equipamento para a operação.',ativo:true,primeira_vista:'2026-10-08T17:50:00Z',ultima_vista:date,ausente_desde:null},
 {chave:'OS-15115',os:'159330468',frota:'15115',modelo:'Carreta Área de Vivência',grupo_fonte:'Carretas',setor:'Ofc. Mecânica',ponto:'Oficina Externa',origem:'Oficina Externa',prestador:'Oficina Externa São João — Especializada em equipamentos e implementos agrícolas',status:'Andamento',entrada:'2026-10-25T09:30:00-03:00',previsao:'2026-12-08T14:40:00-03:00',narrativa:'Inspecionar o sistema de freios e revisar o implemento. '+('Descrição operacional detalhada sem cortes ou sobreposição. '.repeat(12)),ativo:true,primeira_vista:'2026-10-25T12:35:00Z',ultima_vista:date,ausente_desde:null},
 {chave:'OS-LONG',os:'159339999',frota:'FROTA-CODIGO-123456789012345',modelo:'Equipamento com descrição extensa para testar adaptação em monitores pequenos e smartphones',grupo_fonte:'Equipamentos especiais',setor:'Oficina Interna',ponto:'Ponto não informado',origem:'Oficina Interna',prestador:'',status:'Aguardando Peça',entrada:'2026-11-06T07:00:00-03:00',previsao:'',narrativa:'Sem previsão disponível. Aguardando confirmação da peça necessária para executar o serviço.',ativo:true,primeira_vista:date,ultima_vista:date,ausente_desde:null},
 {chave:'OS-HISTORY',os:'159331208',frota:'4626',modelo:'Caminhão',grupo_fonte:'Caminhões',setor:'Lavador',ponto:'Lavador',origem:'Campo',prestador:'',status:'Andamento',entrada:'2026-11-05T07:00:00-03:00',previsao:'2026-11-05T23:00:00-03:00',narrativa:'Ordem ausente; não concluir apenas pelo desaparecimento da fonte.',ativo:false,primeira_vista:'2026-11-05T10:00:00Z',ultima_vista:'2026-11-05T23:00:00Z',ausente_desde:'2026-11-06T02:11:00Z'},
];
const groups=[{id:'vivencia',nome:'Área de Vivência',cor:'#146333'},{id:'especial',nome:'Equipamentos Especiais',cor:'#ad863b'}];
const fleets=orders.map((o,i)=>({frota:o.frota,grupo_id:i<2?'vivencia':'especial',nome:o.modelo}));
const data={orders,groups,fleets,sync:{id:1,fonte_atualizada:date,consultado_em:date,sincronizado_em:date,total:orders.length,erro:null},role:'admin'};
globalThis.__apoioMock={writes:[],reads:0,syncs:0};
export async function loadApoioData(){globalThis.__apoioMock.reads++;return structuredClone(data);}
export async function syncApoio(){globalThis.__apoioMock.syncs++;}
export async function saveApoioFleet(f){globalThis.__apoioMock.writes.push(f);const v=data.fleets.find(x=>x.frota===f.frota);if(v)Object.assign(v,f);}
export async function saveApoioGroup(g){globalThis.__apoioMock.writes.push(g);}
export async function deleteApoioGroup(id){globalThis.__apoioMock.writes.push({deleteGroup:id});}
export async function deleteApoioFleet(frota){globalThis.__apoioMock.writes.push({deleteFleet:frota});}
'''

def open_page(browser,theme,width,height):
    page=browser.new_page(viewport={'width':width,'height':height})
    page.set_default_timeout(8000)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE+'/') else r.abort())
    page.route('**/src/lib/apoioService.ts*',lambda r:r.fulfill(status=200,content_type='application/javascript',body=MOCK))
    page.goto(BASE+'/apoio-premium-test.html?theme='+theme,wait_until='domcontentloaded')
    page.locator('.apoio-order').first.wait_for()
    page.wait_for_timeout(300)
    return page,errors

checks=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for theme,w,h in [('light',320,750),('light',390,844),('light',800,600),('light',1440,1080),('light',1920,1080),('dark',390,844),('glassy-v18',390,844),('glassy-v18',1440,1080)]:
        page,errors=open_page(browser,theme,w,h)
        assert page.locator('.apoio-order').count()==3
        assert page.locator('.apoio-ribbon-layer').count()==1
        assert 'apoio-reference-ribbons.svg' in page.locator('.apoio-ribbon-layer').evaluate('e=>getComputedStyle(e).backgroundImage')
        if w==390 and theme=='light':
            page.screenshot(path=str(OUT/'previa-fundo-claro-celular.png'),full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'Overflow em {theme}/{w}'
        metrics=page.locator('.apoio-order').evaluate_all('''nodes=>nodes.map(e=>{
          const b=e.getBoundingClientRect(); const f=e.querySelector('.apoio-fleet-title').getBoundingClientRect();
          const bottom=e.querySelector('.apoio-card-bottom').getBoundingClientRect();
          return {w:b.width,fleetInside:f.right<=b.right+1,bottomInside:bottom.bottom<=b.bottom+1,color:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor};
        })''')
        assert all(m['fleetInside'] and m['bottomInside'] for m in metrics),(w,metrics)
        assert all(m['bg']=='rgb(255, 255, 255)' for m in metrics),(theme,metrics)
        assert '08/10/2026, 14:45' in page.locator('.apoio-order').first.inner_text()
        assert '30/10/2026, 23:00' in page.locator('.apoio-order').first.inner_text()
        card=page.locator('.apoio-order').filter(has=page.locator('h4',has_text='15101'))
        assert card.locator('.apoio-preview-late').count()==1
        button=card.locator('button.apoio-details-button')
        button.click()
        expect(button).to_have_attribute('aria-expanded','true')
        expect(card.locator('.apoio-observations')).to_be_visible()
        assert card.locator('.apoio-timeline-event').count()==2
        expect(card.get_by_text('Previsão, não confirmação de execução',exact=True)).to_be_visible()
        expect(card.locator('.apoio-narrative-section > .apoio-narrative')).not_to_have_class('apoio-narrative line-clamp-3')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        if theme=='light' and w==390:
            card.screenshot(path=str(OUT/'previa-card-detalhes-celular.png'))
            page.locator('.apoio-hero').screenshot(path=str(OUT/'previa-cabecalho-celular.png'))
        if theme=='light' and w==1440:
            page.screenshot(path=str(OUT/'previa-apoio-desktop.png'),full_page=True)
        if theme=='glassy-v18' and w==390:
            card.screenshot(path=str(OUT/'previa-card-tema-glassy.png'))
        card.locator('.apoio-full-history > summary').click()
        expect(card.locator('.apoio-history-narrative')).to_be_visible()
        card.locator('.apoio-full-history > summary').click()
        button.click()
        expect(card.locator('.apoio-observations')).not_to_be_visible()
        # Callback de atribuição preservado; somente o mock é escrito.
        card.locator('select').select_option('especial')
        page.wait_for_function('window.__apoioMock.writes.length===1')
        assert page.evaluate("window.__apoioMock.writes[0].frota==='15101' && window.__apoioMock.writes[0].grupo_id==='especial'")
        # Filtro de busca do componente real.
        page.locator('.apoio-filter-center > summary').click()
        page.get_by_role('textbox',name='Buscar ordens',exact=True).fill('15115')
        expect(page.locator('.apoio-order')).to_have_count(1)
        page.get_by_role('textbox',name='Buscar ordens',exact=True).fill('')
        page.get_by_role('button',name='Histórico · ausentes na fonte',exact=True).click()
        expect(page.locator('.apoio-order')).to_have_count(1)
        expect(page.locator('.apoio-order').get_by_text('ENCERRADA',exact=True)).to_be_visible()
        expect(page.locator('.apoio-order').get_by_text('Ausente da fonte',exact=True)).to_be_visible()
        assert page.locator('.apoio-order .apoio-preview-late').count()==0
        assert 'Execução não inferida' in page.locator('.apoio-order').inner_text()
        page.get_by_role('button',name='Sincronizar',exact=True).click()
        page.wait_for_function('window.__apoioMock.syncs>=2')
        assert not errors,errors
        checks.append({'theme':theme,'viewport':[w,h],'overflow':False,'cards':metrics,'actions':'detalhes, grupo, busca, histórico e sync aprovados'})
        page.close()
    browser.close()
(OUT/'validacao-apoio-premium.json').write_text(json.dumps({'status':'aprovado','network':'Apoio mockado; nenhuma escrita real no banco','resolutions':checks},ensure_ascii=False,indent=2)+'\n')
print('OK: tema premium em8 combinações; sem overflow; detalhes, grupo, busca, histórico e sincronização com mocks.')
