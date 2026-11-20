import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PageType } from "../types";
import {
  LayoutDashboard,
  BarChart3,
  Calendar,
  List,
  Upload,
  Download,
  Settings,
  Menu,
  X,
  RefreshCw,
  ChevronRight,
  Palette,
  Wrench,
  Monitor,
  Building2,
  ShieldCheck,
  Droplets,
  Eye,
  EyeOff,
  Truck,
  Wheat,
  Tractor,
  Wifi,
  WifiOff,
  Database,
  ChevronUp,
  Smartphone,
  Monitor as DesktopIcon,
  MoreHorizontal,
  ClipboardList,
  Search,
  Star,
} from "lucide-react";
import { useTheme, THEMES } from "../contexts/ThemeContext";
import NotificationPanel from "./NotificationPanel";
import AmbientBrandWatermark from "./AmbientBrandWatermark";
import SyncFreshnessIndicator from "./SyncFreshnessIndicator";
import PWAInstallButton from "./PWAInstallButton";
import QuickCommandPalette, {
  type PaletteActionEntry,
  type PaletteModuleEntry,
} from "./QuickCommandPalette";
import { AppAlert } from "../hooks/useNotifications";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import {
  resolveOfflinePresentation,
  shouldRenderOfflineBanner,
} from "../lib/offlineStatus";
import {
  CALDA_PRIMARY_DOCK_ITEMS,
  type CaldaDockItemId,
  readStoredCaldaMobileMode,
  resolveCaldaActiveDockId,
  resolveCaldaShellPresentation,
  saveStoredCaldaMobileMode,
} from "../lib/caldaAppMode";
import {
  readFavoritePages,
  readRecentPages,
  recordRecentPage,
  toggleFavoritePage,
} from "../lib/quickCommandPalette";
import "../styles/shell-theme.css";
import "../styles/sidebar-motion.css";
import "../styles/command-palette.css";

interface LayoutProps {
  children: React.ReactNode;
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  onRefresh: () => void;
  syncing: boolean;
  lastSync: string | null;
  lastSyncAt?: number | null;
  refreshIntervalMs?: number;
  alertCount: number;
  fromCache?: boolean;
  alerts: AppAlert[];
  unreadCount: number;
  browserPermission: NotificationPermission;
  onRequestPermission: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  hideEncerradas?: boolean;
  onToggleEncerradas?: () => void;
}

const navItems: {
  id: PageType;
  label: string;
  icon: React.ComponentType<any>;
  section: string;
}[] = [
  { id: "central-gerencial", label: "Central Gerencial", icon: BarChart3, section: "Inteligência Gerencial" },
  {
    id: "gestao-ordens-manutencao",
    label: "Gestão de Ordens Manutenção",
    icon: Wrench,
    section: "Operação & Manutenção",
  },
  {
    id: "controle-apoio",
    label: "Controle de Equipamentos — Apoio",
    icon: Wrench,
    section: "Operação & Manutenção",
  },
  {
    id: "programacoes",
    label: "Lavagem / Lubrificação",
    icon: List,
    section: "Rotina de Frotas",
  },
  {
    id: "calendario",
    label: "Calendário",
    icon: Calendar,
    section: "Rotina de Frotas",
  },
  {
    id: "reformas-apoio",
    label: "Reformas — Equipamentos Apoio",
    icon: Building2,
    section: "Controle de Reformas",
  },
  { id: "reformas-rodomuda", label: "Reforma — Carretas Rodomuda", icon: Truck, section: "Controle de Reformas" },
  { id: "reformas-colhedoras", label: "Reforma — Colhedoras", icon: Wheat, section: "Controle de Reformas" },
  { id: "reformas-trator-transbordo", label: "Reforma — Trator Transbordo", icon: Tractor, section: "Controle de Reformas" },
  { id: "reformas-trator-reboque", label: "Reforma — Trator Reboque", icon: Tractor, section: "Controle de Reformas" },
  {
    id: "preventivas-canavieiras",
    label: "Preventivas — Carretas Canavieiras",
    icon: ShieldCheck,
    section: "Carretas Canavieiras",
  },
  {
    id: "lubrificacao-canavieiras",
    label: "Lubrificação — Carretas Canavieiras",
    icon: Droplets,
    section: "Carretas Canavieiras",
  },
  {
    id: "modo-tv",
    label: "Modo TV — Emergências",
    icon: Monitor,
    section: "Monitoramento",
  },
  {
    id: "modo-tv-externas",
    label: "Modo TV — Ordens Externas",
    icon: Building2,
    section: "Monitoramento",
  },
  {
    id: "configuracoes",
    label: "Configurações",
    icon: Settings,
    section: "Sistema",
  },
];

// Rótulos completos (inclui as sub-abas de Lavagem que saíram da barra lateral)
// usados apenas para o título do cabeçalho.
const PAGE_LABELS: Partial<Record<PageType, string>> = {
  "central-gerencial": "Central Gerencial — Inteligência de Manutenção",
  "gestao-ordens-manutencao": "Gestão de Ordens Manutenção",
  "controle-apoio": "Controle de Equipamentos — Apoio",
  "modo-tv": "Modo TV — Emergências",
  "modo-tv-externas": "Modo TV — Ordens Externas",
  dashboard: "Dashboard",
  programacoes: "Lavagem / Lubrificação",
  calendario: "Calendário",
  importar: "Importar",
  exportar: "Exportar",
  configuracoes: "Configurações",
  "preventivas-canavieiras": "Preventivas — Carretas Canavieiras",
  "lubrificacao-canavieiras": "Lubrificação — Carretas Canavieiras",
  "reformas-apoio": "Reformas — Equipamentos Apoio",
  "reformas-rodomuda": "Controle de Reforma Carretas Rodomuda",
  "reformas-colhedoras": "Controle de Reforma Colhedora",
  "reformas-trator-transbordo": "Controle Reforma Trator Transbordo",
  "reformas-trator-reboque": "Controle Reforma Trator Reboque",

};

