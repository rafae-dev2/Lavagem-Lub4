from playwright.sync_api import sync_playwright, expect

BASE='http://127.0.0.1:3000'
MOCK=r'''
const state=window.__apoioTVMock ||= {reads:0,failNext:true};
export const apoioClient={
 channel(){const ch={on(){return ch},subscribe(callback){setTimeout(()=>callback('CLOSED'),10);return ch}};return ch},
 removeChannel(){return Promise.resolve()}
};
export async function loadApoioData(){
 state.reads++;
 if(state.failNext){state.failNext=false;throw new Error('falha simulada de leitura ao Supabase')}
 return {orders:[{chave:'tv-proof',frota:'15101'}],groups:[],fleets:[],sync:{fonte_atualizada:new Date().toISOString(),sincronizado_em:new Date().toISOString()}};
}
'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page()
 page.add_init_script("Object.defineProperty(Navigator.prototype,'onLine',{configurable:true,get:()=>false}); window.__apoioTVMock={reads:0,failNext:true};")
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE+'/') else r.abort())
 page.route('**/src/lib/apoioService.ts*',lambda r:r.fulfill(status=200,content_type='application/javascript',body=MOCK))
 page.goto(BASE+'/tv-offline-recovery-test.html',wait_until='domcontentloaded')
 expect(page.get_by_test_id('online')).to_contain_text('false')
 expect(page.get_by_test_id('error')).to_contain_text('falha simulada')
 page.wait_for_function('window.__apoioTVMock.reads===1')
 assert page.get_by_test_id('count').inner_text().endswith('sem dados')
 page.get_by_role('button',name='Tentar leitura').click()
 page.wait_for_function('window.__apoioTVMock.reads===2')
 expect(page.get_by_test_id('count')).to_contain_text('1')
 expect(page.get_by_test_id('error')).to_contain_text('nenhum')
 expect(page.get_by_test_id('connection')).to_contain_text('polling')
 # Evento de retoma continua a provocar leitura mesmo se o getter permanece false.
 page.evaluate("window.__apoioTVMock.failNext=true; window.dispatchEvent(new Event('online'))")
 page.wait_for_function('window.__apoioTVMock.reads===3')
 expect(page.get_by_test_id('error')).to_contain_text('falha simulada')
 expect(page.get_by_test_id('count')).to_contain_text('1')
 page.evaluate("window.__apoioTVMock.failNext=false; document.dispatchEvent(new Event('visibilitychange'))")
 page.wait_for_function('window.__apoioTVMock.reads===4')
 expect(page.get_by_test_id('count')).to_contain_text('1')
 assert not errors,errors
 page.close()
 live=browser.new_page()
 live.add_init_script("window.__apoioTVMock={reads:0,failNext:false};")
 live.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE+'/') else r.abort())
 live.route('**/src/lib/apoioService.ts*',lambda r:r.fulfill(status=200,content_type='application/javascript',body=MOCK.replace("callback('CLOSED')","callback('SUBSCRIBED')")))
 live.goto(BASE+'/tv-offline-recovery-test.html',wait_until='domcontentloaded')
 expect(live.get_by_test_id('connection')).to_contain_text('live')
 live.wait_for_function('window.__apoioTVMock.reads>=2')
 for event in ['online','visibilitychange']:
  count=live.evaluate('window.__apoioTVMock.reads')
  live.evaluate("event=>{if(event==='online')window.dispatchEvent(new Event(event));else document.dispatchEvent(new Event(event));}",event)
  live.wait_for_function('n=>window.__apoioTVMock.reads>n',arg=count)
  expect(live.get_by_test_id('connection')).to_contain_text('live')
 live.close()
 browser.close()
print('OK: navigator.onLine=false não bloqueia o RPC inicial, a repetição manual nem a retoma; última fotografia preservada após erro. Nenhuma chamada ao banco real.')
