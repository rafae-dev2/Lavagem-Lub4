const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const os=require('os');const {build}=require('esbuild');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'closed-header-'));try{
 const out=path.join(dir,'layout.cjs');await build({entryPoints:['src/components/Layout.tsx'],outfile:out,bundle:true,platform:'node',format:'cjs',loader:{'.css':'empty'},plugins:[{name:'react-existing',setup(b){b.onResolve({filter:/^(react|react-dom)$/},args=>({path:require.resolve(args.path),external:true}));}}],logLevel:'silent'});
 const Layout=require(out).default;const props={children:React.createElement('div',null,'Conteúdo'),onNavigate:()=>{},onRefresh:()=>{},syncing:false,lastSync:null,alertCount:0,alerts:[],unreadCount:0,browserPermission:'default',onRequestPermission:()=>{},onMarkAsRead:()=>{},onMarkAllAsRead:()=>{},onClearAll:()=>{},onToggleEncerradas:()=>{}};
 for(const currentPage of ['dashboard','programacoes','calendario','exportar']){
  const h=renderToStaticMarkup(React.createElement(Layout,{...props,currentPage,hideEncerradas:true}));assert.ok(h.includes('aria-label="Mostrar encerradas"'));
  const shown=renderToStaticMarkup(React.createElement(Layout,{...props,currentPage,hideEncerradas:false}));assert.ok(shown.includes('aria-label="Ocultar encerradas antigas"'));
 }
 const app=fs.readFileSync('src/App.tsx','utf8');assert.ok(app.includes('<Calendario schedules={visibleSchedules}'));assert.ok(app.includes('<Exportar schedules={visibleSchedules}'));assert.ok(app.includes('setManualHideEncerradas(hidden, new Date())'));
 assert.ok(app.includes('bp:apoio-refresh'));
 console.log('OK: controle global Mostrar encerradas/ocultar para Dashboard, Programações, Calendário e Exportação; preferências compartilhadas e atualização Apoio conectada.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
