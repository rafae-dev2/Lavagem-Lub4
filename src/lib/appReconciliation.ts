import type { MaintenanceShellState } from '../hooks/useMaintenanceTracking';
import type { Programacao } from '../types';
import { formatApoioDate } from './apoioDate';
import { parseLastSyncTimestamp } from './syncRelativeTime';

export interface EffectiveShellSync {
  syncing: boolean;
  lastSync: string | null;
  lastSyncAt: number | null;
  refreshIntervalMs: number;
  fromCache: boolean;
}

export function areMaintenanceShellStatesEqual(
  prev: MaintenanceShellState,
  next: MaintenanceShellState,
): boolean {
  return (
    prev.syncing === next.syncing &&
    prev.lastSync === next.lastSync &&
    prev.fromCache === next.fromCache
  );
}

/**
 * Preserves reference identity for derived schedule slices (such as
 * `visibleSchedules`) whenever every element reference matches in order,
 * avoiding redundant downstream React.memo reconciliation on mobile.
 */
export function stabilizeScheduleListReference(
  previous: Programacao[] | null,
  next: Programacao[],
): Programacao[] {
  if (!previous || previous === next) return next;
  if (previous.length !== next.length) return next;
  for (let i = 0; i < next.length; i += 1) {
    if (previous[i] !== next[i]) return next;
  }
  return previous;
}

export function resolveEffectiveShellSync(params: {
  maintenancePage: boolean;
  maintenanceShell: MaintenanceShellState;
  maintenanceRefreshIntervalMs: number;
  lavagemSyncing: boolean;
  lavagemLastSync: string | null;
  lavagemLastSyncAt: number | null;
  lavagemRefreshIntervalMs: number;
  lavagemFromCache: boolean;
}): EffectiveShellSync {
  if (params.maintenancePage) {
    return {
      syncing: params.maintenanceShell.syncing,
      lastSync: params.maintenanceShell.lastSync
        ? formatApoioDate(params.maintenanceShell.lastSync)
        : null,
      lastSyncAt: parseLastSyncTimestamp(params.maintenanceShell.lastSync),
      refreshIntervalMs: params.maintenanceRefreshIntervalMs,
      fromCache: params.maintenanceShell.fromCache,
    };
  }

  return {
    syncing: params.lavagemSyncing,
    lastSync: params.lavagemLastSync,
    lastSyncAt: params.lavagemLastSyncAt,
    refreshIntervalMs: params.lavagemRefreshIntervalMs,
    fromCache: params.lavagemFromCache,
  };
}
