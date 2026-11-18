import { reportDate } from './apoioReportData';

/** Mantém datas sem horário no dia original e rejeita calendários inválidos. */
export function formatApoioDate(value: string | null | undefined): string {
  if (!value?.trim()) return 'Não informado';
  const formatted = reportDate(value);
  if (formatted === 'Data inconsistente') return 'Data inválida na fonte';
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return formatted;
  // Datas operacionais sem offset representam Brasília, não o fuso do aparelho.
  let normalized = raw.replace(' ', 'T');
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)) normalized += '-03:00';
  const instant = new Date(normalized);
  if (!Number.isFinite(instant.getTime())) return formatted;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(instant);
}

export function isApoioSourceStale(value: string | null | undefined, now = Date.now()): boolean {
  if (!value?.trim() || reportDate(value) === 'Data inconsistente') return true;
  const timestamp = new Date(value).getTime();
  const age = (now - timestamp) / 60_000;
  return !Number.isFinite(age) || age > 75 || age < -5;
}
