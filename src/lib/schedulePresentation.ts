import { Programacao } from '../types';

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const TECHNICAL_ABSENCE_SEGMENT = /\s*\|\s*encerrada por ausência em \d{4}-\d{2}-\d{2} \d{2}:\d{2}(?=\s*\||$)/gi;
const ONLY_OS_OBSERVATION = /^OS\s*[:#-]?\s*\d+$/i;

/**
 * Remove somente o marcador técnico acrescentado pelo fechamento automático.
 * O texto operacional anterior (inclusive "Execução confirmada") permanece.
 * Uma observação composta apenas pelo identificador OS é redundante na UI,
 * mas o valor recebido do banco nunca é alterado por este helper.
 */
export function cleanScheduleObservation(schedule: Programacao): string {
  const observation = String(schedule.observacao ?? '').trim();
  if (!observation) return '';
  const withoutTechnicalSuffix = observation.replace(TECHNICAL_ABSENCE_SEGMENT, '').trim();
  if (ONLY_OS_OBSERVATION.test(withoutTechnicalSuffix)) return '';
  return withoutTechnicalSuffix;
}

function normalizeDateOnly(value: unknown): string {
  const text = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function hasExplicitTimeZone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
}

/**
 * SQL timestamptz normalmente chega com offset. Para payloads sem offset,
 * usamos UTC como interpretação determinística do instante SQL e só depois
 * projetamos o dia civil no fuso de São Paulo.
 */
function parseSqlTimestamp(value: unknown): Date | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const isoLike = text.includes(' ') ? text.replace(' ', 'T') : text;
  const instant = hasExplicitTimeZone(isoLike) ? isoLike : `${isoLike}Z`;
  const parsed = new Date(instant);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateInSaoPaulo(value: unknown): string {
  const date = parseSqlTimestamp(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : '';
}

/**
 * Retorna a data civil de conclusão que deve aparecer na UI/exportações.
 * PCM somente pode usar a data automática quando está efetivamente encerrado;
 * nenhum timestamp de atividade/suspensão vira execução por inferência.
 */
export function effectiveScheduleCompletionDate(schedule: Programacao): string {
  if (schedule.situacao !== 'ENCERRADO') return '';
  if (
    schedule.origemRegistro === 'PCM'
    && schedule.pcmEdicaoCampos
    && Object.prototype.hasOwnProperty.call(schedule.pcmEdicaoCampos, 'data_realizada')
    && schedule.pcmEdicaoCampos.data_realizada === null
  ) {
    return '';
  }
  const explicitDate = normalizeDateOnly(schedule.dataRealizada);
  if (explicitDate) return explicitDate;
  if (schedule.origemRegistro === 'PCM' && schedule.motivoEncerramento === 'Ausente no snapshot Apoio') {
    return formatDateInSaoPaulo(schedule.encerradoDetectadoEm);
  }
  return '';
}

/** Indica se a data exibida veio do campo manual ou do encerramento PCM. */
export function getScheduleCompletionSource(
  schedule: Programacao,
): 'MANUAL' | 'PCM' | undefined {
  if (!effectiveScheduleCompletionDate(schedule)) return undefined;
  if (schedule.dataRealizadaOrigem) return schedule.dataRealizadaOrigem;
  return schedule.origemRegistro === 'PCM' ? 'PCM' : 'MANUAL';
}

/** Utilitário para o mapper manter a conversão de timestamptz em um só lugar. */
export function scheduleTimestampDateInSaoPaulo(value: unknown): string {
  return formatDateInSaoPaulo(value);
}
