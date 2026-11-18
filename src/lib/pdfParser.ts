/**
 * Parser de Agendamento Semanal — BRANCO PERES
 *
 * Suporta:
 *  - PDF (texto extraído via pdfjs-dist com layout preservado)
 *  - Excel (.xlsx) convertido do PDF — formato real do arquivo lavador.xlsx
 *
 * Estrutura do Excel (lavador.xlsx):
 *   Linha título: col B = "AGENDAMENTO SEMANAL..."
 *   Linha de dia tipo 1: col B = "Segunda", col D = datetime(2026,3,30)
 *   Linha de dia tipo 2: col B = "Terça         31/03/2026", col D = null
 *   Linha cabeçalho: col B = "Agendamento", col D = "Frota"
 *   Linha de dado:   col B = time(7,0,0), col D = 8815 (int), col H = "Manutenção"
 *   Linha REFEIÇÃO:  col B = time, col D = "REFEIÇÃO"
 *
 * Colunas do Excel (índice 0):
 *   0=A(vazio), 1=B(Agendamento/hora), 2=C(vazio), 3=D(Frota), 4=E(vazio),
 *   5=F(Modelo), 6=G(vazio), 7=H(Serviço), 8=I(vazio), 9=J(Horas)
 */

import { Programacao } from '../types';

const WEEKDAY_NAMES = [
  'segunda', 'terça', 'terca', 'quarta', 'quinta',
  'sexta', 'sábado', 'sabado', 'domingo',
];

const RE_DATE = /(\d{2})\/(\d{2})\/(\d{4})/;
const RE_LUB = /\d+Lub/i;
// Linha de dado no PDF: espaços + HH:MM[:SS] + espaços + frota numérica
const RE_PDF_LINE = /^\s{0,10}(\d{2}:\d{2}(?::\d{2})?)\s{2,}(\d{4,6})\s/;

function parseDateBR(dateBR: string): string {
  const m = RE_DATE.exec(dateBR);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function normalizeTime(t: string): string {
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t;
  return `${m[1]!.padStart(2, '0')}:${m[2]}`;
}

function isRefeicao(val: string): boolean {
  return /REFEI[ÇC][ÃA]O/i.test(val);
}

function extractServicoPDF(restoLine: string): string {
  const parts = restoLine.trim().split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
  if (!parts.length) return 'Manutenção';
  const last = parts[parts.length - 1] || '';
  const isHoras = /^\d+:\d{2}$/.test(last);
  if (isHoras && parts.length >= 2) return parts[parts.length - 2] || 'Manutenção';
  return last || 'Manutenção';
}

/** Parser de texto do PDF */
export function parseScheduleText(rawText: string): Programacao[] {
  const results: Programacao[] = [];
  const lines = rawText.split('\n');
  let currentDate = '';
  let idx = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    if (/Agendamento\s+Frota/i.test(line) || /AGENDAMENTO SEMANAL/i.test(line)) continue;
    if (isRefeicao(line)) continue;

    // Cabeçalho de dia
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();
    const isDia = WEEKDAY_NAMES.some(d => lower.startsWith(d));
    if (isDia) {
      const dateMatch = RE_DATE.exec(trimmed);
      if (dateMatch) { currentDate = parseDateBR(dateMatch[0]); }
      continue;
    }

    const m = RE_PDF_LINE.exec(line);
    if (!m) continue;

    const frota = m[2]!.trim();
    const afterFrota = line.slice(m[0].length);
    const servico = extractServicoPDF(afterFrota);
    const tipoPreventiva = RE_LUB.test(servico) ? 'Lubrificação' : 'Lavagem / Lubrificação';

    if (!currentDate) continue;

    results.push({
      id: `import-${Date.now()}-${idx++}`,
      frota,
      descricaoPonto: 'LAVADOR',
      tipoPreventiva,
      dataProgramada: currentDate,
      dataRealizada: '',
      situacao: 'PROGRAMADO',
      horarioAgendado: normalizeTime(m[1]!),
      observacao: RE_LUB.test(servico) ? servico : '',
      rowIndex: undefined,
    });
  }

  return results;
}

/**
 * Parser de Excel — suporta o formato real do lavador.xlsx
 *
 * A biblioteca xlsx retorna células como:
 *   - Horário: string "07:00:00" ou "07:59:59" (após formatação) OU número decimal (fração do dia)
 *   - Frota: número inteiro (8815) ou string ("8815")
 *   - Data: string de data ISO ou número serial Excel
 *   - Dia: string "Segunda" ou "Terça 31/03/2026"
 *
 * Estratégia: detectar automaticamente qual coluna tem horário e qual tem frota
 * varrendo as primeiras linhas de dados.
 */
