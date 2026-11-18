import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as XLSX from 'xlsx';
import * as nodeFs from 'node:fs';

XLSX.set_fs(nodeFs);

const root = process.cwd();
const dir = await mkdtemp(path.resolve('tests/.tmp-management-report-'));

function syntheticRow(index) {
  const closed = index === 0 || index === 7;
  const waiting = !closed && index % 3 === 0;
  const inProgress = !closed && !waiting && index % 4 === 0;
  const rawStatus = index === 0 ? 'ENCERRADO' : waiting ? 'PENDENTE' : inProgress ? 'EM ANDAMENTO' : 'PROGRAMADA';
  return {
    chave: `central-${index}`,
    os: `CENTRALOS${String(index).padStart(3, '0')}`,
    frota: String(4500 + index),
    modelo: index % 2 ? 'Caminhão canavieiro' : 'Trator agrícola',
    equipamento: `Equipamento sintético ${index}`,
    apoio: index % 2 ? 'Grupo Norte' : 'Grupo Sul',
    grupo_fonte: index % 2 ? 'Grupo Norte' : 'Grupo Sul',
    groupId: index % 2 ? 'apoio:norte' : 'fonte:grupo-sul',
    registered: index % 2 === 0,
    setor: 'Mecânica',
    ponto: index % 2 ? 'Motor' : 'Implemento',
    origem: index % 2 ? 'Oficina' : 'Campo',
    prestador: index === 0 ? '=HYPERLINK("malicioso")' : 'Prestador sintético',
    status: index === 1 ? '+STATUS_LITERAL' : rawStatus,
    statusKey: closed ? 'encerrado' : waiting ? 'aguardando' : inProgress ? 'andamento' : 'programado',
    statusName: closed ? 'Encerrado' : waiting ? 'Aguardando peça' : inProgress ? 'Em andamento' : 'Programado',
    ativo: !closed,
    entrada: `2026-10-${String(1 + (index % 9)).padStart(2, '0')}T08:00:00-03:00`,
    openedDate: `2026-10-${String(1 + (index % 9)).padStart(2, '0')}`,
    previsao: `2026-11-${String(8 + (index % 6)).padStart(2, '0')}`,
    ageDays: closed ? 12 + index : 20 + index,
    waitingDays: waiting ? 20 + index : null,
    observedCycleDays: closed ? 8 + index : null,
    forecastOverdue: !closed && index % 5 === 0,
    forecastDaysLate: !closed && index % 5 === 0 ? 3 + index : null,
    closedDate: closed && index === 0 ? '2026-11-02T13:00:00-03:00' : null,
    closureType: closed ? 'fonte' : null,
    closedDetectedAt: closed && index === 0 ? '2026-11-02T13:00:00-03:00' : null,
    ultima_vista: `2026-11-${String(2 + (index % 6)).padStart(2, '0')}T18:00:00-03:00`,
    narrativa: index === 1
      ? `${'Narrativa completa preservada no PDF e Excel. '.repeat(140)}MARCADORFINALNARRATIVA`
      : `Preventiva sintética da frota ${index}.`,
    motivo: index === 0 ? '@motivo literal' : 'Manutenção preventiva',
    classe: 'PREVENTIVA MECANICA',
    classificationReason: 'Classe estruturada; grupo preservado da fonte para teste.',
  };
}

const rows = Array.from({ length: 28 }, (_, index) => syntheticRow(index));
const model = {
  rows,
  summary: {
    total: 28,
    open: 26,
    waiting: rows.filter((row) => row.statusKey === 'aguardando').length,
    inProgress: rows.filter((row) => row.statusKey === 'andamento').length,
    closed: 2,
    overdue: rows.filter((row) => row.forecastOverdue).length,
    fleets: 28,
    meanWaitingDays: 24.5,
    medianWaitingDays: null,
    p90WaitingDays: 48,
    meanOpenDays: 31.2,
    waitingWithDate: rows.filter((row) => row.waitingDays !== null).length,
    openWithDate: 26,
    withForecast: 28,
    invalidDates: 0,
    closureDetected: 1,
    meanObservedCycleDays: 8,
  },
};
const options = {
  rows,
  model,
  filters: ['Escopo: all', 'Status: fila', '=seleção literal', 'Frota: 4500-4527'],
  sourceUpdated: '2020-01-01T12:00:00Z',
  lastSynced: '2020-01-01T12:01:00Z',
  sourceError: 'Atualização simulada para teste; não consultar a fonte.',
};

