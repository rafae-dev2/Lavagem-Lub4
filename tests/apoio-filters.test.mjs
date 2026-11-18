// Fixtures exclusivamente de teste; não são dados operacionais nem são publicadas na interface.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const temp = await mkdtemp(path.join(tmpdir(), 'apoio-test-'));
try {
  await build({ entryPoints: ['src/lib/apoioFilters.ts', 'src/types/apoio.ts'], bundle: true, outdir: temp, format: 'esm', platform: 'node' });
  const { apoioBaseRows, filterApoioRows } = await import(pathToFileURL(path.join(temp, 'lib/apoioFilters.js')));
  const { oficinaLabel, diasEmAberto } = await import(pathToFileURL(path.join(temp, 'types/apoio.js')));
  const order = (frota, os, origem, status, ativo = true) => ({ chave: `${frota}|${os}`, frota, os, origem, status, ativo, modelo: 'Modelo de teste', grupo_fonte: '', setor: '', ponto: '', prestador: origem === 'Terceiro' ? 'Prestador de teste' : '', entrada: '2026-01-01T09:00:00', previsao: '', narrativa: 'Serviço de teste', primeira_vista: '', ultima_vista: '', ausente_desde: ativo ? null : '2026-02-01T10:00:00Z' });
  const data = { groups: [{ id: 'g1', nome: 'Grupo teste 1', cor: '#00aa00' }, { id: 'g2', nome: 'Grupo teste 2', cor: '#0000aa' }], fleets: [{ frota: '001', nome: '', grupo_id: 'g1' }, { frota: '002', nome: 'Nome definido', grupo_id: 'g2' }], orders: [order('001', '1', 'Oficina', 'Programada'), order('001', '2', 'Terceiro', 'Andamento'), order('002', '3', 'Campo', 'Aguardando Peça'), order('999', '4', 'Oficina', 'Andamento'), order('001', '5', 'Terceiro', 'Andamento', false)], role: 'admin', sync: null };
  const empty = { query: '', groups: [], location: '', status: '', provider: '' };
  const own = apoioBaseRows(data, 'abertas');
  assert.equal(own.length, 3, 'controle próprio não inclui equipamentos não cadastrados nem históricos');
  assert.equal(apoioBaseRows(data, 'classificar').length, 1);
  assert.equal(apoioBaseRows(data, 'historico').length, 1);
  assert.equal(filterApoioRows(data, own, { ...empty, groups: ['g1'] }).length, 2);
  assert.equal(filterApoioRows(data, own, { ...empty, groups: ['g1', 'g2'] }).length, 3);
  assert.equal(filterApoioRows(data, own, { ...empty, groups: ['g1'], location: 'Oficina Externa', status: 'Andamento', provider: 'Prestador de teste' })[0].os, '2');
  assert.equal(filterApoioRows(data, own, { ...empty, status: 'Programada' }).length, 1);
  assert.equal(filterApoioRows(data, own, { ...empty, status: 'Aguardando Peça' }).length, 1);
  assert.equal(filterApoioRows(data, own, { ...empty, location: ['Oficina Interna', 'Campo'] }).length, 2, 'origens múltiplas usam OR');
  assert.equal(filterApoioRows(data, own, { ...empty, origins: ['Oficina Interna', 'Oficina Externa'] }).length, 2, 'alias origins mantém a semântica de origem');
  assert.equal(filterApoioRows(data, own, { ...empty, status: ['Programada', 'Andamento'] }).length, 2, 'status múltiplos usam OR operacional');
  assert.equal(filterApoioRows(data, own, { ...empty, provider: ['Prestador de teste', 'Não informado'] }).length, 3, 'prestadores múltiplos preservam o fallback Não informado');
  assert.equal(filterApoioRows(data, own, { ...empty, location: [], status: [], provider: [] }).length, own.length, 'seleção vazia significa Todos');
  assert.equal(filterApoioRows(data, own, { ...empty, query: 'Nome definido' })[0].frota, '002');
  assert.equal(filterApoioRows(data, own, { ...empty, query: 'não existe' }).length, 0);
  assert.equal(oficinaLabel('Oficina'), 'Oficina Interna');
  assert.equal(oficinaLabel('Terceiro'), 'Oficina Externa');
  assert.equal(oficinaLabel('Campo'), 'Campo');
  assert.equal(oficinaLabel('Desconhecida'), 'Desconhecida');
  assert.equal(diasEmAberto('2026-11-01T10:00:00', new Date('2026-11-03T12:00:00')), 2);
  assert.equal(diasEmAberto('2026-12-01T10:00:00', new Date('2026-11-03T12:00:00')), null);
  assert.equal(diasEmAberto('2026-02-31T10:00:00'), null);
  assert.equal(diasEmAberto('sem data'), null);
  assert.equal(diasEmAberto(''), null);
  console.log('OK: 26 verificações de filtros, frota própria, origem e datas.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
