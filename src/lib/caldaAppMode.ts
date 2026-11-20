import type { PageType } from '../types';

export type CaldaDockItemId = 'central-gerencial' | 'gestao-ordens-manutencao' | 'controle-apoio' | 'programacoes' | 'more';

export interface CaldaDockItem {
  id: CaldaDockItemId;
  label: string;
  shortLabel: string;
  page?: PageType;
}

export const CALDA_MOBILE_MODE_STORAGE_KEY = 'bp-calda-desktop-mobile-mode';

export const CALDA_PRIMARY_DOCK_ITEMS: readonly CaldaDockItem[] = [
  { id: 'central-gerencial', label: 'Central Gerencial', shortLabel: 'Central', page: 'central-gerencial' },
  { id: 'gestao-ordens-manutencao', label: 'Gestão de Ordens', shortLabel: 'Ordens', page: 'gestao-ordens-manutencao' },
  { id: 'controle-apoio', label: 'Controle Apoio', shortLabel: 'Apoio', page: 'controle-apoio' },
  { id: 'programacoes', label: 'Lavagem / Lubrificação', shortLabel: 'Lavagem', page: 'programacoes' },
  { id: 'more', label: 'Mais operações', shortLabel: 'Mais' },
];

const LAVAGEM_SUBPAGES = new Set<PageType>(['programacoes', 'dashboard', 'importar', 'exportar']);

export function resolveCaldaActiveDockId(currentPage: PageType): CaldaDockItemId {
  if (currentPage === 'central-gerencial') return 'central-gerencial';
  if (currentPage === 'gestao-ordens-manutencao') return 'gestao-ordens-manutencao';
  if (currentPage === 'controle-apoio') return 'controle-apoio';
  if (LAVAGEM_SUBPAGES.has(currentPage)) return 'programacoes';
  return 'more';
}

export function isCaldaPrimaryPage(page: PageType): boolean {
  return resolveCaldaActiveDockId(page) !== 'more';
}

export interface CaldaShellInput {
  isCalda: boolean;
  isMobileViewport: boolean;
  desktopMobileMode: boolean;
}

export interface CaldaShellPresentation {
  isCaldaActive: boolean;
  isMobileAppMode: boolean;
  isDesktopPhoneFrame: boolean;
  showBottomTabBar: boolean;
  showDesktopTopDock: boolean;
  showDesktopMobileToggle: boolean;
  showSidebar: boolean;
}

export function resolveCaldaShellPresentation({
  isCalda,
  isMobileViewport,
  desktopMobileMode,
}: CaldaShellInput): CaldaShellPresentation {
  if (!isCalda) {
    return {
      isCaldaActive: false,
      isMobileAppMode: false,
      isDesktopPhoneFrame: false,
      showBottomTabBar: false,
      showDesktopTopDock: false,
      showDesktopMobileToggle: false,
      showSidebar: true,
    };
  }

  const isDesktopPhoneFrame = !isMobileViewport && desktopMobileMode;
  const isMobileAppMode = isMobileViewport || isDesktopPhoneFrame;

  return {
    isCaldaActive: true,
    isMobileAppMode,
    isDesktopPhoneFrame,
    showBottomTabBar: isMobileAppMode,
    showDesktopTopDock: !isMobileViewport && !isDesktopPhoneFrame,
    showDesktopMobileToggle: !isMobileViewport,
    showSidebar: false,
  };
}

export function readStoredCaldaMobileMode(storage?: Pick<Storage, 'getItem'> | null): boolean {
  const target = storage ?? (typeof window !== 'undefined' ? (() => { try { return window.localStorage; } catch { return null; } })() : null);
  if (!target) return false;
  try {
    return target.getItem(CALDA_MOBILE_MODE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveStoredCaldaMobileMode(enabled: boolean, storage?: Pick<Storage, 'setItem'> | null): void {
  const target = storage ?? (typeof window !== 'undefined' ? (() => { try { return window.localStorage; } catch { return null; } })() : null);
  if (!target) return;
  try {
    target.setItem(CALDA_MOBILE_MODE_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Ignore storage quota or private browsing errors
  }
}
