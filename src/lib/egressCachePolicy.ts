export const DEFAULT_SNAPSHOT_FRESH_MS = 90_000;
export const DEFAULT_SNAPSHOT_MAX_VERSION_AGE_MS = 5 * 60_000;
export const SCHEDULES_ACTIVE_REFRESH_MS = 2 * 60_000;
export const SCHEDULES_BACKGROUND_REFRESH_MS = 5 * 60_000;
export const SCHEDULES_MOUNT_REUSE_MS = 90_000;
export const SCHEDULES_MAX_WATERMARK_AGE_MS = 10 * 60_000;
export const SCHEDULES_RESUME_COOLDOWN_MS = 45_000;

export interface SnapshotCacheEntry<T> {
  value: T;
  fetchedAt: number;
  version: string | null;
}

export interface SnapshotCacheOptions {
  freshTtlMs?: number;
  maxVersionAgeMs?: number;
}

export class SharedSnapshotCache<T> {
  private entry: SnapshotCacheEntry<T> | null = null;
  private inFlight: Promise<T> | null = null;
  private readonly freshTtlMs: number;
  private readonly maxVersionAgeMs: number;

  constructor(options: SnapshotCacheOptions = {}) {
    this.freshTtlMs = options.freshTtlMs ?? DEFAULT_SNAPSHOT_FRESH_MS;
    this.maxVersionAgeMs = options.maxVersionAgeMs ?? DEFAULT_SNAPSHOT_MAX_VERSION_AGE_MS;
  }

  peekFresh(now: number): T | null {
    if (!this.entry) return null;
    if (now - this.entry.fetchedAt < this.freshTtlMs) {
      return this.entry.value;
    }
    return null;
  }

  peekWithVersion(serverVersion: string | null, now: number): T | null {
    if (!this.entry) return null;
    if (
      serverVersion !== null &&
      this.entry.version !== null &&
      serverVersion === this.entry.version &&
      now - this.entry.fetchedAt < this.maxVersionAgeMs
    ) {
      return this.entry.value;
    }
    return null;
  }

  hasConditionalEntry(now: number): boolean {
    return (
      this.entry !== null &&
      this.entry.version !== null &&
      now - this.entry.fetchedAt < this.maxVersionAgeMs
    );
  }

  store(value: T, version: string | null, now: number): void {
    this.entry = { value, version, fetchedAt: now };
  }

  invalidate(): void {
    this.entry = null;
  }

  runCoalesced(work: () => Promise<T>): Promise<T> {
    if (this.inFlight) return this.inFlight;
    const promise = work().finally(() => {
      if (this.inFlight === promise) this.inFlight = null;
    });
    this.inFlight = promise;
    return promise;
  }
}

export interface ConditionalLoadOptions<T> {
  cache: SharedSnapshotCache<T>;
  force?: boolean;
  now?: number;
  fetchVersion?: () => Promise<string | null>;
  fetchFull: () => Promise<{ value: T; version: string | null }>;
}

export async function loadWithConditionalCache<T>({
  cache,
  force = false,
  now = Date.now(),
  fetchVersion,
  fetchFull,
}: ConditionalLoadOptions<T>): Promise<T> {
  if (!force) {
    const fresh = cache.peekFresh(now);
    if (fresh !== null) return fresh;
  }

  return cache.runCoalesced(async () => {
    const checkNow = Date.now();
    if (!force) {
      const fresh = cache.peekFresh(checkNow);
      if (fresh !== null) return fresh;

      if (fetchVersion && cache.hasConditionalEntry(checkNow)) {
        try {
          const serverVersion = await fetchVersion();
          const matched = cache.peekWithVersion(serverVersion, Date.now());
          if (matched !== null) return matched;
        } catch {
          // Falha na leitura leve do marcador recai para a leitura completa.
        }
      }
    }

    const result = await fetchFull();
    cache.store(result.value, result.version, Date.now());
    return result.value;
  });
}

export type ApoioSyncWatermarkInput = {
  fonte_atualizada?: string | null;
  total?: number | null;
  erro?: string | null;
} | null | undefined;

export function buildApoioWatermark(
  sync: ApoioSyncWatermarkInput,
  groupCount?: number | null,
  fleetCount?: number | null,
): string | null {
  if (!sync && groupCount == null && fleetCount == null) return null;
  return [
    String(sync?.fonte_atualizada ?? ''),
    String(sync?.total ?? ''),
    String(sync?.erro ?? ''),
    groupCount == null ? '' : String(groupCount),
    fleetCount == null ? '' : String(fleetCount),
  ].join('|');
}

/**
 * Identifica apenas mudanças materiais no singleton apoio_sync.
 * Heartbeats como consultado_em / sincronizado_em / consulta_em_andamento não
 * alteram ordens quando fonte_atualizada, total e erro permanecem iguais.
 */
export function hasApoioSyncChanged(
  previous: ApoioSyncWatermarkInput,
  next: ApoioSyncWatermarkInput,
): boolean {
  if (!next) return true;
  if (!previous) return true;
  return (
    String(previous.fonte_atualizada ?? '') !== String(next.fonte_atualizada ?? '') ||
    String(previous.total ?? '') !== String(next.total ?? '') ||
    String(previous.erro ?? '') !== String(next.erro ?? '')
  );
}

export function buildSchedulesWatermark(
  count: number | null | undefined,
  topId: number | string | null | undefined,
  topUpdatedAt: string | null | undefined,
): string {
  return `${count ?? 0}:${topId ?? ''}:${topUpdatedAt ?? ''}`;
}

export function shouldRunInitialMountSync(input: {
  hasCache: boolean;
  cacheTimestamp: number | null;
  now: number;
  mountReuseMs?: number;
}): boolean {
  if (!input.hasCache || input.cacheTimestamp === null) return true;
  const reuseMs = input.mountReuseMs ?? SCHEDULES_MOUNT_REUSE_MS;
  return input.now - input.cacheTimestamp >= reuseMs;
}

export function resolveSchedulesAutoRefreshMs(activeLavagemPage: boolean): number {
  return activeLavagemPage ? SCHEDULES_ACTIVE_REFRESH_MS : SCHEDULES_BACKGROUND_REFRESH_MS;
}

export function isPageVisible(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState !== 'hidden';
}

export function isNavigatorOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}
