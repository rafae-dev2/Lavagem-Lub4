const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const os=require('os');const {build}=require('esbuild');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'date-formatter-cache-'));const Native=Intl.DateTimeFormat;try{
 const out=path.join(dir,'tracking.cjs');await build({entryPoints:['src/lib/maintenanceTracking.ts'],outfile:out,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
 const expectedFormatter=new Native('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});let constructions=0;Intl.DateTimeFormat=new Proxy(Native,{construct(target,args){constructions++;return Reflect.construct(target,args);}});
 const {parseTrackingDate}=require(out);const afterImport=constructions;
 for(let i=0;i<200;i++){
  const raw=i%2?'2026-11-08T02:00:00Z':'2026-11-08T14:35:00-03:00';const parsed=parseTrackingDate(raw);assert.ok(parsed);
  const parts=Object.fromEntries(expectedFormatter.formatToParts(new Date(raw)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));assert.equal(parsed.dateKey,`${parts.year}-${parts.month}-${parts.day}`);
 }
 assert.equal(constructions,afterImport,'parseTrackingDate não deve construir Intl a cada data');assert.ok(afterImport>=1);assert.equal(parseTrackingDate('2026-02-31'),null);assert.equal(parseTrackingDate('não-data'),null);
 console.log('OK: formatador temporal reutilizado,200datas UTC/Brasília equivalentes e calendário inválido rejeitado.');
 }finally{Intl.DateTimeFormat=Native;fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
