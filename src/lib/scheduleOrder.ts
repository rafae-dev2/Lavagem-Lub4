import { Programacao } from '../types';

function normalized(value: unknown): string {
  return String(value ?? '').trim();
}

function dateRank(value: unknown): number {
  const text = normalized(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function timeRank(value: unknown): number {
  const text = normalized(value);
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return Number.POSITIVE_INFINITY;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return Number.POSITIVE_INFINITY;
  return hours * 60 + minutes;
}

function compareText(a: unknown, b: unknown): number {
  return normalized(a).localeCompare(normalized(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
}

function compareRank(a: number, b: number): number {
  const aInvalid = !Number.isFinite(a);
  const bInvalid = !Number.isFinite(b);
  if (aInvalid && bInvalid) return 0;
  if (aInvalid) return 1;
  if (bInvalid) return -1;
  return a - b;
}

/**
 * Ordem operacional padrão: data programada mais antiga, horário dentro do dia,
 * frota, OS e por fim a posição original para preservar estabilidade.
 * Datas/horários vazios ou inválidos ficam sempre no fim.
 */
export function compareSchedules(a: Programacao, b: Programacao): number {
  const aDate = dateRank(a.dataProgramada);
  const bDate = dateRank(b.dataProgramada);
  const dateDelta = compareRank(aDate, bDate);
  if (dateDelta !== 0) return dateDelta;

  if (aDate !== Number.POSITIVE_INFINITY && bDate !== Number.POSITIVE_INFINITY) {
    const timeDelta = compareRank(timeRank(a.horarioAgendado), timeRank(b.horarioAgendado));
    if (timeDelta !== 0) return timeDelta;
  }

  const fleetDelta = compareText(a.frota, b.frota);
  if (fleetDelta !== 0) return fleetDelta;

  return compareText(a.numeroOS, b.numeroOS);
}

// Nome público de contrato para consumidores que usam Array.prototype.sort.
export const compareScheduleDates = compareSchedules;

/** Ordena sem perder a estabilidade quando todos os critérios de negócio empatam. */
export function sortSchedules<T extends Programacao>(schedules: readonly T[]): T[] {
  return schedules
    .map((schedule, index) => ({ schedule, index }))
    .sort((left, right) => compareSchedules(left.schedule, right.schedule) || left.index - right.index)
    .map(({ schedule }) => schedule);
}

export default sortSchedules;
