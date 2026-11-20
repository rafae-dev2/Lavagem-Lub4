export type SyncIndicatorTone =
  | 'syncing'
  | 'offline'
  | 'cache'
  | 'fresh'
  | 'due'
  | 'idle';

export interface NextSyncCountdown {
  remainingMs: number;
  remainingSeconds: number;
  progressPct: number;
  relativeLabel: string;
  clockLabel: string;
  isDue: boolean;
}

export interface SyncStatusIndicatorInput {
  lastSync: string | null;
  lastSyncMs?: number | null;
  syncing: boolean;
  online: boolean;
  fromCache?: boolean;
  refreshIntervalMs: number;
  nowMs: number;
  locale?: string;
}

export interface SyncStatusIndicatorState {
  resolvedTimestampMs: number | null;
  relativeLabel: string;
  countdown: NextSyncCountdown | null;
  headerSummary: string;
  headerCountdown: string | null;
  sidebarLabel: string;
  tooltip: string;
  tone: SyncIndicatorTone;
}

const DEFAULT_LOCALE = 'pt-BR';
const MIN_REFRESH_INTERVAL_MS = 10_000;

function getRelativeTimeFormatter(
  locale: string,
  numeric: 'always' | 'auto',
  style: 'long' | 'short' | 'narrow' = 'short',
): Intl.RelativeTimeFormat | null {
  if (typeof Intl === 'undefined' || typeof Intl.RelativeTimeFormat !== 'function') {
    return null;
  }
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric, style });
  } catch {
    return null;
  }
}

/**
 * Converte strings de `lastSync` (ISO-8601, `dd/mm/aaaa, hh:mm:ss`, `dd/mm/aaaa hh:mm`,
 * ou textos de cache local como `"Cache local (há 3 min)"`) em epoch ms.
 */
export function parseLastSyncTimestamp(
  lastSync: string | null | undefined,
  fallbackNow = Date.now(),
): number | null {
  if (!lastSync || typeof lastSync !== 'string') return null;
  const trimmed = lastSync.trim();
  if (!trimmed) return null;

  // 1. Formato brasileiro: "19/11/2026, 17:40:12" ou "19/11/2026 17:40"
  const brMatch = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,|\s+às|\s+)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/i,
  );
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]);
    const year = Number(brMatch[3]);
    const hour = Number(brMatch[4]);
    const minute = Number(brMatch[5]);
    const second = Number(brMatch[6] ?? '0');
    const date = new Date(year, month - 1, day, hour, minute, second, 0);
    if (
      !Number.isNaN(date.getTime()) &&
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date.getTime();
    }
  }

  // 2. Texto relativo de cache local: "Cache local (há 3 min)" / "há menos de 1 min"
  if (/menos de 1\s*min/i.test(trimmed)) {
    return Math.max(0, fallbackNow - 30_000);
  }
  const cacheMinMatch = trimmed.match(/h[aá]\s+(\d+)\s*min/i);
  if (cacheMinMatch) {
    const minutes = Number(cacheMinMatch[1]);
    if (Number.isFinite(minutes) && minutes >= 0) {
      return Math.max(0, fallbackNow - minutes * 60_000);
    }
  }

  // 3. ISO-8601 ou qualquer data válida suportada por Date.parse
  const isoTs = Date.parse(trimmed);
  if (Number.isFinite(isoTs)) return isoTs;

  return null;
}