function Layout({
  children,
  currentPage,
  onNavigate,
  onRefresh,
  syncing,
  lastSync,
  lastSyncAt = null,
  refreshIntervalMs = 120_000,
  alertCount,
  fromCache,
  alerts,
  unreadCount,
  browserPermission,
  onRequestPermission,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  hideEncerradas = true,
  onToggleEncerradas,
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [caldaMoreOpen, setCaldaMoreOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const validNavPageIds = useMemo(() => navItems.map((item) => item.id), []);
  const [favoritePages, setFavoritePages] = useState<PageType[]>(() =>
    readFavoritePages(navItems.map((item) => item.id)),
  );
  const [recentPages, setRecentPages] = useState<PageType[]>(() =>
    readRecentPages(navItems.map((item) => item.id)),
  );
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : false,
  );
  const [caldaDesktopMobileMode, setCaldaDesktopMobileMode] = useState<boolean>(() =>
    readStoredCaldaMobileMode(),
  );
  const [navPopup, setNavPopup] = useState<{ section: string; top: number; left: number } | null>(null);
  const [offlineBannerCollapsed, setOfflineBannerCollapsed] = useState(false);
  const [v32Now, setV32Now] = useState<Date>(() => new Date());
  const sidebarRef = useRef<HTMLElement | null>(null);
  const sidebarPanelRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const popupTriggerRef = useRef<HTMLButtonElement | null>(null);
  const popupCloseTimerRef = useRef<number | null>(null);
  const { theme, setTheme, themeInfo } = useTheme();
  const isDashboardV32 = theme === "dashboard-v32";
  const isCalda = theme === "calda";
  const caldaPresentation = resolveCaldaShellPresentation({
    isCalda,
    isMobileViewport,
    desktopMobileMode: caldaDesktopMobileMode,
  });
  const caldaActiveDockId = resolveCaldaActiveDockId(currentPage);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobileViewport(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  const toggleCaldaDesktopMobileMode = useCallback(() => {
    setCaldaDesktopMobileMode((prev) => {
      const next = !prev;
      saveStoredCaldaMobileMode(next);
      return next;
    });
    setCaldaMoreOpen(false);
  }, []);

  useEffect(() => {
    if (!isCalda) setCaldaMoreOpen(false);
  }, [isCalda]);

  useEffect(() => {
    if (!isDashboardV32 || typeof window === "undefined") return;
    setV32Now(new Date());
    const id = window.setInterval(() => setV32Now(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [isDashboardV32]);
  const { isOnline, wasOffline, offlineSince } = useNetworkStatus(syncing);
  const offlinePresentation = resolveOfflinePresentation({
    online: isOnline,
    wasOffline,
    syncing,
    fromCache,
    lastSync,
    offlineSince,
  });
  const showOfflineBanner = shouldRenderOfflineBanner({
    phase: offlinePresentation.phase,
    bannerCollapsed: offlineBannerCollapsed,
  });
  const currentSection = navItems.find(item => item.id === currentPage)?.section || (["dashboard", "importar", "exportar"].includes(currentPage) ? "Rotina de Frotas" : "");

  useEffect(() => {
    if (!isOnline) {
      setOfflineBannerCollapsed(false);
    }
  }, [isOnline]);

  const supportsDesktopSidebarMotion = () =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches;

  const clearPopupCloseTimer = useCallback(() => {
    if (popupCloseTimerRef.current !== null) {
      window.clearTimeout(popupCloseTimerRef.current);
      popupCloseTimerRef.current = null;
    }
  }, []);

  const closeNavPopup = useCallback((blurTrigger = false) => {
    clearPopupCloseTimer();
    if (blurTrigger) popupTriggerRef.current?.blur();
    popupTriggerRef.current = null;
    setNavPopup(null);
  }, [clearPopupCloseTimer]);

  const scheduleNavPopupClose = useCallback(() => {
    clearPopupCloseTimer();
    if (typeof window === "undefined") return;
    popupCloseTimerRef.current = window.setTimeout(() => {
      popupTriggerRef.current = null;
      setNavPopup(null);
      popupCloseTimerRef.current = null;
    }, 150);
  }, [clearPopupCloseTimer]);

  const openNavPopup = useCallback((section: string, trigger: HTMLButtonElement) => {
    if (!supportsDesktopSidebarMotion()) return;
    clearPopupCloseTimer();
    const panel = sidebarPanelRef.current;
    if (!panel) return;
    const panelRect = panel.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const estimatedHeight = Math.min(520, Math.max(180, window.innerHeight * 0.7));
    const maxTop = Math.max(12, window.innerHeight - estimatedHeight - 12);
    popupTriggerRef.current = trigger;
    setNavPopup({
      section,
      left: Math.max(panelRect.right, panelRect.left + 256) + 8,
      top: Math.max(12, Math.min(triggerRect.top - 8, maxTop)),
    });
  }, [clearPopupCloseTimer]);

  const navigateFromSidebar = useCallback((page: PageType) => {
    onNavigate(page);
    setSidebarOpen(false);
    setCaldaMoreOpen(false);
    setCommandPaletteOpen(false);
    closeNavPopup();
  }, [closeNavPopup, onNavigate]);

  const handleToggleFavorite = useCallback((page: PageType) => {
    setFavoritePages((prev) => toggleFavoritePage(prev, page));
  }, []);

  useEffect(() => {
    if (!validNavPageIds.includes(currentPage)) return;
    setRecentPages((prev) => recordRecentPage(prev, currentPage));
  }, [currentPage, validNavPageIds]);

  useEffect(() => {
    const handleGlobalShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowThemePicker(false);
        setCaldaMoreOpen(false);
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalShortcut);
    return () => window.removeEventListener("keydown", handleGlobalShortcut);
  }, []);

  const paletteModules = useMemo<PaletteModuleEntry[]>(
    () =>
      navItems.map((item) => ({
        id: item.id,
        label: item.label,
        section: item.section,
        icon: item.icon,
        keywords:
          item.id === "programacoes"
            ? ["lavagem", "lubrificacao", "oleo", "troca", "frota"]
            : item.id === "controle-apoio"
              ? ["apoio", "ordens", "painel", "equipamentos", "oficina"]
              : item.id === "central-gerencial"
                ? ["bi", "dashboard", "indicadores", "kpi", "relatorio"]
                : item.id === "modo-tv" || item.id === "modo-tv-externas"
                  ? ["tv", "painel", "monitor", "emergencia", "externa"]
                  : item.id === "configuracoes"
                    ? ["tema", "imagens", "fotos", "pwa", "sistema"]
                    : undefined,
      })),
    [],
  );

  const paletteActions = useMemo<PaletteActionEntry[]>(() => {
    const list: PaletteActionEntry[] = [
      {
        id: "sync-now",
        label: syncing ? "Sincronizando dados..." : "Sincronizar dados agora",
        description: "Atualiza ordens, reformas e programações da integração",
        keywords: ["atualizar", "refresh", "supabase", "sync"],
        icon: RefreshCw,
        onSelect: () => {
          if (!offlinePresentation.syncButtonDisabled) onRefresh();
        },
      },
      {
        id: "open-theme-picker",
        label: "Trocar tema visual",
        description: `Tema ativo: ${themeInfo.label}`,
        keywords: ["aparencia", "calda", "vitrea", "verdan", "escuro", "claro"],
        icon: Palette,
        onSelect: () => setShowThemePicker(true),
      },
    ];
    if (caldaPresentation.showDesktopMobileToggle) {
      list.unshift({
        id: "toggle-mobile-mode",
        label: caldaDesktopMobileMode ? "Voltar ao Modo Desktop" : "Ativar Modo Celular (App)",
        description: "Alterna entre tela cheia e visualização app com barra inferior",
        keywords: ["celular", "mobile", "app", "dock", "calda"],
        icon: caldaDesktopMobileMode ? DesktopIcon : Smartphone,
        onSelect: toggleCaldaDesktopMobileMode,
      });
    }
    if (onToggleEncerradas) {
      list.push({
        id: "toggle-closed",
        label: hideEncerradas ? "Mostrar ordens encerradas" : "Ocultar encerradas antigas",
        description: "Alterna a visibilidade das ordens anteriores ao corte das 07:10",
        keywords: ["encerradas", "historico", "filtro", "corte"],
        icon: hideEncerradas ? Eye : EyeOff,
        onSelect: onToggleEncerradas,
      });
    }
    return list;
  }, [
    syncing,
    offlinePresentation.syncButtonDisabled,
    onRefresh,
    themeInfo.label,
    caldaPresentation.showDesktopMobileToggle,
    caldaDesktopMobileMode,
    toggleCaldaDesktopMobileMode,
    onToggleEncerradas,
    hideEncerradas,
  ]);

  const handleCaldaDockClick = useCallback((itemId: CaldaDockItemId) => {
    if (itemId === "more") {
      setCaldaMoreOpen((prev) => !prev);
      return;
    }
    const target = CALDA_PRIMARY_DOCK_ITEMS.find((item) => item.id === itemId);
    if (target?.page) {
      navigateFromSidebar(target.page);
    }
  }, [navigateFromSidebar]);

  useEffect(() => {
    if (!sidebarOpen && !showThemePicker && !navPopup && !caldaMoreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
        setShowThemePicker(false);
        setCaldaMoreOpen(false);
        closeNavPopup(Boolean(navPopup));
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeNavPopup, navPopup, sidebarOpen, showThemePicker, caldaMoreOpen]);

  useEffect(() => {
    if (!navPopup) return;
    const closeFromScrollOrResize = () => closeNavPopup();
    const nav = navRef.current;
    nav?.addEventListener("scroll", closeFromScrollOrResize, { passive: true });
    window.addEventListener("scroll", closeFromScrollOrResize, { passive: true });
    window.addEventListener("resize", closeFromScrollOrResize);
    return () => {
      nav?.removeEventListener("scroll", closeFromScrollOrResize);
      window.removeEventListener("scroll", closeFromScrollOrResize);
      window.removeEventListener("resize", closeFromScrollOrResize);
    };
  }, [closeNavPopup, navPopup]);

  useEffect(() => () => clearPopupCloseTimer(), [clearPopupCloseTimer]);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar || typeof window === "undefined") return;
    const mobileMode = window.matchMedia("(max-width: 1023px), (pointer: coarse)");
    const syncInertState = () => {
      if (mobileMode.matches && !sidebarOpen) sidebar.setAttribute("inert", "");
      else sidebar.removeAttribute("inert");
    };
    syncInertState();
    mobileMode.addEventListener?.("change", syncInertState);
    return () => mobileMode.removeEventListener?.("change", syncInertState);
  }, [sidebarOpen]);

  const caldaDockIcon = (id: CaldaDockItemId, size = 18) => {
    switch (id) {
      case "central-gerencial": return <BarChart3 size={size} aria-hidden="true" />;
      case "gestao-ordens-manutencao": return <ClipboardList size={size} aria-hidden="true" />;
      case "controle-apoio": return <Wrench size={size} aria-hidden="true" />;
      case "programacoes": return <List size={size} aria-hidden="true" />;
      default: return <MoreHorizontal size={size} aria-hidden="true" />;
    }
  };

  return (
    <div
      className={`app-shell flex h-screen overflow-hidden ${currentPage === "controle-apoio" ? "app-shell--apoio-reference" : ["programacoes", "dashboard", "importar", "exportar"].includes(currentPage) ? "app-shell--lub" : ""}${caldaPresentation.isMobileAppMode ? " app-shell--calda-app-mode" : ""}${caldaPresentation.isDesktopPhoneFrame ? " app-shell--calda-phone-frame" : ""}`}
      style={{
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
      }}
    >
      {/* Desktop bar to exit Modo Celular back to full desktop */}
      {caldaPresentation.isDesktopPhoneFrame && (
        <div className="calda-desktop-mode-bar" role="region" aria-label="Controle do modo celular no computador">
          <span className="calda-desktop-mode-bar__label">
            <span className="calda-desktop-mode-bar__dot" aria-hidden="true" />
            <span>Modo Celular · Experiência App</span>
          </span>
          <button
            type="button"
            className="calda-device-toggle is-active"
            onClick={toggleCaldaDesktopMobileMode}
            aria-label="Voltar ao modo desktop"
          >
            <DesktopIcon size={14} aria-hidden="true" />
            <span>Voltar ao Desktop</span>
          </button>
        </div>
      )}
      {/* Overlay mobile */}
      {sidebarOpen && <div className="shell-sidebar__overlay" aria-hidden="true" onClick={() => setSidebarOpen(false)} />}

      {/* ═══ SIDEBAR — Industrial Glass motion rail ═══ */}
      <aside
        ref={sidebarRef}
        className={`shell-sidebar ${sidebarOpen ? "is-open" : ""}`}
        aria-label="Navegação lateral"
      >
        <div
          ref={sidebarPanelRef}
          className={`shell-sidebar__panel ${navPopup ? "has-popout" : ""}`}
          onMouseLeave={scheduleNavPopupClose}
        >
          <AmbientBrandWatermark variant="sidebar" />

          {/* Logo */}
          <div className="shell-sidebar__brand">
            <img src="/logo.png" alt="BRANCO PERES" className="shell-sidebar__logo" />
            <div className="shell-sidebar__brand-copy shell-nav-label">
              <div className="shell-sidebar__brand-name">BRANCO PERES</div>
              <div className="shell-sidebar__brand-subtitle">Controle de Manutenção</div>
            </div>
            <button
              type="button"
              className="shell-sidebar__close shell-sidebar-close"
              aria-label="Fechar menu"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation */}
          <nav
            ref={navRef}
            className="shell-sidebar__nav"
            aria-label="Navegação principal"
            onScroll={() => closeNavPopup()}
          >
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const active = currentPage === item.id;
              return (
                <React.Fragment key={item.id}>
                  {(index === 0 || navItems[index - 1].section !== item.section) && (
                    <h2
                      className={`shell-nav-section ${currentSection === item.section ? "is-current-section" : ""}`}
                      data-nav-section={item.section}
                      aria-label={item.section}
                    >
                      <span className="shell-nav-section__marker" aria-hidden="true" />
                      <span className="shell-nav-section__label shell-nav-label">{item.section}</span>
                    </h2>
                  )}
                  <button
                    type="button"
                    onClick={() => navigateFromSidebar(item.id)}
                    onMouseEnter={(event) => openNavPopup(item.section, event.currentTarget)}
                    onMouseLeave={scheduleNavPopupClose}
                    onFocus={(event) => openNavPopup(item.section, event.currentTarget)}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    title={item.label}
                    className={`shell-nav-item ${active ? "is-active" : ""}`}
                  >
                    <span className="shell-nav-item__icon" aria-hidden="true"><Icon /></span>
                    <span className="shell-nav-item__label shell-nav-label">{item.label}</span>
                    {active && <ChevronRight size={14} className="shell-nav-item__chevron" aria-hidden="true" />}
                    {item.id === "programacoes" && alertCount > 0 && !active && (
                      <span className="shell-nav-item__badge shell-nav-label" aria-hidden="true">
                        {alertCount > 9 ? "9+" : alertCount}
                      </span>
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>

          {/* Sync status */}
          <div className="shell-sidebar__footer">
            {isDashboardV32 && (
              <div className="v32-console-clock shell-nav-label" aria-hidden="true">
                <div className="v32-console-clock__time tabular-nums">
                  <span>{String(v32Now.getHours()).padStart(2, "0")}:{String(v32Now.getMinutes()).padStart(2, "0")}</span>
                  <small>{String(v32Now.getSeconds()).padStart(2, "0")}</small>
                </div>
                <div className="v32-console-clock__meta">
                  <span>
                    {v32Now.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(/\./g, "").toUpperCase()}
                  </span>
                  <span className="v32-console-clock__online">
                    {offlinePresentation.isOffline ? "OFFLINE" : syncing ? "SYNC" : "ONLINE"}
                  </span>
                </div>
              </div>
            )}
            <div
              className={`shell-sidebar__status-line is-${offlinePresentation.sidebarStatusTone}`}
              role="status"
              title={offlinePresentation.sidebarTitle}
              aria-label={offlinePresentation.sidebarTitle}
            >
              <span
                className={`shell-sidebar__status-dot is-${offlinePresentation.sidebarStatusTone} ${syncing || offlinePresentation.isOffline ? "animate-pulse" : ""}`}
                style={{
                  backgroundColor:
                    offlinePresentation.sidebarStatusTone === "offline"
                      ? "#f59e0b"
                      : offlinePresentation.sidebarStatusTone === "reconnecting"
                        ? "#4ade80"
                        : offlinePresentation.sidebarStatusTone === "syncing"
                          ? "#fbbf24"
                          : offlinePresentation.sidebarStatusTone === "cache"
                            ? "#60a5fa"
                            : "var(--sidebar-logo-ring)",
                  boxShadow:
                    offlinePresentation.sidebarStatusTone === "offline"
                      ? "0 0 8px rgba(245, 158, 11, 0.72)"
                      : offlinePresentation.sidebarStatusTone === "reconnecting"
                        ? "0 0 8px rgba(74, 222, 128, 0.65)"
                        : syncing
                          ? "none"
                          : "0 0 8px var(--sidebar-logo-ring)",
                }}
                aria-hidden="true"
              />
              <span className="shell-sidebar__status-label shell-nav-label">
                {offlinePresentation.sidebarStatusLabel}
              </span>
            </div>
            {offlinePresentation.sidebarStatusDetail && (
              <div className="shell-sidebar__status-detail shell-nav-label">
                {offlinePresentation.sidebarStatusDetail}
              </div>
            )}
            <SyncFreshnessIndicator
              variant="sidebar"
              lastSync={lastSync}
              lastSyncAt={lastSyncAt}
              syncing={syncing}
              online={isOnline}
              fromCache={fromCache}
              refreshIntervalMs={refreshIntervalMs}
            />
            <PWAInstallButton variant="compact" className="w-full shell-nav-label mt-1" />
            <div className="shell-sidebar__version shell-nav-label">v10.29 — Gestão de Manutenção</div>
          </div>
        </div>
      </aside>

      {navPopup && typeof document !== "undefined" && createPortal(
        <nav
          className="shell-sidebar__popup"
          aria-label={`Atalhos de ${navPopup.section}`}
          style={{ top: navPopup.top, left: navPopup.left }}
          onMouseEnter={clearPopupCloseTimer}
          onMouseLeave={scheduleNavPopupClose}
        >
          <div className="shell-sidebar__popup-heading">
            <span className="shell-sidebar__popup-eyebrow">Atalhos de</span>
            <strong className="shell-sidebar__popup-title">{navPopup.section}</strong>
          </div>
          {navItems.filter((item) => item.section === navPopup.section).map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className="shell-sidebar__popup-item"
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                onClick={() => navigateFromSidebar(item.id)}
              >
                <span className="shell-sidebar__popup-item-icon" aria-hidden="true"><Icon size={18} /></span>
                <span className="shell-sidebar__popup-item-label">{item.label}</span>
              </button>
            );
          })}
        </nav>,
        document.body,
      )}

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="calda-viewport-frame flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <AmbientBrandWatermark variant="workspace" />

        {/* Top bar — Glass Header */}
        <header
          className="shell-header relative z-[1] px-4 py-3 flex items-center gap-3"
          style={{
            backgroundColor: "var(--shell-header-bg)",
            borderBottom: "1px solid var(--shell-header-border)",
            color: "var(--shell-header-text)",
          }}
        >
          <button
            type="button"
            className="shell-header__icon-button shell-menu-toggle p-1.5 rounded-lg transition-colors"
            aria-label="Abrir menu"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          {/* Page title (Calda uses crisp rounded-square logo tile + title) */}
          {isCalda ? (
            <button
              type="button"
              className="calda-brand-mark"
              onClick={() => navigateFromSidebar("central-gerencial")}
              title="Ir para Central Gerencial"
            >
              <span className="calda-brand-mark__tile">
                <img src="/logo.png" alt="BRANCO PERES" />
              </span>
              <span className="calda-brand-mark__copy">
                <span className="calda-brand-mark__title">
                  {PAGE_LABELS[currentPage] ?? "Branco Peres"}
                </span>
                <span className="calda-brand-mark__subtitle">BRANCO PERES Agro</span>
              </span>
            </button>
          ) : (
            <div className="flex-1">
              <h1 className="shell-header__title text-base font-bold tracking-tight">
                {PAGE_LABELS[currentPage] ?? ""}
              </h1>
              <p className="shell-header__subtitle text-xs font-medium uppercase tracking-wider">
                BRANCO PERES Agro
              </p>
            </div>
          )}

          {/* Calda Desktop Floating Top Navigation Pill Dock */}
          {caldaPresentation.showDesktopTopDock && (
            <nav className="calda-top-dock" aria-label="Navegação principal Calda">
              {CALDA_PRIMARY_DOCK_ITEMS.map((item) => {
                const isActive = item.id === "more"
                  ? caldaMoreOpen || caldaActiveDockId === "more"
                  : caldaActiveDockId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`calda-top-dock__item${isActive ? " is-active" : ""}`}
                    aria-current={isActive && item.id !== "more" ? "page" : undefined}
                    aria-expanded={item.id === "more" ? caldaMoreOpen : undefined}
                    aria-label={item.label}
                    title={item.label}
                    onClick={() => handleCaldaDockClick(item.id)}
                  >
                    {caldaDockIcon(item.id, 16)}
                    <span>{item.shortLabel}</span>
                    {item.id === "programacoes" && alertCount > 0 && !isActive && (
                      <span className="calda-top-dock__badge" aria-hidden="true">
                        {alertCount > 9 ? "9+" : alertCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {isCalda && !caldaPresentation.showDesktopTopDock && <div className="flex-1 min-w-0" />}

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="shell-cmd-trigger"
              aria-label="Busca rápida de módulos e ações"
              title="Busca rápida (Ctrl+K)"
            >
              <Search size={15} aria-hidden="true" />
              <span className="shell-cmd-trigger__label">Buscar</span>
              <span className="shell-cmd-trigger__kbd" aria-hidden="true">⌘K</span>
            </button>
            {caldaPresentation.showDesktopMobileToggle && !caldaPresentation.isDesktopPhoneFrame && (
              <button
                type="button"
                onClick={toggleCaldaDesktopMobileMode}
                className="calda-device-toggle"
                aria-pressed={caldaDesktopMobileMode}
                aria-label="Ativar modo celular no computador"
                title="Alternar para Modo Celular com barra inferior de operações"
              >
                <Smartphone size={15} aria-hidden="true" />
                <span>Modo Celular</span>
              </button>
            )}
            {offlinePresentation.headerBadgeLabel && (
              offlinePresentation.isOffline ? (
                <button
                  type="button"
                  onClick={() => setOfflineBannerCollapsed((v) => !v)}
                  className="shell-header__offline-pill is-offline"
                  aria-expanded={!offlineBannerCollapsed}
                  aria-label={
                    offlineBannerCollapsed
                      ? "Mostrar detalhes do modo offline"
                      : "Minimizar detalhes do modo offline"
                  }
                  title={offlinePresentation.headerBadgeTitle ?? undefined}
                >
                  <WifiOff size={14} aria-hidden="true" />
                  <span className="hidden sm:inline">{offlinePresentation.headerBadgeLabel}</span>
                </button>
              ) : (
                <span
                  role="status"
                  className="shell-header__offline-pill is-reconnecting"
                  title={offlinePresentation.headerBadgeTitle ?? undefined}
                >
                  <Wifi size={14} aria-hidden="true" />
                  <span className="hidden sm:inline">{offlinePresentation.headerBadgeLabel}</span>
                </span>
              )
            )}
            {onToggleEncerradas && ["dashboard", "programacoes", "calendario", "exportar"].includes(currentPage) && (
              <button type="button" className="shell-header__closed-button" onClick={onToggleEncerradas}
                aria-pressed={!hideEncerradas} aria-label={hideEncerradas ? "Mostrar encerradas" : "Ocultar encerradas antigas"}
                title={hideEncerradas ? "Mostrar todas as encerradas" : "Ocultar encerradas anteriores ao corte das 07:10"}>
                {hideEncerradas ? <Eye size={18} /> : <EyeOff size={18} />}
                <span className="hidden md:inline">{hideEncerradas ? "Mostrar encerradas" : "Ocultar encerradas"}</span>
              </button>
            )}
            {/* Seletor de Temas */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowThemePicker((v) => !v)}
                className="shell-header__theme-button p-2 rounded-xl transition-all duration-200 flex items-center gap-1.5"
                aria-label="Escolher tema"
                aria-expanded={showThemePicker}
                aria-haspopup="menu"
                title="Escolher tema"
              >
                <Palette size={18} />
                <span className="shell-header__theme-emoji text-xs font-medium hidden sm:inline">
                  {themeInfo.emoji}
                </span>
              </button>

              {showThemePicker &&
                createPortal(
                  <>
                    {/* Backdrop para fechar ao clicar fora (acima de todo o conteúdo) */}
                    <div
                      className="fixed inset-0 z-[9998]"
                      onClick={() => setShowThemePicker(false)}
                    />
                    <div className="shell-theme-picker fixed right-3 sm:right-4 top-16 z-[9999] rounded-2xl shadow-2xl w-80 max-w-[calc(100vw-24px)] overflow-hidden">
                      <div className="shell-theme-picker__heading px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-wider">
                          Escolher Tema
                        </p>
                      </div>
                      <div className="p-2 space-y-1 max-h-[380px] overflow-y-auto">
                        {THEMES.map((t) => (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => {
                              setTheme(t.key);
                              setShowThemePicker(false);
                            }}
                            className="shell-theme-option w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                            style={
                              theme === t.key
                                ? {
                                    background: `${t.accentColor}15`,
                                    border: `1px solid ${t.accentColor}40`,
                                  }
                                : undefined
                            }
                          >
                            <div
                              className="shell-theme-preview w-8 h-8 rounded-lg flex-shrink-0 overflow-hidden"
                              style={{ background: t.previewBg }}
                            >
                              <div
                                className="w-full h-2"
                                style={{ background: t.previewAccent }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="shell-theme-option__label text-sm font-semibold flex items-center gap-1.5">
                                <span>{t.emoji}</span>
                                <span className="truncate">{t.label}</span>
                                {t.key === "verdan" && (
                                  <span
                                    className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0"
                                    style={{
                                      background: `${t.accentColor}22`,
                                      color: t.accentColor,
                                      border: `1px solid ${t.accentColor}44`,
                                    }}
                                  >
                                    Verdan
                                  </span>
                                )}
                                {t.key === "liquid-glass-v18" && (
                                  <span
                                    className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0"
                                    style={{
                                      background: `${t.accentColor}28`,
                                      color: t.previewAccent,
                                      border: `1px solid ${t.accentColor}55`,
                                    }}
                                  >
                                    V18
                                  </span>
                                )}
                                {t.key === "dashboard-v32" && (
                                  <span
                                    className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0"
                                    style={{
                                      background: `${t.accentColor}28`,
                                      color: t.previewAccent,
                                      border: `1px solid ${t.accentColor}55`,
                                    }}
                                  >
                                    Novo
                                  </span>
                                )}
                                {t.key === "vitrea" && (
                                  <span
                                    className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0"
                                    style={{
                                      background: `${t.accentColor}28`,
                                      color: t.previewAccent,
                                      border: `1px solid ${t.accentColor}55`,
                                    }}
                                  >
                                    Vitrea
                                  </span>
                                )}
                                {t.key === "calda" && (
                                  <span
                                    className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0"
                                    style={{
                                      background: `${t.accentColor}28`,
                                      color: "#7dd3fc",
                                      border: `1px solid ${t.accentColor}55`,
                                    }}
                                  >
                                    Padrão
                                  </span>
                                )}
                                {theme === t.key && (
                                  <span
                                    className="ml-auto text-xs shrink-0"
                                    style={{ color: t.accentColor }}
                                  >
                                    ✓
                                  </span>
                                )}
                              </div>
                              <div className="shell-theme-option__description text-xs truncate">
                                {t.description}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>,
                  document.body,
                )}
            </div>

            {/* Painel de notificações */}
            <div className="shell-header__notification">
              <NotificationPanel
                alerts={alerts}
                unreadCount={unreadCount}
                browserPermission={browserPermission}
                onRequestPermission={onRequestPermission}
                onMarkAsRead={onMarkAsRead}
                onMarkAllAsRead={onMarkAllAsRead}
                onClearAll={onClearAll}
              />
            </div>

            {/* Indicador visual de última atualização + contagem regressiva */}
            <SyncFreshnessIndicator
              variant="header"
              lastSync={lastSync}
              lastSyncAt={lastSyncAt}
              syncing={syncing}
              online={isOnline}
              fromCache={fromCache}
              refreshIntervalMs={refreshIntervalMs}
              onRefresh={onRefresh}
              disabled={offlinePresentation.syncButtonDisabled}
            />

            {/* Botão sincronizar */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={offlinePresentation.syncButtonDisabled}
              title={offlinePresentation.syncButtonTitle}
              className="shell-header__sync-button flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              <span className="shell-header__sync-label">
                {syncing ? "Sincronizando..." : "Sincronizar"}
              </span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main
          className={
            currentPage === "gestao-ordens-manutencao"
              ? "relative z-[1] flex-1 min-h-0 flex flex-col overflow-hidden"
              : "relative z-[1] flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6"
          }
          style={{ backgroundColor: "transparent" }}
        >
          {showOfflineBanner && (
            <section
              role="status"
              aria-live="polite"
              data-testid="layout-offline-banner"
              data-network-phase={offlinePresentation.phase}
              className={`shell-offline-banner is-${offlinePresentation.phase} ${currentPage === "gestao-ordens-manutencao" ? "is-fullscreen-child" : ""}`}
            >
              <div className="shell-offline-banner__icon" aria-hidden="true">
                {offlinePresentation.isOffline ? <WifiOff size={20} /> : <Wifi size={20} />}
              </div>
              <div className="shell-offline-banner__body">
                <div className="shell-offline-banner__heading">
                  <strong className="shell-offline-banner__title">
                    {offlinePresentation.bannerTitle}
                  </strong>
                  <span className="shell-offline-banner__badge">
                    {offlinePresentation.bannerTagLabel}
                  </span>
                </div>
                <p className="shell-offline-banner__description">
                  {offlinePresentation.bannerDescription}
                </p>
                <div className="shell-offline-banner__meta">
                  <span className="shell-offline-banner__meta-item">
                    {offlinePresentation.isOffline ? (
                      <WifiOff size={13} aria-hidden="true" />
                    ) : (
                      <Wifi size={13} aria-hidden="true" />
                    )}
                    <span>{offlinePresentation.bannerConnectionLabel}</span>
                  </span>
                  <span className="shell-offline-banner__meta-item">
                    <Database size={13} aria-hidden="true" />
                    <span>{offlinePresentation.bannerCacheLabel}</span>
                  </span>
                  <span className="shell-offline-banner__meta-item is-autosync">
                    <RefreshCw
                      size={13}
                      className={offlinePresentation.phase === "reconnecting" && syncing ? "animate-spin" : ""}
                      aria-hidden="true"
                    />
                    <span>{offlinePresentation.bannerSyncLabel}</span>
                  </span>
                </div>
              </div>
              {offlinePresentation.isOffline && (
                <button
                  type="button"
                  onClick={() => setOfflineBannerCollapsed(true)}
                  className="shell-offline-banner__dismiss"
                  aria-label="Minimizar aviso de modo offline"
                  title="Minimizar para o indicador do cabeçalho"
                >
                  <ChevronUp size={15} aria-hidden="true" />
                  <span className="hidden sm:inline">Minimizar</span>
                </button>
              )}
            </section>
          )}
          <div
            key={["dashboard", "programacoes", "importar", "exportar"].includes(currentPage) ? "lavagem-premium-module" : currentPage}
            className={`shell-page-stage ${currentPage === "gestao-ordens-manutencao" ? "flex-1 min-h-0 flex flex-col" : ""}`}
          >
            {children}
          </div>
        </main>

        {/* Calda Floating Bottom Navigation Bar (Mobile App Mode + Desktop Modo Celular) */}
        {caldaPresentation.showBottomTabBar && (
          <nav className="calda-tabbar" aria-label="Operações do aplicativo">
            {CALDA_PRIMARY_DOCK_ITEMS.map((item) => {
              const isActive = item.id === "more"
                ? caldaMoreOpen || caldaActiveDockId === "more"
                : caldaActiveDockId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`calda-tabbar__item${isActive ? " is-active" : ""}`}
                  aria-current={isActive && item.id !== "more" ? "page" : undefined}
                  aria-expanded={item.id === "more" ? caldaMoreOpen : undefined}
                  aria-label={item.label}
                  onClick={() => handleCaldaDockClick(item.id)}
                >
                  {caldaDockIcon(item.id, 19)}
                  <span className="calda-tabbar__label">{item.shortLabel}</span>
                  {item.id === "programacoes" && alertCount > 0 && !isActive && (
                    <span className="calda-tabbar__badge" aria-hidden="true">
                      {alertCount > 9 ? "9+" : alertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Calda "Mais operações" frosted bottom sheet */}
      {isCalda && caldaMoreOpen && typeof document !== "undefined" && createPortal(
        <div
          className="calda-more-backdrop"
          role="presentation"
          onClick={() => setCaldaMoreOpen(false)}
        >
          <div
            className="calda-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Todas as operações"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="calda-more-sheet__handle" aria-hidden="true" />
            <div className="calda-more-sheet__header">
              <h2>Operações e módulos</h2>
              <button
                type="button"
                className="calda-more-sheet__close"
                aria-label="Fechar operações"
                onClick={() => setCaldaMoreOpen(false)}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="calda-more-sheet__body">
              <button
                type="button"
                className="calda-more-search-btn"
                onClick={() => {
                  setCaldaMoreOpen(false);
                  setCommandPaletteOpen(true);
                }}
              >
                <Search size={16} aria-hidden="true" />
                <span>Buscar módulos, reformas e ações...</span>
              </button>
              {favoritePages.length > 0 && (
                <div>
                  <h3 className="calda-more-section__title">Favoritos fixados</h3>
                  <div className="calda-more-section__grid">
                    {favoritePages
                      .map((id) => navItems.find((item) => item.id === id))
                      .filter((item): item is (typeof navItems)[number] => Boolean(item))
                      .map((item) => {
                        const Icon = item.icon;
                        const active = currentPage === item.id;
                        return (
                          <button
                            key={`fav-${item.id}`}
                            type="button"
                            className={`calda-more-tile${active ? " is-active" : ""}`}
                            aria-current={active ? "page" : undefined}
                            onClick={() => navigateFromSidebar(item.id)}
                          >
                            <Star size={15} fill="currentColor" style={{ color: "#fbbf24" }} aria-hidden="true" />
                            <Icon size={16} aria-hidden="true" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
              {Array.from(new Set(navItems.map((i) => i.section))).map((sectionName) => (
                <div key={sectionName}>
                  <h3 className="calda-more-section__title">{sectionName}</h3>
                  <div className="calda-more-section__grid">
                    {navItems
                      .filter((i) => i.section === sectionName)
                      .map((item) => {
                        const Icon = item.icon;
                        const active = currentPage === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`calda-more-tile${active ? " is-active" : ""}`}
                            aria-current={active ? "page" : undefined}
                            onClick={() => navigateFromSidebar(item.id)}
                          >
                            <Icon size={17} aria-hidden="true" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
              <div className="pt-1">
                <PWAInstallButton variant="compact" className="w-full" />
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <QuickCommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        currentPage={currentPage}
        modules={paletteModules}
        actions={paletteActions}
        favorites={favoritePages}
        recents={recentPages}
        onNavigate={navigateFromSidebar}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}

const MemoizedLayout = React.memo(Layout);
MemoizedLayout.displayName = "Layout";

export default MemoizedLayout;
