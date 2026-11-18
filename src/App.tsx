import { isEquipmentEditorReturn } from './lib/editorAuthNavigation';
import { useOperationalMinuteClock } from './hooks/useOperationalMinuteClock';
import {refreshEquipmentImageOverrides} from './lib/equipmentImageRegistry';
import React, { useEffect, useMemo, useState } from "react";
import { formatApoioDate } from "./lib/apoioDate";
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
import { DashboardStats, PageType } from "./types";
import "./styles/operational-compact.css";
import { filterLavagemEquipmentSchedules, HIDDEN_LAVAGEM_GROUPS } from "./lib/lavagemEquipmentScope";
import {
  getEffectiveHideEncerradas,
  getOperationalWindowKey,
  setManualHideEncerradas,
  shouldHideClosedSchedule,
} from "./lib/scheduleVisibility";

/**
 * Hook utilit�rio que reage \u00e0s mudan\u00e7as do filtro "ocultar encerradas"
 * persistido em localStorage pela p\u00e1gina de Programa\u00e7\u00f5es.
 *
 * Por que isso existe?
 * - O usu\u00e1rio pediu que o Dashboard (e a Exporta\u00e7\u00e3o) acompanhem o filtro
 *   da Programa\u00e7\u00e3o, em vez de contar tamb\u00e9m as frotas ocultas.
 * - O estado do filtro j\u00e1 \u00e9 salvo em `localStorage` (chave bp_hide_encerradas),
 *   ent\u00e3o aqui apenas escutamos altera\u00e7\u00f5es de outras abas (`storage`) e
 *   um evento customizado `bp:hide-encerradas-changed` disparado pela
 *   pr\u00f3pria p\u00e1gina de Programa\u00e7\u00f5es quando o usu\u00e1rio alterna o filtro.
 */
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
    const refresh = () => {
      setHidden(getEffectiveHideEncerradas());
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(
      "bp:hide-encerradas-changed",
      refresh as EventListener,
    );
    // O relógio operacional avança no início do minuto, preservando 07:10
    // sem reconstruir todas as telas a cada segundo.
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(
        "bp:hide-encerradas-changed",
        refresh as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    setHidden(getEffectiveHideEncerradas());
  }, [windowKey]);

  return { hidden, windowKey };
}

const initialEquipmentEditorReturn = typeof window !== "undefined" && isEquipmentEditorReturn(window.location.href);

