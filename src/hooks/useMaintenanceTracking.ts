import { useCallback, useEffect, useRef, useState } from "react";
import { syncApoio } from "../lib/apoioService";
import { loadMaintenanceData } from "../lib/maintenanceTrackingService";
import { ApoioData } from "../types/apoio";

export const MAINTENANCE_REFRESH_EVENT = "bp:maintenance-refresh";
export const MAINTENANCE_STATE_EVENT = "bp:maintenance-state";
export const MAINTENANCE_DEFAULT_REFRESH_MS = 60_000;
export const MAINTENANCE_TRACKING_REFRESH_MS = 3 * 60_000;
export const MAINTENANCE_CENTRAL_REFRESH_MS = 5 * 60_000;
const AUTOMATIC_RETRY_LIMIT = 3;
const AUTOMATIC_RETRY_DELAY_MS = 5_000;

export interface MaintenanceShellState {
  syncing: boolean;
  lastSync: string | null;
  fromCache: boolean;
}

export interface MaintenanceTrackingOptions {
  /** Cadência apenas da leitura automática; o refresh manual sempre pode sincronizar. */
  automaticRefreshMs?: number;
  /** Mantém o comportamento legado de Edge + READ dos demais módulos. */
  syncOnAutomaticRefresh?: boolean;
}

function positiveInterval(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value! > 0 ? value! : fallback;
}

/** Compartilha a integração existente; não escreve ordens nem inventa cache local persistido. */
export function useMaintenanceTracking(options: MaintenanceTrackingOptions = {}) {
  const automaticRefreshMs = positiveInterval(options.automaticRefreshMs, MAINTENANCE_DEFAULT_REFRESH_MS);
  const syncOnAutomaticRefresh = options.syncOnAutomaticRefresh ?? true;
  const [data, setData] = useState<ApoioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(() => new Date());
  const mounted = useRef(false);
  const reading = useRef(false);
  const retryTimer = useRef<number | null>(null);
  const automaticFailures = useRef(0);
  const lastAttemptAt = useRef(0);

  const clearRetry = useCallback(() => {
    if (retryTimer.current !== null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, []);

  const refresh = useCallback(async (manual = true): Promise<void> => {
    if (reading.current) return;
    reading.current = true;
    lastAttemptAt.current = Date.now();
    if (manual) {
      automaticFailures.current = 0;
      clearRetry();
    }
    if (mounted.current) setRefreshing(true);
    let sourceError = "";
    try {
      if (manual || syncOnAutomaticRefresh) {
        try {
          await syncApoio({ force: manual });
        } catch (err) {
          sourceError = err instanceof Error ? err.message : String(err);
        }
      }
      const next = await loadMaintenanceData({ force: manual });
      if (mounted.current) {
        // Só substitui a fotografia depois de uma leitura completa e validada.
        setData(next);
        setError(sourceError);
        // Uma atualização por ciclo: evita a recomputação clock -> refresh -> clock.
        setClock(new Date());
      }
      automaticFailures.current = 0;
    } catch (err) {
      const readError = err instanceof Error ? err.message : String(err);
      if (mounted.current) {
        setError([sourceError, readError].filter(Boolean).join(" · "));
      }
      if (!manual && mounted.current && automaticFailures.current < AUTOMATIC_RETRY_LIMIT) {
        automaticFailures.current += 1;
        const delay = AUTOMATIC_RETRY_DELAY_MS * automaticFailures.current;
        clearRetry();
        retryTimer.current = window.setTimeout(() => {
          retryTimer.current = null;
          if (mounted.current && document.visibilityState === "visible") void refresh(false);
        }, delay);
      }
    } finally {
      reading.current = false;
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [clearRetry, syncOnAutomaticRefresh]);

  useEffect(() => {
    mounted.current = true;
    // A Central lê primeiro a fotografia do READ; o padrão legado continua Edge + READ.
    void refresh(false);
    const onRefresh = () => {
      // Botão e evento explícitos são sempre sincronização + leitura.
      void refresh(true);
    };
    const maybeRefreshOnVisible = () => {
      if (document.visibilityState !== "visible" || reading.current) return;
      // Retomar uma aba não pode disparar refresh em cada alternância de visibilidade.
      if (Date.now() - lastAttemptAt.current >= automaticRefreshMs) void refresh(false);
    };
    const handleOnline = () => {
      if (document.visibilityState !== "visible" || reading.current) return;
      void refresh(false);
    };
    const timer = window.setInterval(maybeRefreshOnVisible, automaticRefreshMs);
    window.addEventListener(MAINTENANCE_REFRESH_EVENT, onRefresh);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", maybeRefreshOnVisible);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      clearRetry();
      window.removeEventListener(MAINTENANCE_REFRESH_EVENT, onRefresh);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", maybeRefreshOnVisible);
    };
  }, [automaticRefreshMs, clearRetry, refresh]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent<MaintenanceShellState>(MAINTENANCE_STATE_EVENT, {
        detail: {
          syncing: refreshing || loading,
          lastSync: data?.sync?.sincronizado_em || null,
          fromCache: false,
        },
      }),
    );
  }, [data?.sync?.sincronizado_em, refreshing, loading]);

  return { data, loading, refreshing, error, refresh, clock };
}
