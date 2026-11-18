const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const os=require('os');const {build}=require('esbuild');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'menu-hierarchy-'));try{
 const out=path.join(dir,'layout.cjs');await build({entryPoints:['src/components/Layout.tsx'],outfile:out,bundle:true,platform:'node',format:'cjs',loader:{'.css':'empty'},plugins:[{name:'react-existing',setup(b){b.onResolve({filter:/^(react|react-dom)$/},args=>({path:require.resolve(args.path),external:true}));}}],logLevel:'silent'});
 const Layout=require(out).default;const props={children:React.createElement('div',null,'Conteúdo'),onNavigate:()=>{},onRefresh:()=>{},syncing:false,lastSync:null,alertCount:0,alerts:[],unreadCount:0,browserPermission:'default',onRequestPermission:()=>{},onMarkAsRead:()=>{},onMarkAllAsRead:()=>{},onClearAll:()=>{}};
 for(const currentPage of ['central-gerencial','programacoes','controle-apoio','reformas-colhedoras','dashboard']){
  const h=renderToStaticMarkup(React.createElement(Layout,{...props,currentPage}));const sections=[...h.matchAll(/data-nav-section="([^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
  assert.deepEqual(sections,['Inteligência Gerencial','Operação & Manutenção','Rotina de Frotas','Controle de Reformas','Carretas Canavieiras','Monitoramento','Sistema']);
  assert.equal((h.match(/is-current-section/g)||[]).length,1);
  assert.ok(h.indexOf('Lavagem / Lubrificação')<h.indexOf('Reformas — Equipamentos Apoio'));
  assert.ok(h.includes('Controle de Equipamentos — Apoio'));assert.ok(h.includes('Modo TV — Ordens Externas'));assert.ok(h.includes('v'+require('../package.json').version.split('.').slice(0,2).join('.')+' — Gestão de Manutenção'));
  if(['programacoes','dashboard'].includes(currentPage))assert.match(h,/<h2 class="shell-nav-section is-current-section" data-nav-section="Rotina de Frotas"/);
 }
 const css=fs.readFileSync('src/styles/shell-theme.css','utf8');assert.ok(css.includes('.shell-nav-section.is-current-section'));assert.ok(css.includes('.shell-nav-item:focus-visible'));
 console.log('OK: ordem das7seções, Rotina após Operação, títulos sem duplicação, destaque da seção atual e módulos preservados.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
