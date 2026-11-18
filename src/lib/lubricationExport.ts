import type { Programacao, StatusType } from '../types';
import { matchesPCMReportFilters, type PCMReportFilters } from './pcmReportFilters';
import { selectDailyExportSchedules } from './dailyExport';
import { compareScheduleDates } from './scheduleOrder';
import { cleanScheduleObservation, effectiveScheduleCompletionDate } from './schedulePresentation';
import { getClosedScheduleReferenceDate, getLocalDateStr, parseLocalDateTime } from './scheduleVisibility';

const DAY_MS=24*60*60*1000;

/** Início da janela atual de encerramentos: 07:00 até antes das07:00 do próximo dia. */
export function getLubricationClosedWindowStart(now:Date):Date|null {
  if(!Number.isFinite(now.getTime()))return null;
  const todayStart=parseLocalDateTime(getLocalDateStr(now),'07:00');
  if(!todayStart)return null;
  return now.getTime()>=todayStart.getTime()
    ? todayStart
    : parseLocalDateTime(getLocalDateStr(new Date(todayStart.getTime()-DAY_MS)),'07:00');
}

export interface LubricationExportOptions {
  status: StatusType | '';
  filters: PCMReportFilters;
}

/** Abertas seguem a janela operacional; encerradas pertencem ao turno07:00–07:00 (Brasília). */
export function selectLubricationExportSchedules(
  rows: Programacao[],
  now: Date,
  options: LubricationExportOptions,
): Programacao[] {
  // Retirar as encerradas antes da janela evita duplicá-las antes das 07:10.
  const operational = selectDailyExportSchedules(rows.filter(row => row.situacao !== 'ENCERRADO'), now);
  const start = getLubricationClosedWindowStart(now);
  const closed = rows.filter(row => {
    if (row.situacao !== 'ENCERRADO' || row.manualArquivadoEm || !start) return false;
    if (row.origemRegistro !== 'PCM' && !row.dataRealizada) return false;
    // Uma virada de meia-noite não encerra o turno: a janela só reinicia às07:00.
    // Sem referência de encerramento não é possível afirmar que pertence ao intervalo.
    const reference = getClosedScheduleReferenceDate(row);
    return Boolean(reference && reference.getTime() >= start.getTime() && reference.getTime() <= now.getTime());
  });
  return [...operational, ...closed]
    .filter(row => (!options.status || row.situacao === options.status)
      && matchesPCMReportFilters(row, { ...options.filters, semana: '' }))
    .map(row => ({
      ...row,
      observacao: cleanScheduleObservation(row),
      dataRealizada: row.origemRegistro === 'PCM'
        ? effectiveScheduleCompletionDate(row)
        : row.dataRealizada,
    }))
    .sort(compareScheduleDates);
}
