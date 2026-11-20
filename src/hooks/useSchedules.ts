/**
 * useSchedules.ts — Hook principal de dados com cache local e modo econômico
 *
 * ESTRATÉGIA DE VELOCIDADE E ECONOMIA (Free Tier Supabase):
 * 1. Ao abrir o app: exibe cache local (localStorage) instantaneamente
 * 2. Em background: usa marcador leve (~120 bytes) antes de baixar o snapshot
 *    completo do RPC (~1,3 MB), só baixando quando há alteração real
 * 3. Entre abas do mesmo navegador: BroadcastChannel sincroniza imediatamente
 * 4. Auto-refresh adaptativo: 2 min em telas de Lavagem, 5 min em outros módulos,
 *    pausado quando a aba está oculta ou offline
 * 5. Operações CRUD: atualização otimista; PCM edita somente campos premium via RPC
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Programacao, DashboardStats } from '../types';
import {
  fetchSchedules,
  fetchSchedulesWatermark,
  appendRowToSheet,
  deleteRowFromSheet,
  updateRowInSheet,
} from '../lib/sheetsService';
import { cleanScheduleObservation } from '../lib/schedulePresentation';
import {
  isAbortLikeError,
  isRetryableScheduleError,
  runScheduleFetchWithRetry,
  SCHEDULE_ATTEMPT_TIMEOUT_MS,
  shouldSkipAutoOrResumeSync,
} from '../lib/scheduleSyncPolicy';
import {
  isNavigatorOnline,
  isPageVisible,
  resolveSchedulesAutoRefreshMs,
  SCHEDULES_MAX_WATERMARK_AGE_MS,
  SCHEDULES_RESUME_COOLDOWN_MS,
  shouldRunInitialMountSync,
} from '../lib/egressCachePolicy';
import { nanoid } from 'nanoid';

const CACHE_KEY      = 'bp_schedules_cache_v5';
const CACHE_META_KEY = 'bp_schedules_cache_meta_v5';
const LEGACY_CACHE_KEY = 'bp_schedules_cache_v4';
const LEGACY_CACHE_META_KEY = 'bp_schedules_cache_meta_v4';
const CACHE_TTL_MS   = 10 * 60 * 1000;  // 10 minutos
const SCHEDULES_BROADCAST_CHANNEL = 'bp_lavagem_schedules_v1';

// Janela de proteção: por quanto tempo uma alteração local JÁ CONFIRMADA no
// banco "vence" leituras do servidor que possam estar atrasadas.
const PENDING_GRACE_MS = 6000;
const DELETED_GRACE_MS = 6000;
const PCM_READ_ONLY_MESSAGE = 'Registros PCM são somente leitura para exclusão nesta tela.';
const PCM_INSERT_MESSAGE = 'Registros PCM não podem ser inseridos.';

const EDITABLE_FIELDS = [
  'descricaoPonto',
  'tipoPreventiva',
  'dataProgramada',
  'horarioAgendado',
  'situacao',
  'dataRealizada',
  'observacao',
] as const;

type EditableField = typeof EDITABLE_FIELDS[number];

interface CacheMeta {
  timestamp: number;
  count: number;
  watermark?: string | null;
}

export interface UseSchedulesOptions {
  activeLavagemPage?: boolean;
}

/** Ordena por rowIndex para manter a mesma ordem da planilha */
function sortBySheetOrder(data: Programacao[]): Programacao[] {
  return [...data].sort((a, b) => (a.rowIndex ?? 9999) - (b.rowIndex ?? 9999));
}

function isAutomaticSchedule(schedule: Programacao | undefined): boolean {
  return schedule?.origemRegistro === 'PCM';
}

function valueForComparison(schedule: Programacao, field: EditableField): unknown {
  if (field === 'observacao') return cleanScheduleObservation(schedule);
  return schedule[field];
}

function sameEditableValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return String(a ?? '') === String(b ?? '');
}

