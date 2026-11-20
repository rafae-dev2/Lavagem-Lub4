import React, { useEffect, useState } from 'react';
import { Clock3, RefreshCw, WifiOff } from 'lucide-react';
import { buildSyncStatusIndicatorState } from '../lib/syncRelativeTime';

interface SyncFreshnessIndicatorProps {
  lastSync: string | null;
  lastSyncAt?: number | null;
  syncing: boolean;
  online: boolean;
  fromCache?: boolean;
  refreshIntervalMs: number;
  variant: 'header' | 'sidebar';
  onRefresh?: () => void;
  disabled?: boolean;
}

function SyncFreshnessIndicatorInner({
  lastSync,
  lastSyncAt = null,
  syncing,
  online,
  fromCache = false,
  refreshIntervalMs,
  variant,
  onRefresh,
  disabled = false,
}: SyncFreshnessIndicatorProps) {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());
  }, [lastSync, lastSyncAt, syncing, online]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Atualiza o relógio relativo + contagem regressiva a cada 1s somente
    // dentro deste componente memoizado, sem re-renderizar o restante do app.
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const state = buildSyncStatusIndicatorState({
    lastSync,
    lastSyncMs: lastSyncAt,
    syncing,
    online,
    fromCache,
    refreshIntervalMs,
    nowMs,
  });

  if (variant === 'sidebar') {
    return (
      <div
        className={`shell-sidebar__last-sync shell-nav-label shell-sync-sidebar is-${state.tone}`}
        title={state.tooltip}
        aria-live="off"
      >
        <span className="shell-sync-sidebar__text">{state.sidebarLabel}</span>
        {state.countdown && !state.countdown.isDue && (
          <span className="shell-sync-sidebar__track" aria-hidden="true">
            <span
              className="shell-sync-sidebar__fill"
              style={{ width: `${state.countdown.progressPct}%` }}
            />
          </span>
        )}
      </div>
    );
  }

  const interactive = Boolean(onRefresh) && !disabled && online && !syncing;

  const content = (
    <>
      <span className="shell-sync-indicator__icon" aria-hidden="true">
        {state.tone === 'offline' ? (
          <WifiOff size={13} />
        ) : state.tone === 'syncing' ? (
          <RefreshCw size={13} className="animate-spin" />
        ) : (
          <Clock3 size={13} />
        )}
      </span>
      <span className="shell-sync-indicator__copy">
        <span className="shell-sync-indicator__relative">{state.headerSummary}</span>
        {state.headerCountdown && (
          <span className="shell-sync-indicator__countdown tabular-nums">
            {state.headerCountdown}
          </span>
        )}
      </span>
      {state.countdown && !state.countdown.isDue && (
        <span className="shell-sync-indicator__meter" aria-hidden="true">
          <span
            className="shell-sync-indicator__meter-fill"
            style={{ width: `${state.countdown.progressPct}%` }}
          />
        </span>
      )}
    </>
  );

  if (interactive && onRefresh) {
    return (
      <button
        type="button"
        onClick={onRefresh}
        className={`shell-sync-indicator is-${state.tone} hidden lg:inline-flex`}
        title={state.tooltip}
        aria-label={`${state.headerSummary}${state.headerCountdown ? `, ${state.headerCountdown}` : ''}. Clique para sincronizar agora`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      role="status"
      aria-live="off"
      className={`shell-sync-indicator is-${state.tone} hidden lg:inline-flex`}
      title={state.tooltip}
    >
      {content}
    </div>
  );
}

const SyncFreshnessIndicator = React.memo(SyncFreshnessIndicatorInner);
SyncFreshnessIndicator.displayName = 'SyncFreshnessIndicator';

export default SyncFreshnessIndicator;
