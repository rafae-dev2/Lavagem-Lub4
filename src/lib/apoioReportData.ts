import {
  diasObservados,
  oficinaLabel,
  type ApoioReportRow,
} from '../types/apoio';

function text(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function normaliseForCompare(value: unknown): string {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function parseDate(value: string | null | undefined): { date: Date; hasTime: boolean } | null {
  const raw = text(value);
  if (!raw) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const date = new Date(year, month - 1, day);
    if (
      !Number.isFinite(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return { date, hasTime: false };
  }

  // Timestamps without an explicit timezone are local values from the operational system.
  const normalized = raw.includes(' ') && !raw.includes('T')
    ? raw.replace(' ', 'T')
    : raw;
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) return null;

  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    const check = new Date(year, month - 1, day);
    if (
      !Number.isFinite(check.getTime()) ||
      check.getFullYear() !== year ||
      check.getMonth() !== month - 1 ||
      check.getDate() !== day
    ) {
      return null;
    }
  }

  return { date, hasTime: /T|\d{1,2}:\d{2}/.test(raw) };
}

/** Format an operational date without exposing synchronization metadata. */
export function reportDate(value: string | null | undefined, withTime = true): string {
  const raw = text(value);
  if (!raw) return '—';
  const parsed = parseDate(raw);
  if (!parsed) return 'Data inconsistente';

  const options: Intl.DateTimeFormatOptions = parsed.hasTime && withTime
    ? {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    : { day: '2-digit', month: '2-digit', year: 'numeric' };
  return new Intl.DateTimeFormat('pt-BR', options).format(parsed.date);
}

/** Historical absence is never a completion signal. */
export function reportRowStatus(row: ApoioReportRow): string {
  if (row.ativo !== false) return text(row.status, 'Status não informado');
  const lastStatus = text(row.status);
  return lastStatus
    ? `Ausente da listagem\nÚltimo status observado: ${lastStatus}`
    : 'Ausente da listagem';
}

export function reportLocation(row: ApoioReportRow): string {
  return oficinaLabel(text(row.origem));
}

export function reportGroups(rows: ApoioReportRow[], preserveRowOrder = false): {
  apoio: string;
  location: string;
  rows: ApoioReportRow[];
}[] {
  if (preserveRowOrder) {
    const adjacent: { apoio: string; location: string; rows: ApoioReportRow[] }[] = [];
    for (const row of rows) {
      const apoio = text(row.apoio, 'Apoio não informado');
      const location = reportLocation(row);
      const last = adjacent[adjacent.length - 1];
      if (last && last.apoio === apoio && last.location === location) last.rows.push(row);
      else adjacent.push({ apoio, location, rows: [row] });
    }
    return adjacent;
  }
  const groups = new Map<string, { apoio: string; location: string; rows: ApoioReportRow[] }>();
  rows.forEach((row) => {
    const apoio = text(row.apoio, 'Apoio não informado');
    const location = reportLocation(row);
    const key = `${apoio}\u0000${location}`;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.set(key, { apoio, location, rows: [row] });
    }
  });
  return Array.from(groups.values());
}

export function reportDays(row: ApoioReportRow, now = new Date()): string {
  if (!Number.isFinite(now.getTime()) || !parseDate(row.entrada)) return 'Verificar data';
  if (row.ativo === false) {
    const lastSeen = parseDate(row.ultima_vista);
    if (!lastSeen || lastSeen.date > now) return 'Verificar data';
  }
  const value = diasObservados(row, now);
  if (value === null || !Number.isFinite(value)) return 'Verificar data';
  return String(Math.max(0, Math.round(value)));
}

export function reportFleet(row: ApoioReportRow): string {
  const fleet = text(row.frota);
  const normalized = normaliseForCompare(fleet).replace(/[\s_]+/g, '-');
  return !fleet || normalized === 'sem-frota' ? 'Sem frota informada' : fleet;
}

export function reportEquipment(row: ApoioReportRow): string {
  const equipment = text(row.equipamento);
  const meaningfulEquipment = normaliseForCompare(equipment) === 'equipamento nao informado' ? '' : equipment;
  const values = [meaningfulEquipment, text(row.modelo)].filter(Boolean);
  const unique = values.filter((value, index) => (
    values.findIndex((candidate) => normaliseForCompare(candidate) === normaliseForCompare(value)) === index
  ));
  return unique.join(' / ') || 'Equipamento não informado';
}

export function reportProvider(row: ApoioReportRow): string {
  const location = reportLocation(row);
  if (location === 'Oficina Externa') {
    return text(row.prestador, 'Oficina externa não informada');
  }

  const internalDetails = [text(row.setor), text(row.ponto)].filter(Boolean);
  if (internalDetails.length) return internalDetails.join(' / ');
  if (location === 'Oficina Interna') return 'Oficina Interna';
  if (location === 'Campo') return 'Campo';
  return location || 'Local não informado';
}

function fleetKey(row: ApoioReportRow): string | null {
  const fleet = text(row.frota);
  if (!fleet || normaliseForCompare(fleet).replace(/[\s_]+/g, '-') === 'sem-frota') return null;
  return normaliseForCompare(fleet);
}

function statusKey(value: unknown): string {
  return normaliseForCompare(value).replace(/\s+/g, ' ');
}

export function getReportKpis(rows: ApoioReportRow[]): { label: string; value: number }[] {
  const fleets = new Set<string>();
  rows.forEach((row) => {
    const key = fleetKey(row);
    if (key) fleets.add(key);
  });

  return [
    { label: 'Frotas distintas', value: fleets.size },
    { label: 'Ordens filtradas', value: rows.length },
    { label: 'Internas', value: rows.filter(row => reportLocation(row) === 'Oficina Interna').length },
    { label: 'Externas', value: rows.filter(row => reportLocation(row) === 'Oficina Externa').length },
    { label: 'Andamento', value: rows.filter(row => statusKey(row.status) === 'andamento').length },
    { label: 'Programadas', value: rows.filter(row => statusKey(row.status) === 'programada').length },
    {
      label: 'Aguardando peça',
      value: rows.filter(row => statusKey(row.status) === 'aguardando peca').length,
    },
  ];
}