try {
  await build({
    entryPoints: ['src/lib/managementReport.ts'],
    outfile: path.join(dir, 'managementReport.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['jspdf', 'jspdf-autotable', 'xlsx'],
    logLevel: 'silent',
  });
  const report = await import(pathToFileURL(path.join(dir, 'managementReport.mjs')));

  process.chdir(dir);
  await report.exportManagementPDF(options);
  const pdfName = (await readdir(dir)).find((name) => name.endsWith('.pdf'));
  assert.ok(pdfName, 'PDF gerado');
  const pdfText = execFileSync('pdftotext', ['-layout', path.join(dir, pdfName), '-'], { encoding: 'utf8' });
  const pageMatch = pdfText.match(/Página\s+\d+\s*\/\s*\d+/g) || [];
  assert.ok(pageMatch.length >= 3, 'PDF deve ser multipágina e ter rodapé em cada página');
  assert.ok(pdfText.includes('Central Gerencial'), 'PDF identifica o relatório');
  assert.ok(pdfText.includes('Alerta: metadados da fonte possivelmente expirados'), 'PDF alerta metadado expirado');
  assert.ok(pdfText.includes('Atualização simulada para teste'), 'PDF preserva erro da fonte');
  assert.ok(pdfText.includes('MARCADORFINALNARRATIVA'), 'Narrativa longa não pode ser truncada');
  assert.ok(pdfText.includes('BI: aguardando') && pdfText.includes('Bruto: PENDENTE'), 'PDF preserva chave BI e status bruto');
  assert.ok(pdfText.includes('Cadastro: não registrado'), 'PDF explicita escopo de cadastro da linha');
  for (const row of rows) assert.ok(pdfText.includes(row.os), `PDF deve incluir ${row.os}`);

  await report.exportManagementExcel(options);
  const xlsxName = (await readdir(dir)).find((name) => name.endsWith('.xlsx'));
  assert.ok(xlsxName, 'Excel gerado');
  const workbook = XLSX.read(await readFile(path.join(dir, xlsxName)), { type: 'buffer' });
  assert.deepEqual(workbook.SheetNames, ['Indicadores', 'Ordens', 'Metodologia']);

  const details = XLSX.utils.sheet_to_json(workbook.Sheets.Ordens);
  assert.equal(details.length, 28, 'Excel inclui toda a seleção, não apenas uma página');
  assert.equal(details[1].Narrativa, rows[1].narrativa, 'Narrativa longa preservada integralmente');
  assert.ok(details[0].Prestador.startsWith("'=HYPERLINK"), 'Texto iniciado por = não vira fórmula');
  assert.ok(details[0].Motivo.startsWith("'@"), 'Texto iniciado por @ não vira fórmula');
  assert.ok(details[1]['Status bruto'].startsWith("'+STATUS"), 'Texto iniciado por + não vira fórmula');
  assert.equal(typeof details[0]['Idade aberta dias'], 'number', 'Idade aberta permanece numérica');
  assert.equal(details[0].Entrada,rows[0].entrada,'horário original preservado');
  assert.ok(pdfText.includes('08:00'),'PDF preserva horário de Entrada');
  const executing=details.find(row=>row['Status BI']==='andamento');
  assert.equal(executing['Idade fila dias'] ?? '', '','ordem em andamento não recebe idade da fila');
  assert.equal(typeof executing['Idade aberta dias'],'number');
  assert.equal(details[0]['Tipo encerramento'], 'fonte');
  assert.equal(details[0]['Data detecção encerramento'], rows[0].closedDetectedAt);

  const indicators = XLSX.utils.sheet_to_json(workbook.Sheets.Indicadores, { header: 1 });
  assert.ok(indicators.some((row) => row[0] === 'Linhas válidas exportadas' && row[1] === 28));
  assert.ok(indicators.some((row) => row[0] === 'Filtro 3' && row[1] === "'=seleção literal"));
  assert.ok(indicators.some((row) => row[0] === 'Alertas' && String(row[1]).includes('possivelmente expirados')));
  assert.ok(indicators.some((row) => row[0] === 'MTTR / conclusão real' && row[1] === 'Não calculado pela fonte'));

  const methodology = XLSX.utils.sheet_to_json(workbook.Sheets.Metodologia, { header: 1 });
  assert.ok(methodology.some((row) => row[0] === 'Fonte' && String(row[1]).includes('não executa SQL')));
  assert.ok(methodology.some((row) => row[0] === 'Segurança' && String(row[1]).includes('não executar fórmulas')));

  console.log(`OK: Central Gerencial PDF ${pageMatch.length} rodapés; Excel com ${details.length} ordens, narrativa integral, metadado expirado e células literais protegidas.`);
} finally {
  process.chdir(root);
  await rm(dir, { recursive: true, force: true });
}
