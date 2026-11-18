import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(path.resolve('tests/.tmp-image-registry-'));
try{
 await build({entryPoints:['src/lib/equipmentImages.ts','src/lib/equipmentImageRegistry.ts'],outdir:dir,bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'},splitting:true,external:['@supabase/supabase-js'],logLevel:'silent'});
 const registry=await import(pathToFileURL(path.join(dir,'equipmentImageRegistry.mjs')));const images=await import(pathToFileURL(path.join(dir,'equipmentImages.mjs')));
 const metadata={group_id:'grupo1',object_path:'grupo1/arquivo-a.webp',mime_type:'image/webp',bytes:65000,width:400,height:225,updated_at:'2026-11-08T20:00:00Z'};
 let notices=0;const un=registry.subscribeEquipmentImageChanges(()=>notices++);
 registry.setEquipmentImageRegistry([{id:'grupo1',nome:'Caminhão Munck'}],[{frota:'4508',grupo_id:'grupo1'}],[metadata]);
 const original=images.resolveEquipmentImage({frota:'4508',modelo:'Caminhão Pipa'});assert.equal(original.label,'Caminhão Munck');assert.ok(original.src.endsWith('arquivo-a.webp'));assert.equal(images.resolveEquipmentImage({groupId:'apoio:grupo1'}).src,original.src);assert.equal(images.resolveEquipmentImage({apoio:'Caminhão Munck'}).src,original.src);assert.equal(images.resolveEquipmentImage(original).src,original.src);
 registry.setEquipmentImageRegistry([{id:'grupo1',nome:'Caminhão Munck'}],[{frota:'4508',grupo_id:'grupo1'}],[metadata]);assert.equal(notices,1,'releitura idêntica não dispara renderização');
 registry.setEquipmentImageRegistry([{id:'grupo1',nome:'Caminhão Munck'}],[{frota:'4508',grupo_id:'grupo1'}],[{...metadata,object_path:'grupo1/arquivo-b.png'}]);assert.ok(images.resolveEquipmentImage({frota:'4508'}).src.endsWith('arquivo-b.png'),'troca muda URL e invalida cache de mídia');
 assert.equal(registry.isEquipmentStorageImage('https://evil.example/equipamento.png'),false);assert.equal(registry.isEquipmentStorageImage(original.src),true);
 registry.setEquipmentImageRegistry([{id:'grupo1',nome:'Coleta'}],[{frota:'4591',grupo_id:'grupo1'}],[metadata]);assert.ok(images.resolveEquipmentImage({frota:'4591'}).key.startsWith('group:'),'imagem personalizada permite grupo sem ilustração padrão');
 registry.setEquipmentImageRegistry([{id:'grupo1',nome:'Coleta'}],[{frota:'4591',grupo_id:'grupo1'}],[]);assert.equal(images.resolveEquipmentImage({frota:'4591',apoio:'Coleta'}),null,'restaurar padrão elimina override sem fabricar foto');un();
 assert.equal(await images.loadEquipmentImageData(original),null,'Node seguro sem DOM');console.log('OK registro compartilhado: grupo/frota/fonte, substituição com URL nova, cache, restauração e URLs restritas.');
}finally{await rm(dir,{recursive:true,force:true});}
