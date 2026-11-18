import type { Programacao, DashboardStats } from '../types';
import { compareScheduleDates } from './scheduleOrder';
import { getClosedScheduleReferenceDate, getOperationalCutoff } from './scheduleVisibility';

export const DAILY_EXPORT_TIME_ZONE = 'America/Sao_Paulo';
const brazilClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: DAILY_EXPORT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function getDailyExportWindow(now: Date) {
  if (!Number.isFinite(now.getTime())) throw new Error('Data atual inválida para o relatório.');
  const parts = brazilClock.formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  const today = `${get('year')}-${get('month')}-${get('day')}`;
  const next = new Date(`${today}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const hideClosed = Number(get('hour')) * 60 + Number(get('minute')) >= 7 * 60 + 10;
  return {
    today,
    nextDay: next.toISOString().slice(0, 10),
    cutoffMinutes: hideClosed ? 7 * 60 : 7 * 60 + 10,
    hideClosed,
    phase: hideClosed ? 'apos0710' as const : 'antes0710' as const,
  };
}

/** Chave da janela para invalidar imagens geradas antes da virada do turno. */
export function getDailyExportWindowKey(now: Date): string {
  const window = getDailyExportWindow(now);
  return `${window.today}:${window.phase}`;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function scheduledMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || '0');
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return hours * 60 + minutes + seconds / 60;
}

/** Relatório operacional; nunca modifica status ou registros do banco.
 * Backlog atrasado + andamento aberto + hoje + amanhã até o corte da janela.
 * Antes de 07:10, inclui encerradas do turno ainda vigente, não o histórico.
 * A partir de 07:10, exclui todas as encerradas e o corte de amanhã é 07:00.
 */
export function selectDailyExportSchedules(rows: Programacao[], now: Date): Programacao[] {
  const { today, nextDay, cutoffMinutes, hideClosed } = getDailyExportWindow(now);
  const selected: Programacao[] = [];
  for (const row of rows) {
    if (row.manualArquivadoEm) continue;
    if (row.situacao === 'ENCERRADO') {
      if (hideClosed) continue;
      const reference = getClosedScheduleReferenceDate(row);
      if (reference && reference.getTime() >= getOperationalCutoff(now).getTime()
        && reference.getTime() <= now.getTime()) selected.push(row);
      continue;
    }
    if (row.situacao === 'ATRASADO') {
      selected.push(row);
      continue;
    }
    if (row.situacao !== 'PROGRAMADO' && row.situacao !== 'ANDAMENTO') continue;
    if (!validDate(row.dataProgramada)) {
      // Um serviço já em andamento não pode desaparecer por falta de agenda.
      if (row.situacao === 'ANDAMENTO') selected.push(row);
      continue;
    }
    if (row.dataProgramada < today) {
      selected.push(row.situacao === 'PROGRAMADO' ? { ...row, situacao: 'ATRASADO' } : row);
    } else if (row.dataProgramada === today) {
      selected.push(row);
    } else if (row.dataProgramada === nextDay) {
      const minutes = scheduledMinutes(row.horarioAgendado || '');
      if (minutes !== null && minutes <= cutoffMinutes) selected.push(row);
    }
  }
  return selected.sort(compareScheduleDates);
}

export function getDailyExportStats(rows: Programacao[]): Required<DashboardStats> {
  return {
    total: rows.length,
    atrasado: rows.filter(row => row.situacao === 'ATRASADO').length,
    programado: rows.filter(row => row.situacao === 'PROGRAMADO').length,
    pendente: rows.filter(row => row.situacao === 'PENDENTE').length,
    andamento: rows.filter(row => row.situacao === 'ANDAMENTO').length,
    encerrado: rows.filter(row => row.situacao === 'ENCERRADO').length,
  };
}
