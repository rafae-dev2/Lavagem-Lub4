import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as XLSX from 'xlsx';
import * as nodeFs from 'node:fs';
XLSX.set_fs(nodeFs);

const root = process.cwd();
const dir = await mkdtemp(path.resolve('tests/.tmp-tracking-report-'));
try {
  await build({ entryPoints: ['src/lib/maintenanceTrackingReport.ts'], outfile: path.join(dir, 'report.mjs'), bundle: true, platform: 'node', format: 'esm', external: ['jspdf', 'jspdf-autotable', 'xlsx'], logLevel: 'silent' });
  const report = await import(pathToFileURL(path.join(dir, 'report.mjs')));
  const rows = Array.from({ length: 76 }, (_, index) => ({
    chave: `report-${index}`, os: `RELATORIOOS${String(index).padStart(3, '0')}`, frota: String(23600 + index),
    modelo: 'Carreta Canavieira', equipamento: 'Carreta canavieira teste', grupo_fonte: 'Canavieiras', apoio: 'Canavieiras',
    setor: 'Mecânica', ponto: 'Revisão', origem: 'Oficina', prestador: index === 0 ? '=HYPERLINK("malicious")' : 'Oficina de teste',
    status: index === 0 ? 'ENCERRADO' : 'PROGRAMADA', trackingStatus: index === 0 ? 'encerrado' : 'programado',
    entrada: '2026-11-07T08:00:00', previsao: '2026-11-09',
    narrativa: index === 1 ? `${'Serviço longo preservado no relatório. '.repeat(180)}MARCADORFINALNARRATIVA` : `PREVENTIVA do implemento ${index}.`,
    motivo: index === 0 ? '@texto literal' : 'Preventiva mecânica', classe: 'PREVENTIVA MECANICA', cd_ponto: '99',
    ativo: index !== 0, primeira_vista: '2026-11-07T08:00:00-03:00', ultima_vista: '2026-11-07T18:00:00-03:00',
    ausente_desde: index === 0 ? '2026-11-08T09:00:00-03:00' : null,
    classificationReason: 'Frota do mapa canavieiro; classe estruturada preventiva.', overdue: false,
  }));
  const options = { rows, module: 'preventivas', filters: ['Status: todos', '=filtro literal'], sourceUpdated: '2026-11-07T12:00:00Z', lastSynced: '2026-11-07T12:01:00Z', sourceError: 'Aviso de atualização simulado' };
  const pdf = await report.buildTrackingPDF(options);
  assert.ok(pdf.getNumberOfPages() > 2, 'Relatório deve paginar a seleção integral');
  const pdfPath = path.join(dir, 'multipagina.pdf');
  await writeFile(pdfPath, Buffer.from(pdf.output('arraybuffer')));
  const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  assert.ok(text.includes('BRANCO PERES AGRO') && text.includes('Resumo operacional'));
  assert.ok(text.includes('MARCADORFINALNARRATIVA'), 'Narrativa muito longa não pode perder o final');
  assert.ok(text.includes('origem: fonte') && text.includes('saída detectada'), 'Encerrada fora da fonte mantém origem e detecção explícitas');
  assert.ok(text.includes('Encerramento operacional por saída da fonte; data detectada não confirma execução real.'), 'PDF usa a advertência operacional sem afirmar execução');
  for (const row of rows) assert.ok(text.includes(row.os), `PDF deve incluir ${row.os}`);
  assert.ok(text.includes('09:00'), 'Horário UTC de fonte exibido em Brasília');
  assert.ok(text.includes('Aviso de atualização simulado'));
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) assert.ok(text.includes(`Página ${page}/${pdf.getNumberOfPages()}`), 'Rodapé em cada página');
  process.chdir(dir);
  await report.exportTrackingExcel(options);
  const filename = (await readdir(dir)).find(name => name.endsWith('.xlsx'));
  assert.ok(filename, 'Excel gerado');
  const workbook = XLSX.read(await readFile(path.join(dir, filename)), { type: 'buffer' });
  assert.deepEqual(workbook.SheetNames, ['Resumo', 'Ordens']);
  const details = XLSX.utils.sheet_to_json(workbook.Sheets.Ordens);
  assert.equal(details.length, 76, 'Excel inclui toda a seleção');
  assert.equal(details[1].Narrativa, rows[1].narrativa, 'Narrativa longa preservada íntegra');
  assert.ok(details[0].Prestador.startsWith("'="), 'Texto de origem não vira fórmula');
  assert.ok(details[0].Motivo.startsWith("'@"));
  assert.equal(details[0]['Origem encerramento'], 'fonte', 'Origem do encerramento fica separada do status bruto');
  assert.equal(details[0]['Data detecção encerramento'], rows[0].ausente_desde, 'Excel preserva data de detecção bruta');
  const summary = XLSX.utils.sheet_to_json(workbook.Sheets.Resumo, { header: 1 });
  assert.equal(summary[0][0], 'BRANCO PERES AGRO');
  assert.ok(summary.some(row => row[0] === 'Gerado em (Brasília)'));
  assert.ok(summary.some(row => row[0] === 'Fonte atualizada (Brasília)' && row[1].includes('09:00')));
  assert.ok(summary.some(row => row[0] === 'Filtro 2' && row[1] === "'=filtro literal"));
  assert.ok(summary.some(row => row[0] === 'Advertência' && row[1].includes('data detectada não confirma execução real')));
  console.log(`OK: PDF com ${pdf.getNumberOfPages()} páginas e Excel com 76 ordens; narrativa integral, cabeçalhos, ausência, horário Brasília e segurança de texto.`);
} finally {
  process.chdir(root);
  await rm(dir, { recursive: true, force: true });
}