export function parseScheduleExcel(rows: unknown[][]): Programacao[] {
  if (!rows || rows.length === 0) return [];

  const results: Programacao[] = [];
  let currentDate = '';
  let idx = 0;

  // Detectar índices das colunas dinamicamente
  let colHorario = -1;
  let colFrota = -1;
  let colServico = -1;

  // Tentar detectar pelo cabeçalho "Agendamento" / "Frota" / "Serviço"
  for (const row of rows) {
    const cells = row.map(c => c == null ? '' : String(c).trim());
    const lower = cells.map(c => c.toLowerCase());
    const agendIdx = lower.findIndex(c => c.includes('agendamento'));
    const frotaIdx = lower.findIndex(c => c === 'frota');
    const servicoIdx = lower.findIndex(c => c.includes('servi'));
    if (agendIdx >= 0 && frotaIdx >= 0) {
      colHorario = agendIdx;
      colFrota = frotaIdx;
      colServico = servicoIdx >= 0 ? servicoIdx : -1;
      break;
    }
  }

  // Fallback: usar colunas padrão do lavador.xlsx real (C=2, D=3, F=5)
  // Estrutura real: col A(0)=vazio, B(1)=vazio, C(2)=Horário, D(3)=Frota, E(4)=Modelo, F(5)=Serviço
  if (colHorario < 0) {
    colHorario = 2;
    colFrota = 3;
    colServico = 5;
  }

  for (const row of rows) {
    if (!row || row.every(c => c == null || c === '')) continue;

    // No lavador.xlsx: col C(2)=horário/dia, col D(3)=frota/data, col F(5)=serviço
    const rawHorario = row[colHorario]; // col C
    const rawFrota   = row[colFrota];   // col D
    const rawH       = colServico >= 0 ? row[colServico] : null; // col F

    const strHorario = rawHorario == null ? '' : String(rawHorario).trim();
    const strFrota   = rawFrota   == null ? '' : String(rawFrota).trim();

    // ── Linha de dia: col C = nome do dia ("Segunda", "Terça"...) ──
    const lowerHorario = strHorario.toLowerCase();
    const isDiaNome = WEEKDAY_NAMES.some(d => lowerHorario.startsWith(d));
    if (isDiaNome) {
      // Tentar extrair data de qualquer célula da linha
      for (const cell of row) {
        if (cell == null) continue;
        const s = String(cell).trim();
        // Data como string DD/MM/YYYY
        const dm = RE_DATE.exec(s);
        if (dm) { currentDate = parseDateBR(dm[0]); break; }
        // Data como string ISO YYYY-MM-DD ou YYYY-MM-DDTHH:MM
        const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
        if (iso) { currentDate = `${iso[1]}-${iso[2]}-${iso[3]}`; break; }
        // Data como objeto Date serializado pelo SheetJS ("3/30/2026" ou "30/3/2026")
        if (s.length >= 6 && /\d/.test(s)) {
          const d = new Date(s);
          if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
            // Usar UTC para evitar problema de fuso
            const utc = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
            currentDate = utc.toISOString().substring(0, 10);
            break;
          }
        }
      }
      // Se col D é um número serial Excel (dias desde 1900-01-01)
      if (!currentDate && typeof rawFrota === 'number' && rawFrota > 40000) {
        const d = excelSerialToDate(rawFrota);
        if (d) currentDate = d;
      }
      continue;
    }

    // Aliases para manter compatível com o restante do código
    const rawB = rawHorario;
    const rawD = rawFrota;
    const strB = strHorario;
    const strD = strFrota;

    // ── Pular cabeçalhos e REFEIÇÃO ──
    if (strB.toLowerCase().includes('agendamento')) continue;
    if (isRefeicao(strD) || isRefeicao(strB)) continue;
    if (strD === '' && strB === '') continue;

    // ── Linha de dado: col B = horário, col D = frota numérica ──
    const horario = parseTimeCell(rawB);
    if (!horario) continue;

    // Frota: número inteiro de 3-6 dígitos
    const frota = parseFrotaCell(rawD);
    if (!frota) continue;

    if (!currentDate) continue;

    const servico = rawH != null ? String(rawH).trim() : 'Manutenção';
    const tipoPreventiva = RE_LUB.test(servico) ? 'Lubrificação' : 'Lavagem / Lubrificação';

    results.push({
      id: `import-${Date.now()}-${idx++}`,
      frota,
      descricaoPonto: 'LAVADOR',
      tipoPreventiva,
      dataProgramada: currentDate,
      dataRealizada: '',
      situacao: 'PROGRAMADO',
      horarioAgendado: horario,
      observacao: RE_LUB.test(servico) ? servico : '',
      rowIndex: undefined,
    });
  }

  return results;
}

/** Converte uma célula de horário para string "HH:MM" */
function parseTimeCell(val: unknown): string | null {
  if (val == null) return null;

  // Número decimal (fração do dia): ex. 0.2916... = 07:00
  if (typeof val === 'number') {
    if (val >= 0 && val < 1) {
      const totalMinutes = Math.round(val * 24 * 60);
      const h = Math.floor(totalMinutes / 60) % 24;
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return null;
  }

  const s = String(val).trim();

  // Formato AM/PM: "7:00:00 AM", "1:00:00 PM", "12:30:00 PM" (SheetJS com raw:false)
  const ampm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]!, 10);
    const m = ampm[2]!;
    const period = ampm[3]!.toUpperCase();
    if (period === 'AM' && h === 12) h = 0;
    if (period === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2, '0')}:${m}`;
  }

  // Formato "HH:MM:SS" ou "HH:MM" (24h)
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) return `${m[1]!.padStart(2, '0')}:${m[2]}`;

  // Formato ISO com hora: "1899-12-30T07:00:00.000Z" (xlsx serializa assim)
  const iso = s.match(/T(\d{2}):(\d{2}):/);
  if (iso) return `${iso[1]}:${iso[2]}`;

  return null;
}

/** Converte célula de frota para string de 3-6 dígitos */
function parseFrotaCell(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (/^\d{3,6}$/.test(s)) return s;
  // Número com casas decimais (ex: 8815.0)
  const n = parseFloat(s);
  if (!isNaN(n) && n > 100 && n < 999999) {
    const i = String(Math.round(n));
    if (/^\d{3,6}$/.test(i)) return i;
  }
  return null;
}

/** Converte número serial Excel para string YYYY-MM-DD */
function excelSerialToDate(serial: number): string | null {
  try {
    // Excel usa 1900-01-01 como dia 1 (com bug do ano bissexto 1900)
    const date = new Date((serial - 25569) * 86400 * 1000);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().substring(0, 10);
  } catch {
    return null;
  }
}