function applyEditableUpdates(
  previous: Programacao,
  updates: Partial<Programacao>,
): Programacao {
  const next: Programacao = { ...previous };
  for (const field of EDITABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(updates, field)) continue;
    const value = updates[field];
    if (value !== undefined) next[field] = value as never;
  }
  if (!isAutomaticSchedule(previous) && updates.frota !== undefined) {
    next.frota = updates.frota;
  }
  return next;
}

function changedEditableFields(
  previous: Programacao,
  next: Programacao,
): Partial<Programacao> {
  const changes: Partial<Programacao> = {};
  for (const field of EDITABLE_FIELDS) {
    const before = valueForComparison(previous, field);
    const after = valueForComparison(next, field);
    if (sameEditableValue(before, after)) continue;
    const changedValue = field === 'observacao'
      ? String(after ?? '').trim()
      : next[field];
    Object.assign(changes, { [field]: changedValue });
  }
  if (!isAutomaticSchedule(previous) && previous.frota !== next.frota) {
    changes.frota = next.frota;
  }
  return changes;
}

function sameState(a: Programacao, b: Programacao): boolean {
  return (
    a.situacao === b.situacao &&
    a.dataProgramada === b.dataProgramada &&
    a.dataRealizada === b.dataRealizada &&
    a.horarioAgendado === b.horarioAgendado &&
    (a.observacao || '') === (b.observacao || '') &&
    a.tipoPreventiva === b.tipoPreventiva &&
    a.descricaoPonto === b.descricaoPonto &&
    a.frota === b.frota
  );
}

function invalidateLegacyCache(): void {
  try {
    localStorage.removeItem(LEGACY_CACHE_KEY);
    localStorage.removeItem(LEGACY_CACHE_META_KEY);
  } catch {
    // localStorage pode não existir durante SSR/testes — o cache v5 segue válido.
  }
}

function readCacheMeta(): CacheMeta | null {
  try {
    const meta = localStorage.getItem(CACHE_META_KEY);
    if (!meta) return null;
    const parsed = JSON.parse(meta) as CacheMeta;
    if (typeof parsed?.timestamp !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function loadFromCache(): Programacao[] | null {
  try {
    invalidateLegacyCache();
    const meta = readCacheMeta();
    if (!meta) return null;
    if (Date.now() - meta.timestamp > CACHE_TTL_MS) return null; // expirado
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return sortBySheetOrder(JSON.parse(raw) as Programacao[]);
  } catch {
    return null;
  }
}

function saveToCache(data: Programacao[], watermark?: string | null): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    const existingWatermark = watermark === undefined ? readCacheMeta()?.watermark ?? null : watermark;
    const meta: CacheMeta = {
      timestamp: Date.now(),
      count: data.length,
      watermark: existingWatermark,
    };
    localStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
  } catch {
    // localStorage pode estar cheio — ignorar
  }
}

function touchCacheTimestamp(watermark: string | null): void {
  try {
    const meta = readCacheMeta();
    if (!meta) return;
    localStorage.setItem(
      CACHE_META_KEY,
      JSON.stringify({ ...meta, timestamp: Date.now(), watermark }),
    );
  } catch {
    /* ignorar */
  }
}

function clearCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_META_KEY);
    localStorage.removeItem(LEGACY_CACHE_KEY);
    localStorage.removeItem(LEGACY_CACHE_META_KEY);
  } catch { /* ignorar */ }
}

function getCacheAge(): string | null {
  try {
    const meta = readCacheMeta();
    if (!meta) return null;
    const ageMs = Date.now() - meta.timestamp;
    if (ageMs < 60000) return 'há menos de 1 min';
    const mins = Math.floor(ageMs / 60000);
    return `há ${mins} min`;
  } catch {
    return null;
  }
}

