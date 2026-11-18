import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApoioData, ApoioSync } from '../types/apoio';
import {
  apoioClient,
  invalidateApoioSnapshots,
  loadApoioData,
} from '../lib/apoioService';
import {
  hasApoioSyncChanged,
  isNavigatorOnline,
  isPageVisible,
} from '../lib/egressCachePolicy';

export type TVConnection = 'connecting' | 'live' | 'polling' | 'offline';
export interface UseTVOrdersResult {
  /** Last complete snapshot; retained after read failures. */
  data: ApoioData | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  connection: TVConnection;
  /** Client read time; source time remains in data.sync.fonte_atualizada. */
  lastReadAt: string | null;
  refresh: () => Promise<void>;
}

const TV_POLL_MS = 2 * 60_000;
const TV_DEBOUNCE_MS = 800;
const TV_SUBSCRIBED_REUSE_MS = 30_000;
// Escutar apoio_ordens transmitia centenas/milhares de linhas por ciclo via Realtime;
// apoio_sync (1 linha), apoio_grupos e apoio_frotas sinalizam toda mudança real.
const TV_TABLES = ['apoio_sync', 'apoio_grupos', 'apoio_frotas'] as const;

function isBrowserOnline(): boolean {
  return isNavigatorOnline();
}
function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return typeof error === 'string' && error ? error : 'Não foi possível ler o snapshot Apoio.';
}

/** Read-only: never calls syncApoio or a write RPC. */
export function useTVOrders(): UseTVOrdersResult {
  const [data, setData] = useState<ApoioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<TVConnection>('connecting');
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const connectionRef = useRef<TVConnection>('connecting');
  const readInFlightRef = useRef<Promise<void> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readAgainRef = useRef<{ force: boolean } | null>(null);
  const lastSyncRef = useRef<ApoioSync | null>(null);
  const lastLoadedAtRef = useRef(0);
  const dirtyWhileHiddenRef = useRef(false);

  const setConnectionState = useCallback((next: TVConnection) => {
    connectionRef.current = next;
    if (mountedRef.current) setConnection(next);
  }, []);

  const read = useCallback((mode: 'initial' | 'manual' | 'silent', force = mode === 'manual'): Promise<void> => {
    if (!mountedRef.current) return Promise.resolve();
    if (readInFlightRef.current) {
      if (mode === 'initial' && mountedRef.current) setLoading(true);
      if (mode === 'manual' && mountedRef.current) setRefreshing(true);
      return readInFlightRef.current.finally(() => {
        if (mode === 'manual' && mountedRef.current) setRefreshing(false);
      });
    }
    if (mountedRef.current) {
      if (mode === 'initial') setLoading(true);
      if (mode === 'manual') setRefreshing(true);
      if (mode !== 'silent') setError(null);
    }
    const operation = (async () => {
      try {
        const next = await loadApoioData({ force });
        if (!mountedRef.current) return;
        lastSyncRef.current = next.sync ?? null;
        lastLoadedAtRef.current = Date.now();
        dirtyWhileHiddenRef.current = false;
        setData(next);
        setLastReadAt(new Date().toISOString());
        setError(null);
        if (connectionRef.current !== 'live') setConnectionState('polling');
      } catch (readError) {
        if (!mountedRef.current) return;
        setError(errorMessage(readError));
        setConnectionState(isBrowserOnline() ? 'polling' : 'offline');
      } finally {
        if (!mountedRef.current) return;
        if (mode === 'initial') setLoading(false);
        if (mode === 'manual') setRefreshing(false);
      }
    })();
    readInFlightRef.current = operation;
    void operation.finally(() => {
      if (readInFlightRef.current === operation) readInFlightRef.current = null;
    });
    return operation;
  }, [setConnectionState]);

  const refresh = useCallback(async () => {
    await read('manual', true);
  }, [read]);

  useEffect(() => {
    mountedRef.current = true;
    void read('initial', false);
    return () => { mountedRef.current = false; };
  }, [read]);

  useEffect(() => {
    let active = true;
    const channel = apoioClient.channel('tv_orders_realtime');
    for (const table of TV_TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload: { new?: unknown }) => {
        if (!active || !mountedRef.current) return;
        if (table === 'apoio_sync') {
          const nextSync = (payload?.new && typeof payload.new === 'object')
            ? (payload.new as Partial<ApoioSync>)
            : null;
          if (!hasApoioSyncChanged(lastSyncRef.current, nextSync)) {
            return;
          }
        }
        invalidateApoioSnapshots(false);
        if (!isPageVisible()) {
          dirtyWhileHiddenRef.current = true;
          return;
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null;
          if (!active || !mountedRef.current) return;
          if (readInFlightRef.current) {
            readAgainRef.current = { force: true };
            void readInFlightRef.current.finally(() => {
              const queued = readAgainRef.current;
              readAgainRef.current = null;
              if (active && mountedRef.current && queued) void read('silent', queued.force);
            });
          } else {
            void read('silent', true);
          }
        }, TV_DEBOUNCE_MS);
      });
    }
    channel.subscribe((status: string) => {
      if (!active || !mountedRef.current) return;
      if (status === 'SUBSCRIBED') {
        setConnectionState('live');
        if (
          mountedRef.current &&
          isPageVisible() &&
          Date.now() - lastLoadedAtRef.current > TV_SUBSCRIBED_REUSE_MS
        ) {
          void read('silent', false);
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setConnectionState(isBrowserOnline() ? 'polling' : 'offline');
      }
    });
    return () => {
      active = false;
      readAgainRef.current = null;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = null;
      void apoioClient.removeChannel(channel);
    };
  }, [read, setConnectionState]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isPageVisible() || !isBrowserOnline()) return;
      void read('silent', false);
    }, TV_POLL_MS);
    return () => clearInterval(interval);
  }, [read]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOffline = () => setConnectionState('offline');
    const handleOnline = () => {
      if (connectionRef.current !== 'live') setConnectionState('polling');
      if (isPageVisible()) void read('silent', dirtyWhileHiddenRef.current);
    };
    const handleVisible = () => {
      if (!isPageVisible()) return;
      if (connectionRef.current !== 'live') setConnectionState('polling');
      const force = dirtyWhileHiddenRef.current;
      if (force || Date.now() - lastLoadedAtRef.current >= TV_SUBSCRIBED_REUSE_MS) {
        void read('silent', force);
      }
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisible);
    if (!isBrowserOnline()) setConnectionState('offline');
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [read, setConnectionState]);

  return { data, loading, refreshing, error, connection, lastReadAt, refresh };
}

export default useTVOrders;
