import type { Programacao } from '../types';

export const HIDE_ENCERRADAS_STORAGE_KEY = 'bp_hide_encerradas';
// Brasília é tratada como UTC-3 fixo para que a regra operacional não dependa
// do fuso horário do navegador, do processo ou de regras históricas de DST.
export const OPERATIONAL_CUTOFF_HOUR = 7;
export const OPERATIONAL_CUTOFF_MINUTE = 10;
const BRASILIA_OFFSET_MS = -3 * 60 * 60 * 1000;
const OPERATIONAL_WINDOW_VERSION = ':0710';
const DAY_MS = 24 * 60 * 60 * 1000;

export interface HideEncerradasState {
  windowKey: string;
  hidden: boolean;
  syncedToSheet: boolean;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function getBrasiliaDate(date: Date): Date | null {
  const timestamp = date.getTime();
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + BRASILIA_OFFSET_MS);
}

export function getLocalDateStr(date = new Date()): string {
  const brasiliaDate = getBrasiliaDate(date);
  if (!brasiliaDate) return '';

  return `${brasiliaDate.getUTCFullYear()}-${pad2(brasiliaDate.getUTCMonth() + 1)}-${pad2(brasiliaDate.getUTCDate())}`;
}

export function parseLocalDateTime(dateStr: string, timeStr = '00:00'): Date | null {
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const normalizedTime = timeStr || '00:00';
  const timeMatch = normalizedTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!timeMatch) return null;

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const seconds = Number(timeMatch[3] || '0');
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds > 59) return null;

  // Date.parse normaliza datas impossíveis (por exemplo, 31/02). Confira os
  // componentes antes de criar o instante com o offset explícito de Brasília.
  const dateProbe = new Date(`${dateStr}T00:00:00.000Z`);
  if (
    Number.isNaN(dateProbe.getTime()) ||
    dateProbe.getUTCFullYear() !== year ||
    dateProbe.getUTCMonth() + 1 !== month ||
    dateProbe.getUTCDate() !== day
  ) {
    return null;
  }

  const explicitBrasiliaIso = `${dateStr}T${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}-03:00`;
  const parsed = new Date(explicitBrasiliaIso);
  if (Number.isNaN(parsed.getTime())) return null;

  // Confirma que o parser preservou exatamente a data/hora civil informada.
  const parsedBrasilia = getBrasiliaDate(parsed);
  if (
    !parsedBrasilia ||
    parsedBrasilia.getUTCFullYear() !== year ||
    parsedBrasilia.getUTCMonth() + 1 !== month ||
    parsedBrasilia.getUTCDate() !== day ||
    parsedBrasilia.getUTCHours() !== hours ||
    parsedBrasilia.getUTCMinutes() !== minutes ||
    parsedBrasilia.getUTCSeconds() !== seconds
  ) {
    return null;
  }

  return parsed;
}

export function getOperationalCutoff(now = new Date()): Date {
  const localDate = getLocalDateStr(now);
  const todayCutoff = localDate
    ? parseLocalDateTime(localDate, `${pad2(OPERATIONAL_CUTOFF_HOUR)}:${pad2(OPERATIONAL_CUTOFF_MINUTE)}`)
    : null;
  if (!todayCutoff) return new Date(Number.NaN);

  // O instante é comparado em UTC, mas ambos os lados representam a mesma
  // parede civil de Brasília, portanto o resultado é independente de TZ.
  return now.getTime() >= todayCutoff.getTime()
    ? todayCutoff
    : new Date(todayCutoff.getTime() - DAY_MS);
}

export function getOperationalWindowKey(now = new Date()): string {
  const cutoffDate = getLocalDateStr(getOperationalCutoff(now));
  return `${cutoffDate}${OPERATIONAL_WINDOW_VERSION}`;
}

export function getClosedScheduleReferenceDate(schedule: Programacao): Date | null {
  // PCM não é executado nesta tela. Para evitar ocultar imediatamente uma OS
  // recém-detectada usando a antiga data programada, a referência é somente o
  // timestamp oficial de detecção; sem ele, nunca usamos data programada.
  if (schedule.origemRegistro === 'PCM') {
    if (!schedule.encerradoDetectadoEm) return null;
    const detected = new Date(schedule.encerradoDetectadoEm);
    if (!Number.isNaN(detected.getTime())) return detected;
    const fallbackDate = schedule.encerradoDetectadoEm.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(fallbackDate)) return parseLocalDateTime(fallbackDate);
    return null;
  }

  // Para manuais, a data de referência continua sendo a data REALIZADA (o
  // item pertence ao turno em que foi concluído), com data programada como
  // fallback para dados legados.
  const baseDate = schedule.dataRealizada || schedule.dataProgramada;
  if (!baseDate) return null;

  return parseLocalDateTime(baseDate, schedule.horarioAgendado || '00:00');
}

export function shouldHideClosedSchedule(schedule: Programacao, now = new Date()): boolean {
  if (schedule.situacao !== 'ENCERRADO') return false;

  const reference = getClosedScheduleReferenceDate(schedule);
  // Um PCM encerrado sem timestamp ainda não deve ser escondido com base na
  // data programada, pois isso faria uma detecção recente desaparecer.
  if (!reference) return schedule.origemRegistro !== 'PCM';

  return reference.getTime() < getOperationalCutoff(now).getTime();
}

export function countHideableClosedSchedules(schedules: Programacao[], now = new Date()): number {
  return schedules.filter((schedule) => shouldHideClosedSchedule(schedule, now)).length;
}

export function loadHideEncerradasState(): HideEncerradasState | null {
  try {
    const raw = localStorage.getItem(HIDE_ENCERRADAS_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<HideEncerradasState> & { date?: string };
    const windowKey = parsed.windowKey || parsed.date;
    if (!windowKey) return null;

    return {
      windowKey,
      hidden: Boolean(parsed.hidden),
      syncedToSheet: Boolean(parsed.syncedToSheet),
    };
  } catch {
    return null;
  }
}

export function saveHideEncerradasState(state: HideEncerradasState) {
  try {
    localStorage.setItem(HIDE_ENCERRADAS_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

/**
 * Estado EFETIVO da ocultação de encerradas para a janela operacional atual.
 *
 * Após 07:10, encerradas anteriores ao corte ficam ocultas por padrão. A
 * escolha manual continua valendo dentro da janela atual e é resetada na
 * próxima virada porque a chave contém a versão `:0710`.
 */
export function getEffectiveHideEncerradas(now = new Date()): boolean {
  const windowKey = getOperationalWindowKey(now);
  const saved = loadHideEncerradasState();

  if (saved && saved.windowKey === windowKey) {
    return saved.hidden;
  }

  // Nova janela operacional ou primeiro uso: ocultar por padrão. A chave
  // versionada também invalida estados antigos baseados no corte anterior.
  saveHideEncerradasState({ windowKey, hidden: true, syncedToSheet: true });
  return true;
}

/** Registra a escolha manual para a janela operacional atual. */
export function setManualHideEncerradas(hidden: boolean, now = new Date()): void {
  const windowKey = getOperationalWindowKey(now);
  saveHideEncerradasState({ windowKey, hidden, syncedToSheet: true });
}
