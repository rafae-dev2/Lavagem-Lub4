'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'apoio-oficina-terceiros-'));

function loadHelper() {
  const outfile = path.join(TMP, 'apoioOficinaTerceirosData.cjs');
  buildSync({
    entryPoints: [path.join(ROOT, 'src/lib/apoioOficinaTerceirosData.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    outfile,
    logLevel: 'silent',
  });
  delete require.cache[require.resolve(outfile)];
  return require(outfile);
}

function row(overrides = {}) {
  return {
    chave: 'chave-1',
    os: 'OS-1',
    frota: '8825',
    modelo: 'Ren Oroch 1.6 SCe',
    grupo_fonte: 'Veículos',
    setor: '',
    ponto: '',
    origem: 'Oficina Externa',
    prestador: 'SILAS EDUARDO MOURA DA SILVA',
    status: 'Em andamento',
    entrada: '2026-11-10',
    previsao: '',
    narrativa: 'Revisão',
    ativo: true,
    primeira_vista: '2026-11-10T08:00:00-03:00',
    ultima_vista: '2026-11-14T08:00:00-03:00',
    ausente_desde: null,
    apoio: 'Veículos Leves',
    equipamento: 'Ren Oroch 1.6 SCe',
    ...overrides,
  };
}

function main() {
  const {
    selectOficinaTerceirosEquipment,
    selectOficinaReportEquipment,
    selectOficinaReportOrders,
    buildOficinaTerceirosExcelData,
    normalizeOficinaScope,
    readStoredOficinaScope,
    saveStoredOficinaScope,
    OFICINA_SCOPE_STORAGE_KEY,
    filterOficinaTerceirosEntries,
    oficinaTerceirosProviderOptions,
    oficinaTerceirosSummary,
    oficinaReportTitle,
    oficinaReportFilenameBase,
    OFICINA_TERCEIROS_TITLE,
    EMERGENCIA_INTERNA_CAMPO_TITLE,
    OFICINA_E_EMERGENCIA_TITLE,
    OFICINA_TERCEIROS_IMAGE,
  } = loadHelper();

  assert.equal(typeof selectOficinaTerceirosEquipment, 'function');
  assert.equal(typeof selectOficinaReportEquipment, 'function');
  assert.equal(typeof selectOficinaReportOrders, 'function');
  assert.equal(typeof buildOficinaTerceirosExcelData, 'function');
  assert.equal(OFICINA_TERCEIROS_TITLE, 'Equipamentos em Oficina de Terceiros');
  assert.equal(oficinaReportTitle('externa'), OFICINA_TERCEIROS_TITLE);
  assert.equal(oficinaReportTitle('emergencia'), EMERGENCIA_INTERNA_CAMPO_TITLE);
  assert.equal(oficinaReportTitle('juntos'), OFICINA_E_EMERGENCIA_TITLE);
  assert.equal(oficinaReportFilenameBase('externa'), 'equipamentos-oficina-terceiros');
  assert.equal(oficinaReportFilenameBase('emergencia'), 'equipamentos-emergenciais-interna-campo');
  assert.equal(oficinaReportFilenameBase('juntos'), 'equipamentos-terceiros-e-emergenciais');
  assert.deepEqual({ ...OFICINA_TERCEIROS_IMAGE }, { width: 921, height: 1600 });

  // Normalização e persistência em localStorage (SSR-safe e armazenamento simulado).
  assert.equal(normalizeOficinaScope(undefined), 'externa');
  assert.equal(normalizeOficinaScope('emergencia'), 'emergencia');
  assert.equal(normalizeOficinaScope('separados'), 'emergencia');
  assert.equal(normalizeOficinaScope('juntos'), 'juntos');
  assert.equal(normalizeOficinaScope('junto'), 'juntos');
  assert.equal(normalizeOficinaScope('invalido'), 'externa');
  assert.equal(readStoredOficinaScope(), 'externa', 'SSR sem window retorna externa por padrão');

  const store = new Map();
  global.window = {
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
    },
  };
  try {
    assert.equal(readStoredOficinaScope(), 'externa');
    saveStoredOficinaScope('emergencia');
    assert.equal(store.get(OFICINA_SCOPE_STORAGE_KEY), 'emergencia');
    assert.equal(readStoredOficinaScope(), 'emergencia');
    saveStoredOficinaScope('juntos');
    assert.equal(readStoredOficinaScope(), 'juntos');
  } finally {
    delete global.window;
  }

  // Somente oficina externa entra no modo padrão ('externa'); interna, campo e origem desconhecida ficam fora.
  const rows = [
    row({ chave: 'a', frota: '8825', origem: 'Oficina Externa' }),
    row({ chave: 'b', frota: '30941', origem: 'terceiro', modelo: 'Usi Reboque Muda 2 Eixos', prestador: 'BONANI, OLIVEIRA & FRESCA LTDA - ME', apoio: 'Carretas Canavieiras' }),
    row({ chave: 'c', frota: '4605', origem: 'externo', modelo: 'MB 3344 6x4 Cavalo Mec', prestador: 'CARLOS HENRIQUE DA COSTA FRASSON-ME' }),
    row({ chave: 'd', frota: '4571', origem: 'Oficina Interna', prestador: 'Oficina interna' }),
    row({ chave: 'e', frota: '4566', origem: 'Campo', prestador: 'Campo' }),
    row({ chave: 'f', frota: '9999', origem: '', prestador: 'Sem origem' }),
    // Encerrada, ausente e sem frota não são equipamentos parados na oficina.
    row({ chave: 'g', frota: '4629', origem: 'Oficina Externa', status: 'Encerrada' }),
    row({ chave: 'h', frota: '4574', origem: 'Oficina Externa', ativo: false }),
    row({ chave: 'i', frota: '', origem: 'Oficina Externa' }),
    row({ chave: 'j', frota: 'Sem frota', origem: 'Oficina Externa' }),
    // A mesma frota aparece uma única vez, preservando a primeira ocorrência.
    row({ chave: 'k', frota: '8825', origem: 'Oficina Externa', prestador: 'OUTRA OFICINA' }),
    row({ chave: 'l', frota: ' 8825 ', origem: 'Oficina Externa', prestador: 'TERCEIRA OFICINA' }),
  ];

  const entries = selectOficinaTerceirosEquipment(rows);
  assert.deepEqual(entries.map(entry => entry.frota), ['8825', '30941', '4605'], 'somente oficinas externas ativas, sem repetir frota');
  assert.equal(entries[0].prestador, 'SILAS EDUARDO MOURA DA SILVA', 'primeira ocorrência da frota prevalece');
  assert.equal(entries[1].modelo, 'Usi Reboque Muda 2 Eixos');
  assert.equal(entries[2].prestador, 'CARLOS HENRIQUE DA COSTA FRASSON-ME');
  assert.equal(entries[1].grupo, 'Carretas Canavieiras');

  // Escopo 'emergencia' e 'juntos': apenas ordens com classe 'CORRET EMERGENCIAL' em Oficina Interna ou Campo.
  const mixedRows = [
    ...rows,
    row({ chave: 'em-1', frota: '7101', origem: 'Oficina Interna', classe: 'CORRET EMERGENCIAL', setor: 'Oficina Elétrica', prestador: 'Oficina Interna', modelo: 'Colhedora John Deere' }),
    row({ chave: 'em-2', frota: '7102', origem: 'Campo', classe: 'CORRET EMERGENCIAL', prestador: 'Campo', modelo: 'Trator Case 290' }),
    row({ chave: 'em-3', frota: '7103', origem: 'Oficina Interna', classe: 'PREVENTIVA', narrativa: 'Emergencial no texto não classifica classe', prestador: 'Oficina Interna' }),
    row({ chave: 'em-4', frota: '7104', origem: 'Campo', classe: 'CORRET EMERGENCIAL', status: 'Encerrada' }),
    row({ chave: 'em-5', frota: '7105', origem: 'Oficina Externa', classe: 'CORRET EMERGENCIAL', prestador: 'OFICINA FORA' }),
  ];

  const somenteEmergencias = selectOficinaReportEquipment(mixedRows, 'emergencia');
  assert.deepEqual(somenteEmergencias.map(e => e.frota), ['7101', '7102'], 'somente emergenciais ativas de Oficina Interna e Campo');
  assert.equal(somenteEmergencias[0].categoria, 'emergencial_interna');
  assert.equal(somenteEmergencias[0].grupo_fonte, 'Veículos');
  assert.equal(somenteEmergencias[0].prestador, 'Oficina Interna · Oficina Elétrica (Emergencial)');
  assert.equal(somenteEmergencias[1].categoria, 'emergencial_campo');
  assert.equal(somenteEmergencias[1].prestador, 'Campo · Emergencial');
  assert.equal(
    oficinaTerceirosSummary(somenteEmergencias, 'emergencia'),
    '2 equipamentos emergenciais (1 oficina interna · 1 campo)',
  );

  const juntos = selectOficinaReportEquipment(mixedRows, 'juntos');
  assert.deepEqual(
    juntos.map(e => e.frota),
    ['8825', '30941', '4605', '7101', '7102', '7105'],
    'juntos reúne oficina externa + emergenciais em oficina interna e campo',
  );
  assert.equal(
    oficinaTerceirosSummary(juntos, 'juntos'),
    '6 equipamentos (4 terceiros · 2 emergenciais interna/campo)',
  );
  assert.deepEqual(
    filterOficinaTerceirosEntries(juntos, { query: 'campo' }).map(e => e.frota),
    ['7102'],
    'busca no modo juntos também encontra por local (Campo)',
  );

  // Exportação de dados (ordens vinculadas e planilha Excel) respeita o escopo e os itens desmarcados.
  const emergOrders = selectOficinaReportOrders(mixedRows, 'emergencia', { excludedFleets: ['7102'] });
  assert.deepEqual(emergOrders.map(o => o.chave), ['em-1'], 'exportação no modo emergência exclui desmarcados e externas');

  const juntosOrders = selectOficinaReportOrders(mixedRows, 'juntos', { excludedFleets: ['8825'] });
  assert.deepEqual(
    juntosOrders.map(o => o.chave),
    ['b', 'c', 'em-1', 'em-2', 'em-5'],
    'exportação no modo juntos reúne externas e emergenciais marcadas',
  );

  const excelData = buildOficinaTerceirosExcelData(
    juntos.filter(e => e.frota !== '8825'),
    juntosOrders,
    { scope: 'juntos' },
  );
  assert.equal(excelData.equipmentRows.length, 5);
  assert.equal(excelData.orderRows.length, 5);
  assert.equal(excelData.equipmentRows.find(r => r.Equipamento === '7101').Emergencial, 'Sim');
  assert.equal(excelData.equipmentRows.find(r => r.Equipamento === '30941').Emergencial, 'Não');
  assert.equal(excelData.metaRows.find(([k]) => k === 'Modo de visualização')[1], 'Junto · Oficina de Terceiros + Emergenciais (Interna e Campo)');

  // Modelo cai para o nome do equipamento e depois para o texto padrão;
  // prestador vazio nunca some da imagem.
  const fallback = selectOficinaTerceirosEquipment([
    row({ chave: 'm', frota: '4581', modelo: '', equipamento: 'MB 2831 6x4 muck' }),
    row({ chave: 'n', frota: '4508', modelo: '', equipamento: '' }),
  ]);
  assert.deepEqual(fallback.map(entry => entry.modelo), ['MB 2831 6x4 muck', 'Modelo não informado']);
  assert.equal(fallback[0].prestador, 'SILAS EDUARDO MOURA DA SILVA');
  const semPrestador = selectOficinaTerceirosEquipment([row({ chave: 'o', prestador: '   ' })]);
  assert.equal(semPrestador[0].prestador, 'Oficina não informada');

  // A ordem da seleção é preservada e a entrada original não é mutada.
  const before = structuredClone(rows);
  assert.deepEqual(rows, before, 'seleção não deve mutar as ordens');
  assert.equal(selectOficinaTerceirosEquipment([]).length, 0);
  assert.equal(oficinaTerceirosSummary(entries), '3 equipamentos em oficina de terceiros · 3 oficinas');
  assert.equal(oficinaTerceirosSummary([entries[0]]), '1 equipamento em oficina de terceiros · 1 oficina');

  // Filtros do relatório: pesquisa livre (frota, modelo ou oficina), sem
  // diferenciar acento/caixa, e seleção de oficinas. Vazio considera tudo.
  const report = [
    { frota: '4508', modelo: 'MB 2831 6x4 muck', prestador: 'FRATINI REPARACAO DE IMPLEMENTOS', grupo: 'Caminhões' },
    { frota: '4512', modelo: 'MB 2219 6x4 muck', prestador: 'SERGIO MAIA ADAMANTINA - ME', grupo: 'Caminhões' },
    { frota: '4605', modelo: 'MB 3344 6x4 Cavalo Mec', prestador: 'CARLOS HENRIQUE DA COSTA FRASSON-ME', grupo: 'Caminhões' },
    { frota: '8825', modelo: 'Ren Oroch 1.6 SCe', prestador: 'SILAS EDUARDO MOURA DA SILVA', grupo: 'Veículos Leves' },
  ];
  const ids = list => list.map(entry => entry.frota);
  assert.deepEqual(ids(filterOficinaTerceirosEntries(report)), ['4508', '4512', '4605', '8825'], 'sem filtro mantém todos');
  assert.deepEqual(ids(filterOficinaTerceirosEntries(report, { query: 'mb 3344' })), ['4605'], 'busca combina termos do modelo');
  assert.deepEqual(ids(filterOficinaTerceirosEntries(report, { query: 'fratini' })), ['4508'], 'busca encontra a oficina');
  assert.deepEqual(ids(filterOficinaTerceirosEntries(report, { query: 'carlos henrique' })), ['4605'], 'busca ignora caixa e acentos');
  assert.deepEqual(ids(filterOficinaTerceirosEntries(report, { query: 'muck' })), ['4508', '4512'], 'busca no modelo');
  assert.deepEqual(ids(filterOficinaTerceirosEntries(report, { query: '8825 oro' })), ['8825'], 'busca frota + trecho do modelo');
  assert.deepEqual(ids(filterOficinaTerceirosEntries(report, { query: 'inexistente' })), [], 'busca sem resultado devolve vazio');
  assert.deepEqual(
    ids(filterOficinaTerceirosEntries(report, { prestadores: ['SERGIO MAIA ADAMANTINA - ME', 'FRATINI REPARACAO DE IMPLEMENTOS'] })),
    ['4508', '4512'],
    'seleção de oficinas restringe o relatório',
  );
  assert.deepEqual(
    ids(filterOficinaTerceirosEntries(report, { prestadores: ['SERGIO MAIA ADAMANTINA - ME'], query: 'muck' })),
    ['4512'],
    'oficina + busca combinam',
  );
  assert.deepEqual(ids(filterOficinaTerceirosEntries(report, { prestadores: [] })), ids(report), 'seleção vazia considera todas');
  assert.deepEqual(oficinaTerceirosProviderOptions(report), [
    { value: 'CARLOS HENRIQUE DA COSTA FRASSON-ME', label: 'CARLOS HENRIQUE DA COSTA FRASSON-ME', count: 1 },
    { value: 'FRATINI REPARACAO DE IMPLEMENTOS', label: 'FRATINI REPARACAO DE IMPLEMENTOS', count: 1 },
    { value: 'SERGIO MAIA ADAMANTINA - ME', label: 'SERGIO MAIA ADAMANTINA - ME', count: 1 },
    { value: 'SILAS EDUARDO MOURA DA SILVA', label: 'SILAS EDUARDO MOURA DA SILVA', count: 1 },
  ], 'opções de oficina ordenadas com contagem');

  console.log('OK: oficina de terceiros — localStorage, externas, emergenciais (Interna/Campo), modo junto, exportação Excel/PDF/PNG e filtros verificados.');
}

try {
  main();
} catch (error) {
  console.error(`FAIL: ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
