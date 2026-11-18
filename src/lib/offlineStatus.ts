export type OfflineSyncPhase = 'online' | 'offline' | 'reconnecting';

export type SidebarStatusTone = 'online' | 'syncing' | 'cache' | 'offline' | 'reconnecting';

export interface OfflineStatusInput {
  online: boolean;
  wasOffline: boolean;
  syncing: boolean;
  fromCache?: boolean;
  lastSync: string | null;
  offlineSince?: string | null;
}

export interface OfflineStatusPresentation {
  phase: OfflineSyncPhase;
  isOffline: boolean;
  sidebarStatusLabel: string;
  sidebarStatusDetail: string | null;
  sidebarStatusTone: SidebarStatusTone;
  sidebarTitle: string;
  headerBadgeLabel: string | null;
  headerBadgeTitle: string | null;
  bannerTagLabel: string;
  bannerTitle: string;
  bannerDescription: string;
  bannerConnectionLabel: string;
  bannerCacheLabel: string;
  bannerSyncLabel: string;
  syncButtonDisabled: boolean;
  syncButtonTitle: string;
}

export function formatOfflineLastSync(lastSync: string | null): string {
  if (!lastSync || !lastSync.trim()) return 'Nunca sincronizado';
  return lastSync.trim();
}

export function shouldRenderOfflineBanner(input: {
  phase: OfflineSyncPhase;
  bannerCollapsed: boolean;
}): boolean {
  if (input.phase === 'reconnecting') return true;
  if (input.phase === 'offline') return !input.bannerCollapsed;
  return false;
}

export function resolveOfflinePresentation(
  input: OfflineStatusInput,
): OfflineStatusPresentation {
  const formattedLastSync = formatOfflineLastSync(input.lastSync);

  if (!input.online) {
    const sinceSuffix = input.offlineSince ? ` desde ${input.offlineSince}` : '';
    const cacheLabel = input.fromCache
      ? 'Cache local ativo'
      : input.lastSync
        ? 'Últimos dados mantidos localmente'
        : 'Aguardando primeira carga';

    return {
      phase: 'offline',
      isOffline: true,
      sidebarStatusLabel: 'Modo Offline',
      sidebarStatusDetail: 'Sincronização automática ao reconectar',
      sidebarStatusTone: 'offline',
      sidebarTitle: `Aplicativo operando totalmente offline${sinceSuffix}. Os dados serão sincronizados automaticamente assim que a conexão retornar. Última sincronização: ${formattedLastSync}`,
      headerBadgeLabel: 'Offline',
      headerBadgeTitle: 'Trabalhando totalmente offline — sincronização automática ao reconectar',
      bannerTagLabel: 'Totalmente Offline',
      bannerTitle: 'Aplicativo trabalhando totalmente offline',
      bannerDescription:
        'Sem conexão com a internet no momento. Você pode continuar consultando os dados disponíveis localmente; os dados serão sincronizados automaticamente assim que a conexão retornar.',
      bannerConnectionLabel: `Sem conexão com a internet${sinceSuffix}`,
      bannerCacheLabel: `${cacheLabel} · ${formattedLastSync}`,
      bannerSyncLabel: 'Sincronização automática ao reconectar',
      syncButtonDisabled: true,
      syncButtonTitle:
        'Sem conexão — a sincronização será retomada automaticamente quando a internet retornar',
    };
  }

  if (input.wasOffline) {
    return {
      phase: 'reconnecting',
      isOffline: false,
      sidebarStatusLabel: input.syncing ? 'Reconectando...' : 'Conexão ativa',
      sidebarStatusDetail: input.syncing
        ? 'Sincronizando dados automaticamente...'
        : 'Sincronização automática retomada',
      sidebarStatusTone: 'reconnecting',
      sidebarTitle: input.syncing
        ? `Conexão restabelecida — sincronizando dados automaticamente. ${formattedLastSync}`
        : `Conexão restabelecida — sincronização automática ativa. ${formattedLastSync}`,
      headerBadgeLabel: input.syncing ? 'Sincronizando...' : 'Reconectado',
      headerBadgeTitle: 'Conexão restabelecida — sincronização automática em andamento',
      bannerTagLabel: 'Conexão Restabelecida',
      bannerTitle: input.syncing
        ? 'Conexão restabelecida — sincronizando dados'
        : 'Conexão restabelecida',
      bannerDescription: input.syncing
        ? 'A internet retornou e o aplicativo está sincronizando os dados automaticamente com o servidor.'
        : 'A internet retornou. A sincronização automática dos dados foi retomada com sucesso.',
      bannerConnectionLabel: 'Conexão ativa',
      bannerCacheLabel: input.fromCache
        ? `Atualizando cache local · ${formattedLastSync}`
        : `Conectado ao servidor · ${formattedLastSync}`,
      bannerSyncLabel: input.syncing
        ? 'Sincronização automática em andamento'
        : 'Sincronização automática concluída',
      syncButtonDisabled: input.syncing,
      syncButtonTitle: input.syncing ? 'Sincronizando dados...' : 'Sincronizar dados agora',
    };
  }

  const normalLabel = input.syncing
    ? 'Sincronizando...'
    : input.fromCache
      ? 'Cache local'
      : 'Supabase';
  const normalTone: SidebarStatusTone = input.syncing
    ? 'syncing'
    : input.fromCache
      ? 'cache'
      : 'online';

  return {
    phase: 'online',
    isOffline: false,
    sidebarStatusLabel: normalLabel,
    sidebarStatusDetail: null,
    sidebarStatusTone: normalTone,
    sidebarTitle: `${normalLabel} — ${formattedLastSync}`,
    headerBadgeLabel: null,
    headerBadgeTitle: null,
    bannerTagLabel: '',
    bannerTitle: '',
    bannerDescription: '',
    bannerConnectionLabel: 'Conectado',
    bannerCacheLabel: formattedLastSync,
    bannerSyncLabel: 'Sincronização automática ativa',
    syncButtonDisabled: input.syncing,
    syncButtonTitle: input.syncing ? 'Sincronizando dados...' : 'Sincronizar dados',
  };
}
