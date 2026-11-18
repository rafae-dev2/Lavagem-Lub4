import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir=await mkdtemp(path.resolve('tests/.tmp-classification-'));
try {
 await build({entryPoints:['src/lib/maintenanceTracking.ts'],outfile:path.join(dir,'tracking.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'});
 const {buildTrackingRows}=await import(pathToFileURL(path.join(dir,'tracking.mjs')));
 const base={chave:'99999::AUDIT',os:'AUDIT',frota:'99999',modelo:'Carreta Canavieira',grupo_fonte:'',setor:'Mecânica',ponto:'Preventiva',origem:'Oficina',prestador:'',status:'Programada',entrada:'2026-11-08',previsao:'2026-11-09',narrativa:'',classe:'PREVENTIVA',motivo:'',ativo:true,primeira_vista:'2026-11-08T08:00:00-03:00',ultima_vista:'2026-11-08T08:00:00-03:00',ausente_desde:null};
 const data={groups:[{id:'apoio',nome:'Equipamentos Apoio',cor:'#18733d'}],fleets:[{frota:'99999',grupo_id:'apoio',nome:'Implemento de apoio'}],orders:[],sync:null,role:'admin'};
 for(const modelo of ['Caminhão Carreta Canavieira','Cavalo com Carreta Canavieira']) assert.equal(buildTrackingRows({...data,orders:[{...base,modelo}]},'preventivas').length,0,'Caminhão/cavalo não se transforma em carreta');
 const graxagem={...base,motivo:'Graxagem dos pontos'};
 assert.equal(buildTrackingRows({...data,orders:[graxagem]},'lubrificacao').length,1);
 assert.equal(buildTrackingRows({...data,orders:[graxagem]},'preventivas').length,0);
 assert.equal(buildTrackingRows({...data,orders:[{...base,classe:'',motivo:'Reformando o implemento'}]},'reformas').length,1);
 console.log('OK: regressões da auditoria — cavalo/caminhão, graxagem e reformando.');
} finally {await rm(dir,{recursive:true,force:true});}
