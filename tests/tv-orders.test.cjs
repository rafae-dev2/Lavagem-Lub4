const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { build } = require('esbuild');
const ROOT = path.resolve(__dirname, '..');

function order(overrides = {}) {
  return {
    chave: `${overrides.frota || '4508'}::${overrides.os || '1'}`,
    os: String(overrides.os || '1'), frota: overrides.frota || '4508',
    modelo: overrides.modelo || 'Caminhão de teste', grupo_fonte: '',
    setor: overrides.setor || 'Mecânica', ponto: 'Ponto A', origem: overrides.origem || 'Oficina',
    prestador: overrides.prestador || 'Oficina Alfa', status: overrides.status || 'Andamento',
    entrada: overrides.entrada || '2026-11-01T08:00:00', previsao: overrides.previsao || '2026-11-06',
    narrativa: overrides.narrativa || '', ativo: overrides.ativo !== false,
    primeira_vista: '', ultima_vista: '', ausente_desde: null,
    classe: overrides.classe, motivo: overrides.motivo || '', cd_ponto: overrides.cd_ponto || '1', ...overrides,
  };
}
function fixture(overrides = {}) {
  return {
    groups: [{ id: 'g1', nome: 'Grupo Norte', cor: '#123456' }, { id: 'g2', nome: 'Grupo Sul', cor: '#654321' }],
    fleets: [
      { frota: '4508', grupo_id: 'g1', nome: 'Caminhão 4508' },
      { frota: '4509', grupo_id: 'g2', nome: 'Caminhão 4509' },
      { frota: '45080', grupo_id: 'g1', nome: 'Caminhão 45080' },
    ], orders: [], sync: null, role: 'viewer', ...overrides,
  };
}

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-orders-'));
  try {
    const outfile = path.join(temp, 'tvOrders.cjs');
    await build({ entryPoints: [path.join(ROOT, 'src/lib/tvOrders.ts')], outfile, bundle: true, platform: 'node', format: 'cjs', target: 'node18', logLevel: 'silent' });
    const tv = require(outfile);
    const now = new Date('2026-11-05T12:00:00-03:00');

    assert.equal(tv.isEmergencyOrder({ classe: 'CORRET EMERGENCIAL' }), true);
    assert.equal(tv.isEmergencyOrder({ classe: 'corret emergencial' }), true);
    assert.equal(tv.isEmergencyOrder({ classe: 'NÃO EMERGENCIAL' }), false);
    assert.equal(tv.isEmergencyOrder({ classe: 'EMERGENCIA' }), false);
    for (const classe of ['SEM EMERGENCIAL', 'NÃO CORRET EMERGENCIAL', 'CORRET PROGRAMADA', 'OUTRA EMERGENCIA']) assert.equal(tv.isEmergencyOrder({ classe }), false);
    assert.equal(tv.isEmergencyOrder({ classe: '' }), false);
    assert.equal(tv.isEmergencyOrder({ classe: undefined, narrativa: 'EMERGENCIAL' }), false);
    assert.equal(tv.isEmergencyOrder({ classe: 'Classe normal', motivo: 'EMERGENCIAL' }), false);
    assert.equal(tv.isInProgress({ status: 'Andamento' }), true);
    assert.equal(tv.isInProgress({ status: 'EM ANDAMENTO' }), true);
    assert.equal(tv.isInProgress({ status: 'Programada' }), false);

    const data = fixture({ orders: [
      order({ os: '1', frota: '4508', classe: 'CORRET EMERGENCIAL', entrada: '2026-11-01T08:00:00' }),
      order({ os: '2', frota: '4509', classe: 'CORRET EMERGENCIAL', origem: 'Terceiro', status: 'EM ANDAMENTO', entrada: '2026-11-04T08:00:00' }),
      order({ os: '3', frota: '45080', classe: 'CORRET EMERGENCIAL', entrada: '2026-11-02T08:00:00' }),
      order({ os: '4', frota: '7777', classe: 'CORRET EMERGENCIAL' }),
      order({ os: '5', frota: '4508', classe: 'NÃO EMERGENCIAL', narrativa: 'EMERGENCIAL' }),
      order({ os: '6', frota: '4508', classe: undefined, motivo: 'EMERGENCIAL' }),
      order({ os: '7', frota: '4508', classe: 'CORRET EMERGENCIAL', status: 'Programada', setor: 'Elétrica', motivo: 'Falha' }),
      order({ os: '8', frota: '4509', classe: 'CORRET EMERGENCIAL', status: 'Aguardando Peça', setor: 'Elétrica', motivo: 'Falha' }),
      order({ os: '9', frota: '4509', classe: 'CORRET EMERGENCIAL', status: 'Encerrada' }),
    ] });
    const defaults = { ...tv.defaultTVFilters, groups: [] };
    assert.deepEqual(tv.selectTVOrders(data, defaults, now).map(row => row.os), ['1', '3', '2']);
    assert.deepEqual(tv.selectTVOrders(data, { ...defaults, groups: ['g1'] }, now).map(row => row.frota), ['4508', '45080']);
    assert.deepEqual(tv.selectTVOrders(data, { ...defaults, groups: ['g1', 'g2'] }, now).map(row => row.frota), ['4508', '45080', '4509']);
    assert.deepEqual(tv.selectTVOrders(data, { ...defaults, groups: ['g1'], status: 'abertas' }, now).map(row => row.os), ['1', '7', '3']);
    assert.deepEqual(tv.selectTVOrders(data, { ...defaults, groups: ['g1', 'g2'], status: 'abertas', sector: 'Elétrica', reason: 'Falha' }, now).map(row => row.os), ['7', '8']);
    assert.deepEqual(tv.selectTVOrders(data, { ...defaults, groups: ['g2'], provider: 'Oficina Alfa' }, now).map(row => row.os), ['2']);
    assert.deepEqual(tv.selectTVOrders(data, { ...defaults, groups: ['g1'], provider: 'Oficina Alfa' }, now), []);
    assert.deepEqual(tv.selectTVOrders(data, { ...defaults, query: '4509' }, now).map(row => row.os), ['2']);
    assert.deepEqual(tv.selectTVOrders(data, { ...defaults, minDays: 3 }, now).map(row => row.os), ['1', '3']);

    const externalData=fixture({orders:[
      order({os:'ext-normal',origem:'Terceiro',classe:'CORRET PROGRAMADA',status:'Programada'}),
      order({os:'ext-parts',origem:'Oficina Externa',classe:'REFORMA',status:'Aguardando Peça'}),
      order({os:'ext-emergency',origem:'externa',classe:'CORRET EMERGENCIAL'}),
      order({os:'internal',origem:'Oficina',classe:'CORRET EMERGENCIAL',prestador:'Oficina Alfa'}),
      order({os:'field',origem:'Campo',classe:'CORRET EMERGENCIAL'}),
      order({os:'outsider',frota:'99999',origem:'Terceiro',classe:'CORRET EMERGENCIAL'}),
      order({os:'closed',origem:'Terceiro',classe:'CORRET EMERGENCIAL',status:'Encerrada'}),
      order({os:'inactive',origem:'Terceiro',classe:'CORRET EMERGENCIAL',ativo:false}),
    ]});
    const copy=JSON.stringify(externalData);
    assert.deepEqual(new Set(tv.selectTVExternalOrders(externalData).map(o=>o.os)),new Set(['ext-normal','ext-parts','ext-emergency']),'painel externo inclui abertas de todas classes, não internas/campo/frotas fora Apoio/encerradas');
    assert.deepEqual(tv.selectTVExternalOrders(externalData,{...defaults,location:'Oficina Interna',emergencyOnly:true,status:'abertas',reason:''},now).length,3,'não é possível ampliar externo para interna ou herdar classe emergencial');
    assert.equal(tv.selectTVExternalOrders(externalData,{...defaults,groups:['g2'],status:'abertas'},now).length,0,'grupo continua restritivo');
    assert.equal(JSON.stringify(externalData),copy,'seleção externa não altera dados');

    const missing = fixture({ orders: [order({ classe: undefined, motivo: 'EMERGENCIAL', narrativa: 'CORRET EMERGENCIAL' })] });
    assert.deepEqual(tv.selectTVOrders(missing, defaults, now), []);
    assert.equal(tv.getTVOrdersWarning(missing), tv.TV_CLASS_DATA_WARNING);

    const dated = fixture({ orders: [
      order({ os: 'bad', classe: 'CORRET EMERGENCIAL', entrada: 'não-é-data', previsao: 'não-é-data' }),
      order({ os: 'old', classe: 'CORRET EMERGENCIAL', entrada: '2026-11-01T08:00:00' }),
      order({ os: 'new', classe: 'CORRET EMERGENCIAL', entrada: '2026-11-04T08:00:00' }),
    ] });
    assert.deepEqual(tv.selectTVOrders(dated, { ...defaults, sort: 'oldest' }, now).map(row => row.os), ['old', 'new', 'bad']);
    assert.deepEqual(tv.selectTVOrders(dated, { ...defaults, sort: 'newest' }, now).map(row => row.os), ['new', 'old', 'bad']);
    assert.equal(tv.tvDateTimestamp('2026-11-05T08:00:00'), Date.parse('2026-11-05T11:00:00Z'));
    assert.equal(tv.tvDateTimestamp('2026-02-31'), null);
    assert.equal(tv.tvDeadlineState('2026-11-05', now), 'today');
    assert.equal(tv.tvDeadlineState('2026-11-04', now), 'overdue');
    assert.equal(tv.tvDeadlineState('não-é-data', now), 'unknown');

    console.log('OK: TV Apoio validou emergência explícita/negativa, classe ausente com aviso, frota exata, grupos múltiplos, interseção, status, idade, datas Brasília e ordenação inválida.');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
