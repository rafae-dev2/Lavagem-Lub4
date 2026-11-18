import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(path.resolve('tests/.tmp-source-'));
try {
  await build({ entryPoints: ['supabase/functions/sync-ordens/validation.ts'], outfile: path.join(dir, 'source.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { validateSourcePayload: validate, SourceValidationError } = await import(pathToFileURL(path.join(dir, 'source.mjs')));
  const now = new Date('2026-11-08T03:00:00Z');
  const order = { os:'T-1',eq:'23677',modelo:'Carreta',grupo:'Canavieiras',setor:'Mecânica',ponto:'Ponto',origem:'Oficina',prestador:'',status:'Programada',entrada:'2026-11-07',prev:null,narrativa:'Preventiva' };
  const payload = { ok:true,total:1,atualizado:now.toISOString(),ordens:[order] };
  assert.equal(validate(payload,now).ordens[0].prev,'', 'Previsão null legítima preservada como não informada');
  assert.equal(validate({...payload,ordens:[{...order,eq:''}]},now).ordens[0].eq,'SEM-FROTA');
  for (const field of ['os','eq','modelo','grupo','setor','ponto','origem','prestador','status','entrada','prev','narrativa']) {
    const incomplete={...order};delete incomplete[field];
    assert.throws(()=>validate({...payload,ordens:[incomplete]},now),SourceValidationError, `Campo obrigatório ${field} omitido deve rejeitar fotografia`);
  }
  assert.throws(()=>validate({...payload,ordens:[{os:'T-1',eq:'23677'}]},now),SourceValidationError);
  assert.throws(()=>validate({...payload,total:2},now),SourceValidationError);
  assert.throws(()=>validate({...payload,atualizado:'2026-11-08T01:00:00Z'},now),SourceValidationError);
  assert.throws(()=>validate({...payload,total:2,ordens:[order,order]},now),SourceValidationError);
  assert.equal(validate(payload,now).ordens[0].classe,'', 'Fonte antiga sem campos estruturados segue compatível');
  console.log('OK: contrato da fonte — omissão bloqueada, previsão null legítima, SEM-FROTA, campos opcionais, idade, total e duplicata. Sem banco/rede.');
} finally { await rm(dir,{recursive:true,force:true}); }
