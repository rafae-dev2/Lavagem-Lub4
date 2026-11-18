const assert=require('node:assert/strict');const {build}=require('esbuild');const fs=require('fs');const path=require('path');const os=require('os');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bp-sync-error-'));try{
 const out=path.join(dir,'sync.cjs');
 await build({entryPoints:['src/lib/apoioService.ts'],outfile:out,bundle:true,platform:'node',format:'cjs',logLevel:'silent',plugins:[{name:'fake-client',setup(b){b.onResolve({filter:/@supabase\/supabase-js/},()=>({path:'fake-client',namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:`export function createClient(){return {functions:{invoke:async()=>({data:null,error:{name:'FunctionsFetchError',message:'Failed to send a request to the Edge Function'}})}}}`,loader:'js'}));}}]});
 const {syncApoio}=require(out);await assert.rejects(syncApoio(),/conexão.*autorizado.*CORS/i);await assert.rejects(syncApoio(),/fotografia.*não foi alterada/i,'falha não é suprimida pelo throttle');
 console.log('OK: erro rede/CORS explicado em português, fotografia preservada e nova tentativa permitida. Sem rede/banco.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