function AppInner() {
  const { isDark } = useTheme();
  const validPages: PageType[] = [
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
  ];
  const readHashPage = (): PageType => {
    const candidate = window.location.hash.slice(1) as PageType;
    if (validPages.includes(candidate)) return candidate;
    if (isEquipmentEditorReturn(window.location.href) || (initialEquipmentEditorReturn && !window.location.hash)) return "configuracoes";
    return "programacoes";
  };
  const [page, setPageState] = useState<PageType>(readHashPage);
  const setPage = (next: PageType) => {
    if (!validPages.includes(next)) return;
    setPageState(next);
    if (window.location.search.includes("editor_login")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("editor_login");
      window.history.replaceState(window.history.state, "", url);
    }
    if (window.location.hash !== `#${next}`) window.location.hash = next;
  };
  useEffect(() => {
    const onHashChange = () => setPageState(readHashPage());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const maintenancePage = [
    "central-gerencial",
    "preventivas-canavieiras",
    "lubrificacao-canavieiras",
    "reformas-apoio",
    "reformas-rodomuda",
    "reformas-colhedoras",
    "reformas-trator-transbordo",
    "reformas-trator-reboque",
  ].includes(page);
  const [maintenanceShell, setMaintenanceShell] =
    useState<MaintenanceShellState>({
      syncing: true,
      lastSync: null,
      fromCache: false,
    });
  useEffect(() => {
    const onState = (event: Event) =>
      setMaintenanceShell((event as CustomEvent<MaintenanceShellState>).detail);
    window.addEventListener(MAINTENANCE_STATE_EVENT, onState);
    return () => window.removeEventListener(MAINTENANCE_STATE_EVENT, onState);
  }, []);

  const activeLavagemPage = [
    "dashboard",
    "programacoes",
    "calendario",
    "importar",
    "exportar",
    "configuracoes",
  ].includes(page);

  const {
    schedules,
    loading,
    error,
    syncing,
    lastSync,
    fromCache,
    stats,
    refresh,
    addSchedules,
    addSingleSchedule,
    updateSchedule,
    deleteSchedule,
  } = useSchedules({ activeLavagemPage });

  const lavagemSchedules = useMemo(() => filterLavagemEquipmentSchedules(schedules), [schedules]);

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

  /**
   * Lista de programa\u00e7\u00f5es vis\u00edveis ap\u00f3s aplicar o filtro de "ocultar
   * encerradas anteriores ao corte das 7h" \u2014 \u00e9 a mesma regra usada na
   * p\u00e1gina de Programa\u00e7\u00f5es. Quando o filtro est\u00e1 desligado, devolvemos
   * a lista completa.
   */
  const visibleSchedules = useMemo(() => {
    if (!hideEncerradas) return lavagemSchedules;
    const now = new Date();
    return lavagemSchedules.filter((s) => !shouldHideClosedSchedule(s, now));
  }, [lavagemSchedules, hideEncerradas, operationalWindowKey]);

  /**
   * Stats reativas \u00e0 lista vis\u00edvel: o Dashboard agora reflete exatamente o
   * que est\u00e1 vis\u00edvel na Programa\u00e7\u00e3o, em vez de contar tamb\u00e9m as frotas
   * ocultas.
   */
  const visibleStats: DashboardStats = useMemo(
    () => ({
      total: visibleSchedules.length,
      pendente: visibleSchedules.filter((s) => s.situacao === "PENDENTE")
        .length,
      atrasado: visibleSchedules.filter((s) => s.situacao === "ATRASADO")
        .length,
      programado: visibleSchedules.filter((s) => s.situacao === "PROGRAMADO")
        .length,
      encerrado: visibleSchedules.filter((s) => s.situacao === "ENCERRADO")
        .length,
      andamento: visibleSchedules.filter((s) => s.situacao === "ANDAMENTO")
        .length,
    }),
    [visibleSchedules],
  );

  // Escutar evento de navega\u00e7\u00e3o disparado pela p\u00e1gina de importa\u00e7\u00e3o
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as PageType;
      if (detail) setPage(detail);
    };
    window.addEventListener("navigate", handler);
    return () => window.removeEventListener("navigate", handler);
  }, []);

  const alertCount = visibleStats.atrasado;

  const renderPage = () => {
    let content: React.ReactNode;
    switch (page) {
      case "central-gerencial":
        return <CentralGerencial />;
      case "gestao-ordens-manutencao":
        return <GestaoOrdensManutencao />;
      case "controle-apoio":
        return <ControleApoio />;
      case "modo-tv":
        return <ModoTV initialPanel="emergency" />;
      case "modo-tv-externas":
        return <ModoTV initialPanel="external" />;
      case "dashboard":
        // Dashboard usa a lista FILTRADA: respeita "ocultar encerradas" da Programa\u00e7\u00e3o
        content = (
          <Dashboard
            schedules={visibleSchedules}
            allSchedules={lavagemSchedules}
            stats={visibleStats}
            loading={loading}
            error={error}
          />
        );
        break;
      case "programacoes":
        // Programa\u00e7\u00f5es continua recebendo a lista bruta porque ela mesma decide o filtro
        content = (
          <>
            <PCMIntegrationPanel onChanged={refresh} hideMainEquipment />
            <Programacoes
              schedules={lavagemSchedules}
              onUpdate={updateSchedule}
              onDelete={deleteSchedule}
              onAdd={addSchedules}
              onAddSingle={addSingleSchedule}
            />
          </>
        );
        break;
      case "importar":
        content = <Importar onImport={addSchedules} />;
        break;
      case "exportar":
        // A exportação aplica a mesma visibilidade operacional; o botão global revela o histórico.
        content = <Exportar schedules={visibleSchedules} />;
        break;
      case "calendario":
        return <Calendario schedules={visibleSchedules} />;
      case "configuracoes":
        return <Configuracoes onRefresh={refresh} />;
      case "preventivas-canavieiras":
        return (
          <AcompanhamentoManutencao key="preventivas" module="preventivas" />
        );
      case "lubrificacao-canavieiras":
        return (
          <AcompanhamentoManutencao key="lubrificacao" module="lubrificacao" />
        );
      case "reformas-apoio":
        return <AcompanhamentoManutencao key="reformas" module="reformas" />;
      case "reformas-rodomuda":
        return <AcompanhamentoManutencao key="reformas-rodomuda" module="reformas-rodomuda" />;
      case "reformas-colhedoras":
        return <AcompanhamentoManutencao key="reformas-colhedoras" module="reformas-colhedoras" />;
      case "reformas-trator-transbordo":
        return <AcompanhamentoManutencao key="reformas-trator-transbordo" module="reformas-trator-transbordo" />;
      case "reformas-trator-reboque":
        return <AcompanhamentoManutencao key="reformas-trator-reboque" module="reformas-trator-reboque" />;

      default:
        content = (
          <>
            <PCMIntegrationPanel onChanged={refresh} hideMainEquipment />
            <Programacoes
              schedules={lavagemSchedules}
              onUpdate={updateSchedule}
              onDelete={deleteSchedule}
              onAdd={addSchedules}
              onAddSingle={addSingleSchedule}
            />
          </>
        );
    }

    if (!["dashboard", "programacoes", "importar", "exportar"].includes(page))
      return content;

    // Dashboard, Importar e Exportar da Lavagem agora vivem DENTRO de
    // Programa\u00e7\u00f5es, por meio de uma barra de abas no topo.
    return (
      <LavagemPremiumLayout refreshing={syncing} onRefresh={refresh} activeTab={page}>
        <LavagemTabs
          current={page}
          onNavigate={setPage}
          alertCount={alertCount}
        />
        <p role="note" style={{padding:"10px 14px",marginBottom:12,borderRadius:10,background:"var(--bg-card)",color:"var(--text-secondary)",fontSize:12,lineHeight:1.5}}>
          <strong>Controle dos demais equipamentos.</strong> Grupos ocultos nesta visualização: {HIDDEN_LAVAGEM_GROUPS.join(", ")}. As ordens continuam preservadas nos seus módulos.
        </p>
        {content}
      </LavagemPremiumLayout>
    );
  };

  return (
    <Layout
      currentPage={page}
      hideEncerradas={hideEncerradas}
      onToggleEncerradas={() => {
        const hidden = !hideEncerradas;
        setManualHideEncerradas(hidden, new Date());
        window.dispatchEvent(new CustomEvent("bp:hide-encerradas-changed", { detail: { hidden } }));
      }}
      onNavigate={setPage}
      onRefresh={() => {
        if (
          [
            "central-gerencial",
          "preventivas-canavieiras",
            "lubrificacao-canavieiras",
            "reformas-apoio",
    "reformas-rodomuda",
    "reformas-colhedoras",
    "reformas-trator-transbordo",
    "reformas-trator-reboque",
          ].includes(page)
        )
          window.dispatchEvent(new Event(MAINTENANCE_REFRESH_EVENT));
        else if (page === "controle-apoio") window.dispatchEvent(new Event("bp:apoio-refresh"));
        else void refresh();
      }}
      syncing={maintenancePage ? maintenanceShell.syncing : syncing}
      lastSync={
        maintenancePage
          ? maintenanceShell.lastSync
            ? formatApoioDate(maintenanceShell.lastSync)
            : null
          : lastSync
      }
      fromCache={maintenancePage ? maintenanceShell.fromCache : fromCache}
      alertCount={alertCount}
      alerts={alerts}
      unreadCount={unreadCount}
      browserPermission={browserPermission}
      onRequestPermission={requestPermission}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
      onClearAll={clearAll}
    >
      {error &&
        !error.startsWith("Sem conexão com a internet") &&
        ![
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
        ].includes(page) && (
          <div
            role="alert"
            className="mb-3 rounded-xl px-4 py-3 text-[13px] leading-relaxed border"
            style={
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
                  }
            }
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
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  useEffect(() => {
    const readImages = () => { if(document.visibilityState === 'visible') void refreshEquipmentImageOverrides().catch(() => undefined); };
    readImages();const timer=window.setInterval(readImages,300_000);
    window.addEventListener('focus',readImages);
    return () => {window.clearInterval(timer);window.removeEventListener('focus',readImages);};
  },[]);

  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
