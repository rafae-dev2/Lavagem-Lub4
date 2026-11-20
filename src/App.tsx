import { isEquipmentEditorReturn } from './lib/editorAuthNavigation';
import { useOperationalMinuteClock } from './hooks/useOperationalMinuteClock';
import {refreshEquipmentImageOverrides} from './lib/equipmentImageRegistry';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import CentralGerencial from "./pages/CentralGerencial";
import Programacoes from "./pages/Programacoes";
import Calendario from "./pages/Calendario";
import Importar from "./pages/Importar";
import Exportar from "./pages/Exportar";
import Configuracoes from "./pages/Configuracoes";
import AcompanhamentoManutencao from "./pages/AcompanhamentoManutencao";
import {
  MAINTENANCE_REFRESH_EVENT,
  MAINTENANCE_STATE_EVENT,
  MaintenanceShellState,
} from "./hooks/useMaintenanceTracking";
import GestaoOrdensManutencao from "./pages/GestaoOrdensManutencao";
import ControleApoio from "./pages/ControleApoio";
import ModoTV from "./pages/ModoTV";
import LavagemTabs from "./components/LavagemTabs";
import LavagemPremiumLayout from "./components/LavagemPremiumLayout";
import PCMIntegrationPanel from "./components/PCMIntegrationPanel";
import { useSchedules } from "./hooks/useSchedules";
import { useNotifications } from "./hooks/useNotifications";
import { DashboardStats, PageType, Programacao } from "./types";
import "./styles/operational-compact.css";
import { filterLavagemEquipmentSchedules, HIDDEN_LAVAGEM_GROUPS } from "./lib/lavagemEquipmentScope";
import {
  areDashboardStatsEqual,
  computeScheduleStats,
  computeVisibleSchedules,
  getEffectiveHideEncerradas,
  getOperationalWindowKey,
  setManualHideEncerradas,
} from "./lib/scheduleVisibility";
import {
  areMaintenanceShellStatesEqual,
  resolveEffectiveShellSync,
  stabilizeScheduleListReference,
} from "./lib/appReconciliation";

const VALID_PAGES: ReadonlySet<PageType> = new Set<PageType>([
  "central-gerencial",
  "gestao-ordens-manutencao",
  "controle-apoio",
  "modo-tv",
  "modo-tv-externas",
  "dashboard",
  "programacoes",
  "calendario",
  "importar",
  "exportar",
  "configuracoes",
  "preventivas-canavieiras",
  "lubrificacao-canavieiras",
  "reformas-apoio",
  "reformas-rodomuda",
  "reformas-colhedoras",
  "reformas-trator-transbordo",
  "reformas-trator-reboque",
]);

const MAINTENANCE_PAGES: ReadonlySet<PageType> = new Set<PageType>([
  "central-gerencial",
  "preventivas-canavieiras",
  "lubrificacao-canavieiras",
  "reformas-apoio",
  "reformas-rodomuda",
  "reformas-colhedoras",
  "reformas-trator-transbordo",
  "reformas-trator-reboque",
]);

const ACTIVE_LAVAGEM_PAGES: ReadonlySet<PageType> = new Set<PageType>([
  "dashboard",
  "programacoes",
  "calendario",
  "importar",
  "exportar",
  "configuracoes",
]);

const LAVAGEM_TAB_PAGES: ReadonlySet<PageType> = new Set<PageType>([
  "dashboard",
  "programacoes",
  "importar",
  "exportar",
]);

const SILENT_ERROR_PAGES: ReadonlySet<PageType> = new Set<PageType>([
  "modo-tv",
  "modo-tv-externas",
  "controle-apoio",
  "gestao-ordens-manutencao",
  "central-gerencial",
  "preventivas-canavieiras",
  "lubrificacao-canavieiras",
  "reformas-apoio",
  "reformas-rodomuda",
  "reformas-colhedoras",
  "reformas-trator-transbordo",
  "reformas-trator-reboque",
]);

const MAINTENANCE_REFRESH_INTERVAL_MS = 300_000;
const HIDDEN_GROUPS_TEXT = HIDDEN_LAVAGEM_GROUPS.join(", ");

interface HideEncerradasFlag {
  hidden: boolean;
  windowKey: string;
}