export function useSchedules(options: UseSchedulesOptions = {}) {
  const activeLavagemPage = options.activeLavagemPage ?? true;
  const autoRefreshMs = resolveSchedulesAutoRefreshMs(activeLavagemPage);

  // Inicializar com dados do cache para exibição instantânea
  const [schedules, setSchedules]   = useState<Programacao[]>(() => loadFromCache() ?? []);
  const [loading, setLoading]       = useState<boolean>(() => !loadFromCache());
  const [error, setError]           = useState<string | null>(null);
  const [lastSync, setLastSync]     = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(() => readCacheMeta()?.timestamp ?? null);
  const [syncing, setSyncing]       = useState(false);
  const [fromCache, setFromCache]   = useState<boolean>(() => !!loadFromCache());
  const autoRefreshRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncInProgressRef           = useRef<boolean>(false);
  const queuedSyncRef               = useRef<{ silent: boolean; fresh: boolean; bypassWatermark: boolean } | null>(null);
  const mountedRef                  = useRef(false);
  const lifecycleRef                = useRef(0);
  const activeReadRef               = useRef<AbortController | null>(null);
  const lastAttemptAtRef            = useRef(0);
  const lastSyncCompletedAtRef      = useRef(0);
  const lastWatermarkRef            = useRef<string | null>(readCacheMeta()?.watermark ?? null);
  const lastWatermarkVerifiedAtRef  = useRef<number>(readCacheMeta()?.timestamp ?? 0);
  const recoveryRetryTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastRef                = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    lifecycleRef.current += 1;
    return () => {
      mountedRef.current = false;
      lifecycleRef.current += 1;
      queuedSyncRef.current = null;
      if (recoveryRetryTimerRef.current) {
        clearTimeout(recoveryRetryTimerRef.current);
        recoveryRetryTimerRef.current = null;
      }
      activeReadRef.current?.abort();
      activeReadRef.current = null;
      syncInProgressRef.current = false;
    };
  }, []);

  const schedulesRef = useRef<Programacao[]>(schedules);
  useEffect(() => { schedulesRef.current = schedules; }, [schedules]);

  const pendingWritesRef = useRef<Map<string, { item: Programacao; ts: number }>>(new Map());
  const deletedIdsRef    = useRef<Map<string, number>>(new Map());

  const notifyOtherTabs = useCallback(() => {
    try {
      broadcastRef.current?.postMessage({ type: 'schedules-updated', ts: Date.now() });
    } catch {
      /* ignorar */
    }
  }, []);

  // Sincronização principal — checa marcador leve em leituras automáticas antes do RPC completo
  const syncFromSheet = useCallback(async (
    silent = false,
    fresh = false,
    bypassWatermark = !silent,
  ) => {
    if (!mountedRef.current) return;
    if (!isNavigatorOnline()) {
      if (!silent) setSyncing(false);
      setLoading(false);
      const offlineMsg = schedulesRef.current.length > 0
        ? 'Sem conexão com a internet. Exibindo dados salvos; a sincronização retomará ao reconectar.'
        : 'Sem conexão com a internet. Aguardando reconexão para carregar as programações.';
      setError(offlineMsg);
      console.warn('[useSchedules] Dispositivo offline; aguardando reconexão para sincronizar.');
      return;
    }
    if (syncInProgressRef.current) {
      const previous = queuedSyncRef.current;
      queuedSyncRef.current = {
        silent: previous ? previous.silent && silent : silent,
        fresh: previous ? previous.fresh || fresh : fresh,
        bypassWatermark: previous ? previous.bypassWatermark || bypassWatermark : bypassWatermark,
      };
      return;
    }

    if (recoveryRetryTimerRef.current) {
      clearTimeout(recoveryRetryTimerRef.current);
      recoveryRetryTimerRef.current = null;
    }

    syncInProgressRef.current = true;
    lastAttemptAtRef.current = Date.now();
    const lifecycle = lifecycleRef.current;
    const controller = new AbortController();
    activeReadRef.current = controller;
    const syncStartTs = Date.now();
    if (!silent) setSyncing(true);
    setError(null);

    try {
      const canUseWatermark =
        !bypassWatermark &&
        schedulesRef.current.length > 0 &&
        lastWatermarkRef.current !== null &&
        Date.now() - lastWatermarkVerifiedAtRef.current < SCHEDULES_MAX_WATERMARK_AGE_MS;

      if (canUseWatermark) {
        const remoteWatermark = await fetchSchedulesWatermark(controller.signal);
        if (!mountedRef.current || lifecycle !== lifecycleRef.current) return;
        if (remoteWatermark !== null && remoteWatermark === lastWatermarkRef.current) {
          const nowTs = Date.now();
          lastSyncCompletedAtRef.current = nowTs;
          lastWatermarkVerifiedAtRef.current = nowTs;
          touchCacheTimestamp(remoteWatermark);
          setFromCache(false);
          setLastSyncAt(nowTs);
          setLastSync(new Date(nowTs).toLocaleString('pt-BR'));
          return;
        }
      }

      const [data, latestWatermark] = await Promise.all([
        runScheduleFetchWithRetry(
          (attemptSignal) => fetchSchedules({ fresh, signal: attemptSignal }),
          {
            signal: controller.signal,
            attemptTimeoutMs: SCHEDULE_ATTEMPT_TIMEOUT_MS,
            maxRetries: 1,
            retryDelayMs: 1_000,
            onRetry: (attempt, err) => {
              const detail = err instanceof Error ? err.message : String(err);
              console.warn(`[useSchedules] Tentativa ${attempt} falhou (${detail}); repetindo consulta...`);
            },
          },
        ),
        fetchSchedulesWatermark(controller.signal).catch(() => null),
      ]);

      if (!mountedRef.current || lifecycle !== lifecycleRef.current) return;
      const sorted = sortBySheetOrder(data);
      const nowTs = Date.now();
      const prevLocal = schedulesRef.current;
      const serverIds = new Set(sorted.map(s => s.id));

      const merged = sorted
        .filter(si => {
          const delTs = deletedIdsRef.current.get(si.id);
          if (delTs != null) {
            if (nowTs - delTs < DELETED_GRACE_MS) return false;
            deletedIdsRef.current.delete(si.id);
          }
          return true;
        })
        .map(si => {
          const p = pendingWritesRef.current.get(si.id);
          if (!p) return si;
          if (sameState(si, p.item)) { pendingWritesRef.current.delete(si.id); return si; }
          if (p.ts >= syncStartTs || nowTs - p.ts < PENDING_GRACE_MS) return p.item;
          pendingWritesRef.current.delete(si.id);
          return si;
        });

      const localOnly = prevLocal.filter(s => !serverIds.has(s.id) && !s.rowIndex);
      const finalArr = sortBySheetOrder([...merged, ...localOnly]);

      const syncedNow = Date.now();
      schedulesRef.current = finalArr;
      lastSyncCompletedAtRef.current = syncedNow;
      lastWatermarkRef.current = latestWatermark;
      lastWatermarkVerifiedAtRef.current = syncedNow;
      setSchedules(finalArr);
      saveToCache(finalArr, latestWatermark);
      notifyOtherTabs();
      setFromCache(false);
      setLastSyncAt(syncedNow);
      setLastSync(new Date(syncedNow).toLocaleString('pt-BR'));
      console.log(`[useSchedules] ✅ ${finalArr.length} registros (mesclados; ${pendingWritesRef.current.size} alteração(ões) local(is) pendente(s))`);
    } catch (err: any) {
      if (!mountedRef.current || lifecycle !== lifecycleRef.current) return;
      if (isAbortLikeError(err, controller.signal)) return;
      const retryable = isRetryableScheduleError(err);
      const msg = err?.message || 'Erro ao consultar as programações no Supabase';
      const userMsg = retryable
        ? 'Falha temporária de conexão com o Supabase. Tentando reconectar automaticamente...'
        : msg;

      const cached = loadFromCache();
      if (cached && cached.length > 0) {
        setSchedules(cached);
        setFromCache(true);
        setError(`Usando dados em cache (${getCacheAge()}). ${userMsg}`);
      } else if (schedulesRef.current.length > 0) {
        setFromCache(true);
        setError(`Mantendo últimos dados carregados. ${userMsg}`);
      } else {
        setError(userMsg);
        setSchedules([]);
      }

      if (retryable) {
        console.warn('[useSchedules] Sincronização adiada por falha transitória:', msg);
        recoveryRetryTimerRef.current = setTimeout(() => {
          recoveryRetryTimerRef.current = null;
          if (!mountedRef.current) return;
          if (!isPageVisible() || !isNavigatorOnline()) return;
          void syncFromSheet(true, true, true);
        }, 15_000);
      } else {
        console.error('[useSchedules] ❌ Erro:', msg);
      }
    } finally {
      if (activeReadRef.current === controller) activeReadRef.current = null;
      if (mountedRef.current && lifecycle === lifecycleRef.current) {
        if (!silent) setSyncing(false);
        setLoading(false);
        syncInProgressRef.current = false;
        const queued = queuedSyncRef.current;
        queuedSyncRef.current = null;
        if (queued) void syncFromSheet(queued.silent, queued.fresh, queued.bypassWatermark);
      }
    }
  }, [notifyOtherTabs]);

  // A confirmação é gravada pela RPC do histórico, fora do CRUD da tabela.
  useEffect(() => {
    const onExecutionConfirmed = () => {
      clearCache();
      lastWatermarkRef.current = null;
      void syncFromSheet(true, true, true);
    };
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('bp:pcm-execution-confirmed', onExecutionConfirmed);
    return () => window.removeEventListener('bp:pcm-execution-confirmed', onExecutionConfirmed);
  }, [syncFromSheet]);

  // Sincronização instantânea entre abas do mesmo navegador (0 bytes no Supabase)
  useEffect(() => {
    const applyCacheFromAnotherTab = () => {
      const cached = loadFromCache();
      if (!cached) return;
      const meta = readCacheMeta();
      schedulesRef.current = cached;
      if (meta?.watermark !== undefined) lastWatermarkRef.current = meta.watermark ?? null;
      if (meta?.timestamp) lastWatermarkVerifiedAtRef.current = meta.timestamp;
      const syncedTs = meta?.timestamp ?? Date.now();
      setSchedules(cached);
      setFromCache(false);
      setLastSyncAt(syncedTs);
      setLastSync(new Date(syncedTs).toLocaleString('pt-BR'));
    };

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel(SCHEDULES_BROADCAST_CHANNEL);
        broadcastRef.current = channel;
        channel.onmessage = (event) => {
          if (event?.data?.type === 'schedules-updated') {
            applyCacheFromAnotherTab();
          }
        };
      } catch {
        broadcastRef.current = null;
      }
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === CACHE_KEY || event.key === CACHE_META_KEY) {
        applyCacheFromAnotherTab();
      }
    };
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('storage', onStorage);
    }

    return () => {
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('storage', onStorage);
      }
      try {
        broadcastRef.current?.close();
      } catch {
        /* ignorar */
      }
      broadcastRef.current = null;
    };
  }, []);

  // Carga inicial: mostrar cache imediatamente e só checar servidor se o cache não estiver recente
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cached = loadFromCache();
    const meta = readCacheMeta();
    if (cached && cached.length > 0) {
      setSchedules(cached);
      setFromCache(true);
      setLoading(false);
      const cacheAge = getCacheAge();
      setLastSyncAt(meta?.timestamp ?? null);
      setLastSync(`Cache local (${cacheAge})`);
      if (
        shouldRunInitialMountSync({
          hasCache: true,
          cacheTimestamp: meta?.timestamp ?? null,
          now: Date.now(),
        })
      ) {
        timer = setTimeout(() => void syncFromSheet(true, true, false), 500);
      }
    } else {
      // Adia 0ms para evitar abort duplicado no primeiro ciclo de StrictMode em dev
      timer = setTimeout(() => void syncFromSheet(false, true, true), 0);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [syncFromSheet]);

  // Auto-refresh econômico adaptativo (2 min na Lavagem, 5 min fora dela), pausado com aba oculta
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => {
      const isHidden = !isPageVisible() || !isNavigatorOnline();
      if (
        shouldSkipAutoOrResumeSync({
          now: Date.now(),
          lastCompletedAt: lastSyncCompletedAtRef.current,
          lastAttemptAt: lastAttemptAtRef.current,
          syncInProgress: syncInProgressRef.current,
          isHidden,
          cooldownMs: Math.min(autoRefreshMs - 5_000, SCHEDULES_RESUME_COOLDOWN_MS),
        })
      ) {
        return;
      }
      void syncFromSheet(true, true, false);
    }, autoRefreshMs);

    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [autoRefreshMs, syncFromSheet]);

  // Ao retomar aba ou reconectar rede, verifica com cooldown de 45s (sem rajadas)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    const resume = () => {
      const isHidden = !isPageVisible() || !isNavigatorOnline();
      if (
        shouldSkipAutoOrResumeSync({
          now: Date.now(),
          lastCompletedAt: lastSyncCompletedAtRef.current,
          lastAttemptAt: lastAttemptAtRef.current,
          syncInProgress: syncInProgressRef.current,
          isHidden,
          cooldownMs: SCHEDULES_RESUME_COOLDOWN_MS,
        })
      ) {
        return;
      }
      void syncFromSheet(true, true, false);
    };
    const visible = () => { if (isPageVisible()) resume(); };
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', visible);
    }
    return () => {
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', visible);
      }
    };
  }, [syncFromSheet]);

  // Refresh manual (com spinner visível e bypass completo de cache/marcador)
  const refresh = useCallback(() => {
    clearCache();
    lastWatermarkRef.current = null;
    void syncFromSheet(false, true, true);
  }, [syncFromSheet]);

  // ─── Adicionar múltiplos itens ────────────────────────────────────────────
  const addSchedules = useCallback(async (newItems: Programacao[]): Promise<{ sheetErrors: string[] }> => {
    const sheetErrors: string[] = [];
    const allowedItems = newItems.filter(item => {
      if (!isAutomaticSchedule(item)) return true;
      sheetErrors.push(`Frota ${item.frota}: ${PCM_INSERT_MESSAGE}`);
      return false;
    });
    const itemsWithId = allowedItems.map(item => ({ ...item, id: item.id || nanoid() }));

    if (itemsWithId.length === 0) return { sheetErrors };

    setSchedules(prev => {
      const updated = [...prev, ...itemsWithId];
      saveToCache(updated, null);
      return updated;
    });
    notifyOtherTabs();

    for (const item of itemsWithId) {
      const result = await appendRowToSheet(item);
      if (!result.success) {
        sheetErrors.push(`Frota ${item.frota}: ${result.error}`);
      } else if (result.rowIndex) {
        setSchedules(prev => {
          const updated = prev.map(s =>
            s.id === item.id ? { ...s, rowIndex: result.rowIndex } : s,
          );
          const sorted = sortBySheetOrder(updated);
          saveToCache(sorted, null);
          return sorted;
        });
      }
    }

    clearCache();
    lastWatermarkRef.current = null;
    setTimeout(() => syncFromSheet(true, true, true), 1_000);
    return { sheetErrors };
  }, [notifyOtherTabs, syncFromSheet]);

  // ─── Adicionar item único ─────────────────────────────────────────────────
  const addSingleSchedule = useCallback(async (item: Programacao): Promise<{ success: boolean; sheetError?: string }> => {
    if (isAutomaticSchedule(item)) {
      return { success: false, sheetError: PCM_INSERT_MESSAGE };
    }
    const withId = { ...item, id: item.id || nanoid() };

    setSchedules(prev => {
      const updated = [...prev, withId];
      saveToCache(updated, null);
      return updated;
    });
    notifyOtherTabs();

    const result = await appendRowToSheet(withId);
    if (!result.success) {
      setSchedules(prev => prev.filter(s => s.id !== withId.id));
      return { success: false, sheetError: result.error };
    }

    if (result.rowIndex) {
      setSchedules(prev => {
        const updated = prev.map(s =>
          s.id === withId.id ? { ...s, rowIndex: result.rowIndex } : s,
        );
        const sorted = sortBySheetOrder(updated);
        saveToCache(sorted, null);
        return sorted;
      });
    }

    clearCache();
    lastWatermarkRef.current = null;
    setTimeout(() => syncFromSheet(true, true, true), 1_000);
    return { success: true };
  }, [notifyOtherTabs, syncFromSheet]);

  // ─── Atualizar item ───────────────────────────────────────────────────────
  const updateSchedule = useCallback(async (id: string, updates: Partial<Programacao>): Promise<{ sheetError?: string }> => {
    const previousItem = schedulesRef.current.find(s => s.id === id);
    if (!previousItem) {
      return { sheetError: 'Registro indisponível; sincronize os dados e tente novamente.' };
    }
    const updatedItem = applyEditableUpdates(previousItem, updates);
    const changes = changedEditableFields(previousItem, updatedItem);

    if (Object.keys(changes).length === 0) return {};

    setSchedules(prev => {
      const updated = prev.map(s => (s.id === id ? updatedItem : s));
      saveToCache(updated, null);
      return updated;
    });
    notifyOtherTabs();

    if (updatedItem.rowIndex) {
      pendingWritesRef.current.set(id, { item: updatedItem, ts: Date.now() });

      const result = await updateRowInSheet(updatedItem.rowIndex, updatedItem, changes);
      if (!result.success) {
        pendingWritesRef.current.set(id, { item: previousItem, ts: Date.now() });
        setSchedules(prev => {
          const reverted = prev.map(s => (s.id === id ? previousItem : s));
          saveToCache(reverted, null);
          return reverted;
        });
        notifyOtherTabs();
        return { sheetError: result.error };
      }

      pendingWritesRef.current.set(id, { item: updatedItem, ts: Date.now() });
      clearCache();
      lastWatermarkRef.current = null;
      setTimeout(() => syncFromSheet(true, true, true), 1_200);
    }
    return {};
  }, [notifyOtherTabs, syncFromSheet]);

  // ─── Excluir item ─────────────────────────────────────────────────────────
  const deleteSchedule = useCallback(async (id: string): Promise<{ sheetError?: string }> => {
    const item = schedulesRef.current.find(s => s.id === id);
    const rowIndex = item?.rowIndex;

    if (isAutomaticSchedule(item)) {
      return { sheetError: PCM_READ_ONLY_MESSAGE };
    }

    console.log(`[useSchedules] Excluindo id=${id} rowIndex=${rowIndex}`);

    if (!rowIndex || rowIndex < 1) {
      console.error('[useSchedules] rowIndex inválido:', rowIndex);
      await syncFromSheet(false, true, true);
      return { sheetError: 'Não foi possível identificar o registro. Tente novamente após sincronizar.' };
    }

    const result = await deleteRowFromSheet(rowIndex);

    if (!result.success) {
      console.error('[useSchedules] Erro ao excluir:', result.error);
      return { sheetError: result.error };
    }

    deletedIdsRef.current.set(id, Date.now());
    pendingWritesRef.current.delete(id);

    setSchedules(prev => {
      const updated = prev.filter(s => s.id !== id);
      saveToCache(updated, null);
      return updated;
    });
    notifyOtherTabs();

    clearCache();
    lastWatermarkRef.current = null;
    setTimeout(() => syncFromSheet(true, true, true), 1_000);

    return {};
  }, [notifyOtherTabs, syncFromSheet]);

  // ─── Estatísticas (memoizadas em passagem única) ──────────────────────────
  const stats: DashboardStats = useMemo(() => {
    let pendente = 0;
    let atrasado = 0;
    let programado = 0;
    let encerrado = 0;
    let andamento = 0;
    for (let i = 0; i < schedules.length; i += 1) {
      switch (schedules[i]?.situacao) {
        case 'PENDENTE': pendente += 1; break;
        case 'ATRASADO': atrasado += 1; break;
        case 'PROGRAMADO': programado += 1; break;
        case 'ENCERRADO': encerrado += 1; break;
        case 'ANDAMENTO': andamento += 1; break;
        default: break;
      }
    }
    return { total: schedules.length, pendente, atrasado, programado, encerrado, andamento };
  }, [schedules]);

  return {
    schedules,
    loading,
    error,
    syncing,
    lastSync,
    lastSyncAt,
    autoRefreshMs,
    fromCache,
    stats,
    refresh,
    addSchedules,
    addSingleSchedule,
    updateSchedule,
    deleteSchedule,
  };
}