export function formatCountdownClock(remainingMs: number): string {
  const safeSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const pad = (v: number) => String(v).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Formata o tempo decorrido desde a última atualização usando `Intl.RelativeTimeFormat`.
 */
export function formatRelativeLastSync(
  lastSyncMs: number | null,
  nowMs: number,
  locale = DEFAULT_LOCALE,
): string {
  if (lastSyncMs === null || !Number.isFinite(lastSyncMs) || !Number.isFinite(nowMs)) {
    return 'Nunca sincronizado';
  }

  const diffSeconds = Math.max(0, Math.floor((nowMs - lastSyncMs) / 1000));
  if (diffSeconds < 5) {
    return 'agora mesmo';
  }

  const rtf = getRelativeTimeFormatter(locale, 'auto', 'short');
  if (diffSeconds < 60) {
    return rtf ? rtf.format(-diffSeconds, 'second') : `há ${diffSeconds} seg.`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return rtf ? rtf.format(-diffMinutes, 'minute') : `há ${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return rtf ? rtf.format(-diffHours, 'hour') : `há ${diffHours} h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return rtf ? rtf.format(-diffDays, 'day') : `há ${diffDays} d`;
}

/**
 * Calcula a contagem regressiva até a próxima sincronização automática usando
 * `Intl.RelativeTimeFormat` (valor futuro positivo) + relógio `mm:ss` e progresso 0..100%.
 */
export function formatNextSyncCountdown(
  lastSyncMs: number | null,
  nowMs: number,
  refreshIntervalMs: number,
  locale = DEFAULT_LOCALE,
): NextSyncCountdown | null {
  if (lastSyncMs === null || !Number.isFinite(lastSyncMs) || !Number.isFinite(nowMs)) {
    return null;
  }

  const safeInterval = Math.max(MIN_REFRESH_INTERVAL_MS, refreshIntervalMs);
  const elapsedMs = Math.max(0, nowMs - lastSyncMs);
  const remainingMs = Math.max(0, safeInterval - elapsedMs);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const progressPct = Math.max(0, Math.min(100, Math.round((remainingMs / safeInterval) * 100)));
  const isDue = remainingMs === 0;

  if (isDue) {
    return {
      remainingMs: 0,
      remainingSeconds: 0,
      progressPct: 0,
      relativeLabel: 'em breve',
      clockLabel: '00:00',
      isDue: true,
    };
  }

  const rtf = getRelativeTimeFormatter(locale, 'always', 'short');
  let relativeLabel: string;
  if (remainingSeconds < 60) {
    relativeLabel = rtf ? rtf.format(remainingSeconds, 'second') : `em ${remainingSeconds} seg.`;
  } else {
    const remainingMinutes = Math.ceil(remainingSeconds / 60);
    relativeLabel = rtf ? rtf.format(remainingMinutes, 'minute') : `em ${remainingMinutes} min`;
  }

  return {
    remainingMs,
    remainingSeconds,
    progressPct,
    relativeLabel,
    clockLabel: formatCountdownClock(remainingMs),
    isDue: false,
  };
}

export function buildSyncStatusIndicatorState({
  lastSync,
  lastSyncMs = null,
  syncing,
  online,
  fromCache = false,
  refreshIntervalMs,
  nowMs,
  locale = DEFAULT_LOCALE,
}: SyncStatusIndicatorInput): SyncStatusIndicatorState {
  const resolvedTimestampMs =
    typeof lastSyncMs === 'number' && Number.isFinite(lastSyncMs)
      ? lastSyncMs
      : parseLastSyncTimestamp(lastSync, nowMs);

  const relativeLabel = formatRelativeLastSync(resolvedTimestampMs, nowMs, locale);
  const countdown = online && !syncing
    ? formatNextSyncCountdown(resolvedTimestampMs, nowMs, refreshIntervalMs, locale)
    : null;

  const exactLabel = lastSync?.trim() || (resolvedTimestampMs
    ? new Date(resolvedTimestampMs).toLocaleString(locale)
    : 'Nunca sincronizado');

  if (syncing) {
    return {
      resolvedTimestampMs,
      relativeLabel,
      countdown: null,
      headerSummary: 'Atualizando dados…',
      headerCountdown: null,
      sidebarLabel: resolvedTimestampMs ? `Atualizando · último ${relativeLabel}` : 'Sincronizando dados…',
      tooltip: `Sincronizando agora · Última atualização: ${exactLabel}`,
      tone: 'syncing',
    };
  }

  if (!online) {
    return {
      resolvedTimestampMs,
      relativeLabel,
      countdown: null,
      headerSummary: resolvedTimestampMs ? `Cache ${relativeLabel}` : 'Offline · sem cache',
      headerCountdown: null,
      sidebarLabel: resolvedTimestampMs ? `Offline · ${relativeLabel}` : 'Offline · aguardando conexão',
      tooltip: `Modo offline · Última sincronização: ${exactLabel}`,
      tone: 'offline',
    };
  }

  if (resolvedTimestampMs === null) {
    return {
      resolvedTimestampMs: null,
      relativeLabel: 'Nunca sincronizado',
      countdown: null,
      headerSummary: 'Aguardando sincronização',
      headerCountdown: null,
      sidebarLabel: 'Nunca sincronizado',
      tooltip: 'Clique para sincronizar os dados agora.',
      tone: 'idle',
    };
  }

  const tone: SyncIndicatorTone = fromCache ? 'cache' : countdown?.isDue ? 'due' : 'fresh';
  const headerCountdown = countdown
    ? countdown.isDue
      ? 'próx. em breve'
      : `próx. ${countdown.clockLabel}`
    : null;

  const sidebarCountdown = countdown
    ? countdown.isDue
      ? 'próx. atualização em breve'
      : `próx. ${countdown.relativeLabel} (${countdown.clockLabel})`
    : null;

  const headerSummary = relativeLabel === 'agora mesmo'
    ? 'Atualizado agora'
    : `Atualizado ${relativeLabel}`;

  const sidebarLabel = sidebarCountdown
    ? `${headerSummary} · ${sidebarCountdown}`
    : headerSummary;

  const tooltip = countdown
    ? `Última atualização: ${exactLabel} (${relativeLabel}) · Próxima verificação ${countdown.relativeLabel} (${countdown.clockLabel}). Clique para sincronizar agora.`
    : `Última atualização: ${exactLabel} (${relativeLabel}). Clique para sincronizar agora.`;

  return {
    resolvedTimestampMs,
    relativeLabel,
    countdown,
    headerSummary,
    headerCountdown,
    sidebarLabel,
    tooltip,
    tone,
  };
}