function useHideEncerradasFlag(): HideEncerradasFlag {
  const clock = useOperationalMinuteClock();
  const now = useMemo(() => new Date(clock), [clock]);
  const windowKey = useMemo(() => getOperationalWindowKey(now), [now]);
  const [hidden, setHidden] = useState<boolean>(() =>
    getEffectiveHideEncerradas(now),
  );

  useEffect(() => {
    const refreshFlag = () => {
      setHidden(getEffectiveHideEncerradas());
    };
    refreshFlag();
    window.addEventListener("storage", refreshFlag);
    window.addEventListener(
      "bp:hide-encerradas-changed",
      refreshFlag as EventListener,
    );
    return () => {
      window.removeEventListener("storage", refreshFlag);
      window.removeEventListener(
        "bp:hide-encerradas-changed",
        refreshFlag as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    setHidden(getEffectiveHideEncerradas());
  }, [windowKey]);

  return useMemo(() => ({ hidden, windowKey }), [hidden, windowKey]);
}

const initialEquipmentEditorReturn =
  typeof window !== "undefined" && isEquipmentEditorReturn(window.location.href);

const MemoizedDashboardView = React.memo(function MemoizedDashboardView({
  schedules,
  allSchedules,
  stats,
  loading,
  error,
}: {
  schedules: Programacao[];
  allSchedules: Programacao[];
  stats: DashboardStats;
  loading: boolean;
  error: string | null;
}) {
  return (
    <Dashboard
      schedules={schedules}
      allSchedules={allSchedules}
      stats={stats}
      loading={loading}
      error={error}
    />
  );
});

const MemoizedProgramacoesView = React.memo(function MemoizedProgramacoesView({
  schedules,
  onUpdate,
  onDelete,
  onAdd,
  onAddSingle,
  onRefresh,
}: {
  schedules: Programacao[];
  onUpdate: (id: string, updates: Partial<Programacao>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAdd: (newItems: Programacao[]) => Promise<void>;
  onAddSingle: (item: Programacao) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  return (
    <>
      <PCMIntegrationPanel onChanged={onRefresh} hideMainEquipment />
      <Programacoes
        schedules={schedules}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onAdd={onAdd}
        onAddSingle={onAddSingle}
      />
    </>
  );
});

const MemoizedExportarView = React.memo(function MemoizedExportarView({
  schedules,
}: {
  schedules: Programacao[];
}) {
  return <Exportar schedules={schedules} />;
});

const MemoizedCalendarioView = React.memo(function MemoizedCalendarioView({
  schedules,
}: {
  schedules: Programacao[];
}) {
  return <Calendario schedules={schedules} />;
});

const MemoizedImportarView = React.memo(function MemoizedImportarView({
  onImport,
}: {
  onImport: (newItems: Programacao[]) => Promise<void>;
}) {
  return <Importar onImport={onImport} />;
});

const MemoizedConfiguracoesView = React.memo(function MemoizedConfiguracoesView({
  onRefresh,
}: {
  onRefresh: () => Promise<void>;
}) {
  return <Configuracoes onRefresh={onRefresh} />;
});

const MemoizedCentralGerencialView = React.memo(function MemoizedCentralGerencialView() {
  return <CentralGerencial />;
});

const MemoizedGestaoOrdensView = React.memo(function MemoizedGestaoOrdensView() {
  return <GestaoOrdensManutencao />;
});

const MemoizedControleApoioView = React.memo(function MemoizedControleApoioView() {
  return <ControleApoio />;
});

const MemoizedModoTVView = React.memo(function MemoizedModoTVView({
  initialPanel,
}: {
  initialPanel: "emergency" | "external";
}) {
  return <ModoTV initialPanel={initialPanel} />;
});

const MemoizedAcompanhamentoView = React.memo(function MemoizedAcompanhamentoView({
  module,
}: {
  module:
    | "preventivas"
    | "lubrificacao"
    | "reformas"
    | "reformas-rodomuda"
    | "reformas-colhedoras"
    | "reformas-trator-transbordo"
    | "reformas-trator-reboque";
}) {
  return <AcompanhamentoManutencao module={module} />;
});

const MemoizedLavagemWorkspace = React.memo(function MemoizedLavagemWorkspace({
  page,
  syncing,
  onRefresh,
  onNavigate,
  alertCount,
  children,
}: {
  page: PageType;
  syncing: boolean;
  onRefresh: () => Promise<void>;
  onNavigate: (page: PageType) => void;
  alertCount: number;
  children: React.ReactNode;
}) {
  return (
    <LavagemPremiumLayout refreshing={syncing} onRefresh={onRefresh} activeTab={page}>
      <LavagemTabs
        current={page}
        onNavigate={onNavigate}
        alertCount={alertCount}
      />
      <p
        role="note"
        style={{
          padding: "10px 14px",
          marginBottom: 12,
          borderRadius: 10,
          background: "var(--bg-card)",
          border: "1px solid var(--border-primary)",
          color: "var(--text-secondary)",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <strong>Controle dos demais equipamentos.</strong> Grupos ocultos nesta visualização: {HIDDEN_GROUPS_TEXT}. As ordens continuam preservadas nos seus módulos.
      </p>
      {children}
    </LavagemPremiumLayout>
  );
});

const AppInner = React.memo(function AppInner() {
  const { isDark } = useTheme();

  const readHashPage = useCallback((): PageType => {
    const candidate = window.location.hash.slice(1) as PageType;
    if (VALID_PAGES.has(candidate)) return candidate;
    if (
      isEquipmentEditorReturn(window.location.href) ||
      (initialEquipmentEditorReturn && !window.location.hash)
    ) {
      return "configuracoes";
    }
    return "programacoes";
  }, []);

  const [page, setPageState] = useState<PageType>(readHashPage);
  const pageRef = useRef<PageType>(page);
  pageRef.current = page;

  const setPage = useCallback((next: PageType) => {
    if (!VALID_PAGES.has(next)) return;
    setPageState(next);
    if (window.location.search.includes("editor_login")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("editor_login");
      window.history.replaceState(window.history.state, "", url);
    }
    if (window.location.hash !== `#${next}`) window.location.hash = next;
  }, []);

  useEffect(() => {
    const onHashChange = () => setPageState(readHashPage());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [readHashPage]);

  const maintenancePage = useMemo(() => MAINTENANCE_PAGES.has(page), [page]);
  const [maintenanceShell, setMaintenanceShell] =
    useState<MaintenanceShellState>({
      syncing: true,
      lastSync: null,
      fromCache: false,
    });

  const handleMaintenanceStateEvent = useCallback((event: Event) => {
    const next = (event as CustomEvent<MaintenanceShellState>).detail;
    setMaintenanceShell((prev) =>
      areMaintenanceShellStatesEqual(prev, next) ? prev : next,
    );
  }, []);

  useEffect(() => {
    window.addEventListener(MAINTENANCE_STATE_EVENT, handleMaintenanceStateEvent);
    return () =>
      window.removeEventListener(
        MAINTENANCE_STATE_EVENT,
        handleMaintenanceStateEvent,
      );
  }, [handleMaintenanceStateEvent]);

  const activeLavagemPage = useMemo(
    () => ACTIVE_LAVAGEM_PAGES.has(page),
    [page],
  );

  const {
    schedules,
    loading,
    error,
    syncing,
    lastSync,
    lastSyncAt,
    fromCache,
    autoRefreshMs,
    refresh,
    addSchedules,
    addSingleSchedule,
    updateSchedule,
    deleteSchedule,
  } = useSchedules({ activeLavagemPage });

  const lavagemSchedules = useMemo(
    () => filterLavagemEquipmentSchedules(schedules),
    [schedules],
  );

  const {
    alerts,
    unreadCount,
    browserPermission,
    requestPermission,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotifications(lavagemSchedules);

  const { hidden: hideEncerradas, windowKey: operationalWindowKey } =
    useHideEncerradasFlag();
  const hideEncerradasRef = useRef<boolean>(hideEncerradas);
  hideEncerradasRef.current = hideEncerradas;

  const selectVisibleSchedules = useCallback(
    (source: Programacao[], hideClosed: boolean) =>
      computeVisibleSchedules(source, hideClosed, new Date()),
    [],
  );

  const prevVisibleSchedulesRef = useRef<Programacao[] | null>(null);
  const visibleSchedules = useMemo(() => {
    const computed = selectVisibleSchedules(lavagemSchedules, hideEncerradas);
    const stabilized = stabilizeScheduleListReference(
      prevVisibleSchedulesRef.current,
      computed,
    );
    prevVisibleSchedulesRef.current = stabilized;
    return stabilized;
  }, [selectVisibleSchedules, lavagemSchedules, hideEncerradas, operationalWindowKey]);

  const selectVisibleStats = useCallback(
    (items: readonly Programacao[]): DashboardStats => computeScheduleStats(items),
    [],
  );

  const prevVisibleStatsRef = useRef<DashboardStats | null>(null);
  const visibleStats: DashboardStats = useMemo(() => {
    const nextStats = selectVisibleStats(visibleSchedules);
    if (
      prevVisibleStatsRef.current &&
      areDashboardStatsEqual(prevVisibleStatsRef.current, nextStats)
    ) {
      return prevVisibleStatsRef.current;
    }
    prevVisibleStatsRef.current = nextStats;
    return nextStats;
  }, [selectVisibleStats, visibleSchedules]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as PageType;
      if (detail) setPage(detail);
    };
    window.addEventListener("navigate", handler);
    return () => window.removeEventListener("navigate", handler);
  }, [setPage]);

  const handleToggleEncerradas = useCallback(() => {
    const hidden = !hideEncerradasRef.current;
    setManualHideEncerradas(hidden, new Date());
    window.dispatchEvent(
      new CustomEvent("bp:hide-encerradas-changed", { detail: { hidden } }),
    );
  }, []);

  const handleShellRefresh = useCallback(() => {
    const current = pageRef.current;
    if (MAINTENANCE_PAGES.has(current)) {
      window.dispatchEvent(new Event(MAINTENANCE_REFRESH_EVENT));
    } else if (current === "controle-apoio") {
      window.dispatchEvent(new Event("bp:apoio-refresh"));
    } else {
      void refresh();
    }
  }, [refresh]);

  const alertCount = visibleStats.atrasado;

  const effectiveShellSync = useMemo(
    () =>
      resolveEffectiveShellSync({
        maintenancePage,
        maintenanceShell,
        maintenanceRefreshIntervalMs: MAINTENANCE_REFRESH_INTERVAL_MS,
        lavagemSyncing: syncing,
        lavagemLastSync: lastSync,
        lavagemLastSyncAt: lastSyncAt,
        lavagemRefreshIntervalMs: autoRefreshMs,
        lavagemFromCache: fromCache,
      }),
    [
      maintenancePage,
      maintenanceShell,
      syncing,
      lastSync,
      lastSyncAt,
      autoRefreshMs,
      fromCache,
    ],
  );

  const {
    syncing: effectiveSyncing,
    lastSync: effectiveLastSync,
    lastSyncAt: effectiveLastSyncAt,
    refreshIntervalMs: effectiveRefreshIntervalMs,
    fromCache: effectiveFromCache,
  } = effectiveShellSync;

  const isLavagemTabPage = useMemo(() => LAVAGEM_TAB_PAGES.has(page), [page]);

  // Isolated standalone pages never re-reconcile during background Lavagem sync ticks
  const standalonePageContent = useMemo(() => {
    switch (page) {
      case "central-gerencial":
        return <MemoizedCentralGerencialView />;
      case "gestao-ordens-manutencao":
        return <MemoizedGestaoOrdensView />;
      case "controle-apoio":
        return <MemoizedControleApoioView />;
      case "modo-tv":
        return <MemoizedModoTVView initialPanel="emergency" />;
      case "modo-tv-externas":
        return <MemoizedModoTVView initialPanel="external" />;
      case "calendario":
        return <MemoizedCalendarioView schedules={visibleSchedules} />;
      case "configuracoes":
        return <MemoizedConfiguracoesView onRefresh={refresh} />;
      case "preventivas-canavieiras":
        return (
          <MemoizedAcompanhamentoView key="preventivas" module="preventivas" />
        );
      case "lubrificacao-canavieiras":
        return (
          <MemoizedAcompanhamentoView
            key="lubrificacao"
            module="lubrificacao"
          />
        );
      case "reformas-apoio":
        return <MemoizedAcompanhamentoView key="reformas" module="reformas" />;
      case "reformas-rodomuda":
        return (
          <MemoizedAcompanhamentoView
            key="reformas-rodomuda"
            module="reformas-rodomuda"
          />
        );
      case "reformas-colhedoras":
        return (
          <MemoizedAcompanhamentoView
            key="reformas-colhedoras"
            module="reformas-colhedoras"
          />
        );
      case "reformas-trator-transbordo":
        return (
          <MemoizedAcompanhamentoView
            key="reformas-trator-transbordo"
            module="reformas-trator-transbordo"
          />
        );
      case "reformas-trator-reboque":
        return (
          <MemoizedAcompanhamentoView
            key="reformas-trator-reboque"
            module="reformas-trator-reboque"
          />
        );
      default:
        return null;
    }
  }, [page, visibleSchedules, refresh]);

  const lavagemPageContent = useMemo(() => {
    if (!isLavagemTabPage) return null;
    let content: React.ReactNode;
    switch (page) {
      case "dashboard":
        content = (
          <MemoizedDashboardView
            schedules={visibleSchedules}
            allSchedules={lavagemSchedules}
            stats={visibleStats}
            loading={loading}
            error={error}
          />
        );
        break;
      case "importar":
        content = <MemoizedImportarView onImport={addSchedules} />;
        break;
      case "exportar":
        content = <MemoizedExportarView schedules={visibleSchedules} />;
        break;
      case "programacoes":
      default:
        content = (
          <MemoizedProgramacoesView
            schedules={lavagemSchedules}
            onUpdate={updateSchedule}
            onDelete={deleteSchedule}
            onAdd={addSchedules}
            onAddSingle={addSingleSchedule}
            onRefresh={refresh}
          />
        );
        break;
    }

    return (
      <MemoizedLavagemWorkspace
        page={page}
        syncing={syncing}
        onRefresh={refresh}
        onNavigate={setPage}
        alertCount={alertCount}
      >
        {content}
      </MemoizedLavagemWorkspace>
    );
  }, [
    isLavagemTabPage,
    page,
    visibleSchedules,
    lavagemSchedules,
    visibleStats,
    loading,
    error,
    updateSchedule,
    deleteSchedule,
    addSchedules,
    addSingleSchedule,
    refresh,
    syncing,
    setPage,
    alertCount,
  ]);

  const pageContent = isLavagemTabPage
    ? lavagemPageContent
    : standalonePageContent;

  const showPendingBanner = useMemo(
    () =>
      Boolean(
        error &&
          !error.startsWith("Sem conexão com a internet") &&
          !SILENT_ERROR_PAGES.has(page),
      ),
    [error, page],
  );

  const pendingBannerStyle = useMemo<React.CSSProperties>(
    () =>
      isDark
        ? {
            borderColor: "rgba(251, 191, 36, 0.36)",
            background: "rgba(251, 191, 36, 0.11)",
            color: "#fde68a",
          }
        : {
            borderColor: "#c08a28",
            background: "#fff8e7",
            color: "#63420b",
          },
    [isDark],
  );

  return (
    <Layout
      currentPage={page}
      hideEncerradas={hideEncerradas}
      onToggleEncerradas={handleToggleEncerradas}
      onNavigate={setPage}
      onRefresh={handleShellRefresh}
      syncing={effectiveSyncing}
      lastSync={effectiveLastSync}
      lastSyncAt={effectiveLastSyncAt}
      refreshIntervalMs={effectiveRefreshIntervalMs}
      fromCache={effectiveFromCache}
      alertCount={alertCount}
      alerts={alerts}
      unreadCount={unreadCount}
      browserPermission={browserPermission}
      onRequestPermission={requestPermission}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
      onClearAll={clearAll}
    >
      {showPendingBanner && (
        <div
          role="alert"
          className="mb-3 rounded-xl px-4 py-3 text-[13px] leading-relaxed border"
          style={pendingBannerStyle}
        >
          <strong>Lavagem e Lubrificação: atualização pendente.</strong> Os
          dados exibidos podem estar desatualizados. {error}
          <button
            type="button"
            onClick={refresh}
            className="ml-3 underline font-semibold"
          >
            Tentar atualizar agora
          </button>
        </div>
      )}
      {pageContent}
    </Layout>
  );
});

export default function App() {
  useEffect(() => {
    const readImages = () => {
      if (document.visibilityState === "visible") {
        void refreshEquipmentImageOverrides().catch(() => undefined);
      }
    };
    readImages();
    const timer = window.setInterval(readImages, 300_000);
    window.addEventListener("focus", readImages);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", readImages);
    };
  }, []);

  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
