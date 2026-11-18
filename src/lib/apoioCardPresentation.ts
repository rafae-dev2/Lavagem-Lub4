import type { ApoioOrder } from '../types/apoio';
import { parseLocalDateTime } from './scheduleVisibility';

/** Alerta visual de previsão vencida; nunca muda status ou infere finalização. */
export function apoioForecastOverdue(order: Pick<ApoioOrder, 'ativo' | 'previsao'>, now = new Date()): boolean {
  if (!order.ativo || !Number.isFinite(now.getTime())) return false;
  const raw = order.previsao?.trim();
  if (!raw) return false;
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(raw);
  if (!match) return false;
  // Validação civil estrita; datas sem hora vencem somente após o fim do dia.
  const civil = parseLocalDateTime(match[1], match[2] ? `${match[2]}:${match[3] || '00'}` : '23:59:59');
  if (!civil) return false;
  const explicitZone = Boolean(match[4]);
  const timestamp = explicitZone ? new Date(raw.replace(' ', 'T')).getTime() : civil.getTime();
  return Number.isFinite(timestamp) && timestamp < now.getTime();
}
