import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Columns3,
  Download,
  Droplets,
  Eye,
  EyeOff,
  FileText,
  Filter,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
  X,
  Truck,
  Wheat,
  Tractor,
} from "lucide-react";
import MaintenanceOrderCard, {
  closureOriginLabel,
  MaintenanceStatusBadge,
} from "../components/MaintenanceOrderCard";
import TrackingOperationalPanel from "../components/TrackingOperationalPanel";
import EquipmentThumbnail from "../components/EquipmentThumbnail";
import { VerdanCountUp } from "../components/VerdanAnimatedWidgets";
import { useTheme } from "../contexts/ThemeContext";
import { useMaintenanceTracking } from "../hooks/useMaintenanceTracking";
import {
  buildTrackingRows,
  filterTrackingRows,
  getTrackingCounts,
  parseTrackingDate,
  statusLabel,
  TRACKING_TITLES,
  trackingClosureOrigin,
  trackingClosedAt,
  TrackingModule,
  TrackingRow,
} from "../lib/maintenanceTracking";
import {
  exportTrackingExcel,
  exportTrackingPDF,
} from "../lib/maintenanceTrackingReport";
import { formatApoioDate as fmt } from "../lib/apoioDate";
import { oficinaLabel } from "../types/apoio";
import {
  countHiddenTrackingRows,
  getEffectiveHideEncerradas,
  getOperationalWindowKey,
  getVisibleTrackingRows,
  setManualHideEncerradas,
} from "../lib/maintenanceVisibility";
import "../styles/maintenance-tracking.css";
import "../styles/maintenance-premium.css";

const PAGE_SIZE = 24;
const statusOptions = ["programado", "andamento", "encerrado", "outros"] as const;
const descriptions: Record<TrackingModule, string> = {
  preventivas:
    "Programação e execução das preventivas mecânicas da frota canavieira.",
  lubrificacao:
    "Acompanhamento das ordens de lubrificação das carretas canavieiras.",
  reformas:
    "Visão gerencial das reformas dos equipamentos cadastrados no Apoio.",
  "reformas-rodomuda": "Acompanhamento integrado das reformas de carretas Rodomuda no cadastro Apoio.",
  "reformas-colhedoras": "Acompanhamento integrado das reformas de colhedoras no cadastro Apoio.",
  "reformas-trator-transbordo": "Acompanhamento integrado das reformas de tratores Transbordo cadastrados no Apoio.",
  "reformas-trator-reboque": "Acompanhamento integrado das reformas de tratores Reboque cadastrados no Apoio.",

};
const moduleIcons = {
  preventivas: ShieldCheck,
  lubrificacao: Droplets,
  reformas: Wrench,
  "reformas-rodomuda": Truck,
  "reformas-colhedoras": Wheat,
  "reformas-trator-transbordo": Tractor,
  "reformas-trator-reboque": Tractor,

};
const emptyFilters = {
  query: "",
  status: "",
  group: "",
  location: "",
  provider: "",
  start: "",
  end: "",
};

function displayStatus(row: TrackingRow): TrackingRow["trackingStatus"] {
  return row.trackingStatus === "ausente" ? "outros" : row.trackingStatus;
}

function dateTimestamp(value: string | null | undefined) {
  return parseTrackingDate(value)?.timestamp;
}

function compareDateValues(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: 1 | -1,
) {
  const aTime = dateTimestamp(a);
  const bTime = dateTimestamp(b);
  if (aTime === undefined && bTime === undefined) return 0;
  if (aTime === undefined) return 1;
  if (bTime === undefined) return -1;
  return direction * (aTime - bTime);
}

function compareFleet(a: TrackingRow, b: TrackingRow) {
  return (
    a.frota.localeCompare(b.frota, "pt-BR", { numeric: true }) ||
    a.os.localeCompare(b.os, "pt-BR", { numeric: true })
  );
}

function closureText(row: TrackingRow) {
  const status = displayStatus(row);
  if (status !== "encerrado") return null;
  const origin = trackingClosureOrigin(row);
  const detectedAt = trackingClosedAt(row);
  return `${closureOriginLabel(origin)}${detectedAt ? ` · ${fmt(detectedAt)}` : ""}`;
}

export default function AcompanhamentoManutencao({
  module,
}: {
  module: TrackingModule;
}) {
  const { theme } = useTheme();
  const isVerdan = theme === "verdan";
  const { data, loading, refreshing, error, refresh, clock } =
    useMaintenanceTracking({
      automaticRefreshMs: 3 * 60_000,
      syncOnAutomaticRefresh: false,
    });
  const [filters, setFilters] = useState({ ...emptyFilters });
  const [lateOnly, setLateOnly] = useState(false);
  const [sort, setSort] = useState("priority");
  const [view, setView] = useState<"cards" | "panel" | "table">("cards");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [exportError, setExportError] = useState("");
  const [notice, setNotice] = useState("");
  const ModuleIcon = moduleIcons[module];

  const base = useMemo(
    () => buildTrackingRows(data, module, clock),
    [data, module, clock],
  );
  const operationalWindowKey = useMemo(
    () => getOperationalWindowKey(clock),
    [clock],
  );
  const [hideEncerradas, setHideEncerradas] = useState<boolean>(() =>
    getEffectiveHideEncerradas(),
  );
  const statusRevealsAllClosed = filters.status === "encerrado";
  const visibleBase = useMemo(
    () =>
      getVisibleTrackingRows(
        base,
        hideEncerradas && !statusRevealsAllClosed,
        clock,
      ),
    [base, clock, hideEncerradas, statusRevealsAllClosed],
  );
  const dateError = Boolean(
    filters.start && filters.end && filters.start > filters.end,
  );
  const historicalContextRows = useMemo(
    () =>
      dateError
        ? []
        : filterTrackingRows(base, { ...filters, status: "" }, clock).filter(
            (row) => !lateOnly || row.overdue,
          ),
    [base, filters, clock, lateOnly, dateError],
  );
  const visibleContextRows = useMemo(
    () =>
      dateError
        ? []
        : filterTrackingRows(visibleBase, { ...filters, status: "" }, clock).filter(
            (row) => !lateOnly || row.overdue,
          ),
    [visibleBase, filters, clock, lateOnly, dateError],
  );
  const contextRows = statusRevealsAllClosed
    ? historicalContextRows
    : visibleContextRows;
  const filtered = useMemo(
    () =>
      dateError
        ? []
        : filterTrackingRows(
            statusRevealsAllClosed ? base : visibleBase,
            filters,
            clock,
          ).filter(
            (row) => !lateOnly || row.overdue,
          ),
    [base, visibleBase, filters, clock, lateOnly, dateError, statusRevealsAllClosed],
  );
  const rows = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (sort === "fleet") return compareFleet(a, b);
        if (sort === "recent") {
          return compareDateValues(a.entrada, b.entrada, -1) || compareFleet(a, b);
        }
        return (
          Number(b.overdue) - Number(a.overdue) ||
          compareDateValues(a.previsao, b.previsao, 1) ||
          compareFleet(a, b)
        );
      }),
    [filtered, sort],
  );

  const counts = getTrackingCounts(contextRows);
  const historicalCounts = getTrackingCounts(historicalContextRows);
  const selectedCounts = getTrackingCounts(rows);
  const hiddenClosedCount = countHiddenTrackingRows(historicalContextRows, clock);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const shown = rows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const sourceTimestamp = parseTrackingDate(
    data?.sync?.fonte_atualizada,
  )?.timestamp;
  const sourceAge =
    sourceTimestamp === undefined
      ? null
      : (clock.getTime() - sourceTimestamp) / 60_000;
  const stale =
    Boolean(data) &&
    (sourceAge === null || sourceAge > 75 || sourceAge < -5);
  const structuredMissing =
    data
      ? Boolean(
          data.orders.length &&
            data.orders.every((row) => !row.classe?.trim() && !row.motivo?.trim()),
        )
      : false;
  const warning = [
    base.some(row => row.trackingStatus === "ausente") ? "Há ordens fora da fonte sem evidência temporal íntegra. Elas ficam em Outros, sem encerramento automático." : "",
    error,
    data?.sync?.erro,
    stale
      ? "A data da fonte está desatualizada, ausente ou inconsistente. Verifique antes de usar este acompanhamento."
      : "",
    structuredMissing
      ? "A fotografia não disponibiliza classe/motivo estruturados. A seleção usa somente termos explícitos de ponto/narrativa e pode não contemplar todas as ordens."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const optionList = (field: "apoio" | "prestador" | "origem") =>
    [
      ...new Set(
        base
          .map((row) =>
            field === "origem" ? oficinaLabel(row.origem) : row[field],
          )
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filterCount =
    Object.values(filters).filter(Boolean).length + Number(lateOnly);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const refreshVisibility = () => {
      setHideEncerradas(getEffectiveHideEncerradas());
    };
    window.addEventListener("storage", refreshVisibility);
    window.addEventListener("bp:hide-encerradas-changed", refreshVisibility);
    return () => {
      window.removeEventListener("storage", refreshVisibility);
      window.removeEventListener(
        "bp:hide-encerradas-changed",
        refreshVisibility,
      );
    };
  }, []);
  useEffect(() => {
    setHideEncerradas(getEffectiveHideEncerradas(clock));
  }, [clock, operationalWindowKey]);
  useEffect(() => {
    setPage(1);
    setExpanded(null);
  }, [filters, sort, lateOnly, module]);
  useEffect(() => {
    setPage((current) => Math.min(current, pages));
  }, [pages]);

  const update = (key: keyof typeof filters, value: string) =>
    setFilters((previous) => ({ ...previous, [key]: value }));
  const clear = () => {
    setFilters({ ...emptyFilters });
    setLateOnly(false);
    setNotice("");
  };
  const toggleHideEncerradas = () => {
    const next = !hideEncerradas;
    setManualHideEncerradas(next, clock);
    setHideEncerradas(next);
    setFilters(previous => ({ ...previous, status: next ? "" : "encerrado" }));
    setLateOnly(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("bp:hide-encerradas-changed", {
          detail: { hidden: next },
        }),
      );
    }
    setNotice(
      next
        ? "Voltando à operação: encerradas anteriores ao corte das 07:10 ficam ocultas."
        : "Mostrando todas as encerradas, inclusive as anteriores ao corte das 07:10.",
    );
  };
  const visibilitySummary = statusRevealsAllClosed
    ? "Filtro Encerrado: todas as encerradas estão selecionáveis, inclusive anteriores ao corte."
    : hideEncerradas
      ? `${hiddenClosedCount} encerradas anteriores ao corte das 07:10 estão ocultas`
      : "Todas as encerradas estão visíveis";
  const reportFilters = [
    `Status: ${filters.status ? statusLabel(filters.status as TrackingRow["trackingStatus"]) : "Todos"}`,
    `Grupo: ${filters.group || "Todos"} · Local: ${filters.location || "Todos"} · Prestador: ${filters.provider || "Todos"}`,
    `Entrada: ${filters.start || "Sem início"} até ${filters.end || "Sem fim"} · Prazo: ${lateOnly ? "Somente previsões vencidas" : "Todos"}`,
    `Busca: ${filters.query.trim() || "Nenhuma"} · Ordenação: ${sort === "priority" ? "Prazo / prioridade" : sort === "recent" ? "Entradas recentes" : "Frota"}`,
    `Visibilidade: ${visibilitySummary}`,
  ];

  const exportReport = async (format: "pdf" | "xlsx") => {
    if (!data || !rows.length || dateError || exporting) return;
    setExporting(format);
    setExportError("");
    setNotice("");
    try {
      const options = {
        rows,
        module,
        filters: reportFilters,
        sourceUpdated: data.sync?.fonte_atualizada || null,
        lastSynced: data.sync?.sincronizado_em || null,
        sourceError: warning || null,
      };
      if (format === "pdf") await exportTrackingPDF(options);
      else await exportTrackingExcel(options);
      setNotice(
        `Relatório ${format === "pdf" ? "PDF" : "Excel"} gerado com todas as ${rows.length} ordens da seleção.`,
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className={`maintenance-tracking maintenance-tracking--${module}`}>
      <div className="mt-ribbon-layer" aria-hidden="true" />
      <section className="mt-hero" aria-labelledby="mt-title">
        <div className="mt-hero-brand">
          <img src="/logo.png" alt="Branco Peres Agro" />
          <div>
            <p className="mt-eyebrow">Manutenção de frota / acompanhamento integrado</p>
            <h2 id="mt-title">{TRACKING_TITLES[module]}</h2>
            <p className="mt-hero-description">{descriptions[module]}</p>
          </div>
        </div>
        <div className="mt-hero-actions">
          <span className="mt-source-tag">
            <ModuleIcon size={17} aria-hidden="true" />
            Ordens da Gestão de Manutenção
          </span>
          <button
            type="button"
            className="mt-btn mt-btn-primary"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
            {refreshing ? "Atualizando…" : "Atualizar ordens"}
          </button>
        </div>
      </section>

      <div className="mt-source-line">
        <span>
          <span
            className={`mt-connection-dot ${warning ? "mt-connection-dot--warning" : ""}`}
            aria-hidden="true"
          />
          {loading
            ? "Consultando integração"
            : !data
              ? "Sem fotografia disponível"
              : warning
                ? "Atenção à atualização"
                : "Integração compartilhada"}
        </span>
        <span>
          Fonte: <strong>{fmt(data?.sync?.fonte_atualizada)}</strong>
        </span>
        <span>
          Sincronização: <strong>{fmt(data?.sync?.sincronizado_em)}</strong>
        </span>
      </div>

      {warning && (
        <div className="mt-alert" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div>
            <strong>Atualização requer atenção</strong>
            <p>{warning}</p>
            {data && (
              <p>A última fotografia carregada continua visível. O aviso será incluído nos relatórios.</p>
            )}
          </div>
        </div>
      )}
      {exportError && (
        <div className="mt-alert" role="alert">
          Não foi possível gerar o relatório: {exportError}
        </div>
      )}
      {notice && (
        <div className="mt-notice" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          {notice}
        </div>
      )}
      {hideEncerradas && hiddenClosedCount > 0 && (
        <div className="mt-visibility-bar" role="status">
          <EyeOff size={18} aria-hidden="true" />
          <span>
            {hiddenClosedCount} encerradas anteriores ao corte das 07:10 estão ocultas
          </span>
          <button
            type="button"
            className="mt-visibility-action"
            onClick={toggleHideEncerradas}
            title="Mostrar todas as encerradas, inclusive as anteriores ao corte"
          >
            <Eye size={16} aria-hidden="true" />
            Mostrar encerradas
          </button>
        </div>
      )}

      <section
        className="mt-kpis"
        aria-label="Indicadores do recorte; clique em um status para filtrar"
      >
        {[
          {
            key: "",
            label: "Ordens no recorte",
            value: counts.total,
            icon: ClipboardList,
            hint: `${counts.frotas} frotas distintas`,
          },
          {
            key: "programado",
            label: "Programadas",
            value: counts.programado,
            icon: CalendarDays,
            hint: "Programação na origem",
          },
          {
            key: "andamento",
            label: "Em andamento",
            value: counts.andamento,
            icon: Wrench,
            hint: "Execução na origem",
          },
          {
            key: "encerrado",
            label: "Encerradas",
            value: counts.encerrado,
            icon: CheckCircle2,
            hint: "Fonte ou encerramento operacional",
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          const value = kpi.key === "encerrado" ? historicalCounts.encerrado : kpi.value;
          return (
            <button
              key={kpi.key}
              type="button"
              className={`mt-kpi ${filters.status === kpi.key ? "mt-kpi--active" : ""}`}
              aria-pressed={filters.status === kpi.key}
              onClick={() => update("status", kpi.key)}
            >
              <span className="mt-kpi-label">{kpi.label}</span>
              <Icon size={21} aria-hidden="true" />
              <strong>{data ? (isVerdan ? <VerdanCountUp value={value} /> : value) : "—"}</strong>
              <small>{data ? kpi.hint : "Aguardando dados"}</small>
            </button>
          );
        })}
      </section>

      <details className="mt-filters">
        <summary>
          <span>
            <Filter size={19} aria-hidden="true" />
            Filtros de acompanhamento{filterCount > 0 && <b>{filterCount}</b>}
          </span>
          <span className="mt-filter-summary">
            Refine por frota, status e período <ChevronDown size={18} aria-hidden="true" />
          </span>
        </summary>
        <div className="mt-filter-body">
          <label className="mt-search">
            <span>Buscar ordens</span>
            <div>
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                placeholder="Frota, OS, equipamento ou serviço"
                value={filters.query}
                onChange={(event) => update("query", event.target.value)}
              />
            </div>
          </label>
          <label>
            <span>Situação</span>
            <select
              value={filters.status}
              onChange={(event) => update("status", event.target.value)}
            >
              <option value="">Todas as situações</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Grupo de equipamento</span>
            <select
              value={filters.group}
              onChange={(event) => update("group", event.target.value)}
            >
              <option value="">Todos os grupos</option>
              {optionList("apoio").map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Local da manutenção</span>
            <select
              value={filters.location}
              onChange={(event) => update("location", event.target.value)}
            >
              <option value="">Todos os locais</option>
              {optionList("origem").map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Prestador / oficina</span>
            <select
              value={filters.provider}
              onChange={(event) => update("provider", event.target.value)}
            >
              <option value="">Todos os prestadores</option>
              {optionList("prestador").map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Entrada a partir de</span>
            <input
              type="date"
              value={filters.start}
              onChange={(event) => update("start", event.target.value)}
            />
          </label>
          <label>
            <span>Entrada até</span>
            <input
              type="date"
              value={filters.end}
              min={filters.start || undefined}
              onChange={(event) => update("end", event.target.value)}
            />
          </label>
          <div className="mt-filter-footer">
            <label className="mt-checkbox">
              <input
                type="checkbox"
                checked={lateOnly}
                onChange={(event) => setLateOnly(event.target.checked)}
              />
              Somente previsão vencida
            </label>
            <button
              type="button"
              className="mt-btn"
              disabled={!filterCount}
              onClick={clear}
            >
              <X size={16} aria-hidden="true" />
              Limpar filtros
            </button>
          </div>
          {dateError && (
            <p className="mt-date-error" role="alert">
              A data final deve ser igual ou posterior à data inicial.
            </p>
          )}
        </div>
      </details>

      <nav className="mt-status-tabs" aria-label="Filtrar por situação">
        <button
          type="button"
          aria-pressed={!filters.status}
          onClick={() => update("status", "")}
        >
          Todas <b>{data ? counts.total : "—"}</b>
        </button>
        {statusOptions.map((status) => (
          <button
            type="button"
            key={status}
            aria-pressed={filters.status === status}
            onClick={() => update("status", status)}
          >
            {statusLabel(status)}
            <b>
              {data
                ? status === "encerrado"
                  ? historicalCounts.encerrado
                  : status === "outros"
                    ? counts.outros + counts.ausente
                    : counts[status]
                : "—"}
            </b>
          </button>
        ))}
      </nav>
      <p className="mt-history-summary">
        Histórico no recorte: <strong>{data ? historicalCounts.total : "—"}</strong> ordens ·{" "}
        <strong>{data ? historicalCounts.encerrado : "—"}</strong> encerradas. O recorte visível tem{" "}
        <strong>{data ? counts.total : "—"}</strong> ordens.
      </p>

      <section className="mt-results" aria-labelledby="mt-results-title">
        <div className="mt-toolbar">
          <div>
            <p className="mt-eyebrow">Visão operacional</p>
            <h3 id="mt-results-title">
              {data ? `${rows.length} ordens selecionadas` : "Acompanhamento de ordens"}
            </h3>
            <p>
              {data
                ? `${selectedCounts.frotas} frotas · ${selectedCounts.atrasado} previsões vencidas`
                : "Dados obtidos exclusivamente da integração existente"}
            </p>
          </div>
          <div className="mt-toolbar-actions">
            <label className="mt-sort">
              <ArrowDownUp size={17} aria-hidden="true" />
              <select
                aria-label="Ordenar ordens"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="priority">Prazo / prioridade</option>
                <option value="recent">Entradas recentes</option>
                <option value="fleet">Número da frota</option>
              </select>
            </label>
            <div className="mt-view-toggle" aria-label="Modo de visualização">
              <button
                type="button"
                aria-label="Visualizar em painel operacional"
                title="Painel Operacional (Triagem + Dossiê)"
                aria-pressed={view === "panel"}
                onClick={() => setView("panel")}
              >
                <Columns3 size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Visualizar em cartões"
                title="Cartões"
                aria-pressed={view === "cards"}
                onClick={() => setView("cards")}
              >
                <LayoutGrid size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Visualizar em tabela"
                title="Tabela"
                aria-pressed={view === "table"}
                onClick={() => setView("table")}
              >
                <List size={18} aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              className="mt-btn mt-visibility-toggle"
              onClick={toggleHideEncerradas}
              title={
                hideEncerradas
                  ? "Mostrar todas as encerradas"
                  : "Voltar à operação: ocultar encerradas anteriores ao corte"
              }
            >
              {hideEncerradas ? (
                <Eye size={17} aria-hidden="true" />
              ) : (
                <EyeOff size={17} aria-hidden="true" />
              )}
              {hideEncerradas ? "Mostrar encerradas" : "Ocultar encerradas"}
            </button>
            <button
              type="button"
              className="mt-btn"
              onClick={() => void exportReport("pdf")}
              disabled={Boolean(exporting) || !rows.length || !data || dateError}
            >
              <FileText size={17} aria-hidden="true" />
              {exporting === "pdf" ? "Gerando…" : "Relatório PDF"}
            </button>
            <button
              type="button"
              className="mt-btn"
              onClick={() => void exportReport("xlsx")}
              disabled={Boolean(exporting) || !rows.length || !data || dateError}
            >
              <Download size={17} aria-hidden="true" />
              {exporting === "xlsx" ? "Gerando…" : "Excel"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-empty" role="status">
            <RefreshCw size={31} className="animate-spin" aria-hidden="true" />
            <h4>Carregando ordens de manutenção</h4>
            <p>Consultando a fotografia compartilhada da Gestão de Ordens.</p>
          </div>
        ) : !data ? (
          <div className="mt-empty">
            <AlertTriangle size={33} aria-hidden="true" />
            <h4>Não foi possível carregar as ordens</h4>
            <p>Verifique a conexão e a integração Supabase existente.</p>
            <button
              type="button"
              className="mt-btn"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              Tentar novamente
            </button>
          </div>
        ) : !rows.length ? (
          <div className="mt-empty">
            <ModuleIcon size={35} aria-hidden="true" />
            <h4>
              {dateError
                ? "Revise o período selecionado"
                : filterCount
                  ? "Nenhuma ordem corresponde aos filtros"
                  : "Nenhuma ordem identificada neste acompanhamento"}
            </h4>
            <p>
              {(module === "reformas" || module.startsWith("reformas-"))
                ? "São consideradas reformas explícitas dos equipamentos cadastrados no Controle Apoio e identificados para este módulo. Confira o grupo da frota no cadastro se necessário."
                : "São consideradas somente carretas canavieiras com serviço identificado na ordem."}
            </p>
            {filterCount > 0 && (
              <button type="button" className="mt-btn" onClick={clear}>
                Limpar filtros
              </button>
            )}
          </div>
        ) : view === "panel" ? (
          <TrackingOperationalPanel rows={rows} clock={clock} />
        ) : view === "cards" ? (
          <div className="mt-card-grid">
            {shown.map((row) => (
              <MaintenanceOrderCard
                key={row.chave}
                row={row}
                clock={clock}
                expanded={expanded === row.chave}
                onToggle={() =>
                  setExpanded((current) =>
                    current === row.chave ? null : row.chave,
                  )
                }
              />
            ))}
          </div>
        ) : (
          <div
            className="mt-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Tabela de acompanhamento com rolagem horizontal"
          >
            <table className="mt-table">
              <caption className="sr-only">
                {TRACKING_TITLES[module]} — {rows.length} ordens selecionadas; página {currentPage} de {pages}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Frota / OS</th>
                  <th scope="col">Equipamento / grupo</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Local / prestador</th>
                  <th scope="col">Entrada</th>
                  <th scope="col">Previsão</th>
                  <th scope="col">Serviço / critério</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => {
                  const closure = closureText(row);
                  const closed = displayStatus(row) === "encerrado";
                  const detectedAt = closed ? trackingClosedAt(row) : null;
                  const lastSeen = row.ultima_vista || row.primeira_vista;
                  return (
                    <tr key={row.chave} className={closed ? "mt-table-row--closed" : undefined}>
                      <td>
                        {closed && (
                          <span className="mt-table-closed-ribbon">
                            ENCERRADA · {closureOriginLabel(trackingClosureOrigin(row))}
                          </span>
                        )}
                        <strong>{row.frota}</strong>
                        <small>OS {row.os || "Não informada"}</small>
                      </td>
                      <td>
                        <div className="mt-table-equipment-cell">
                          <EquipmentThumbnail equipment={row} size="table" />
                          <div>
                            {row.equipamento || row.modelo || "Não informado"}
                            <small>{row.apoio}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <MaintenanceStatusBadge row={row} />
                        <small>
                          {displayStatus(row) === "encerrado"
                            ? closure
                            : row.status || "Último status não informado"}
                        </small>
                        {closed && (
                          <span className="mt-table-closure-facts">
                            <strong>DETECÇÃO</strong> {detectedAt ? fmt(detectedAt) : "Data não informada"}
                            <strong>ÚLTIMA PRESENÇA</strong> {lastSeen ? fmt(lastSeen) : "Data não informada"}
                            <strong>SEM ATRASO</strong>
                          </span>
                        )}
                        {row.overdue && (
                          <small className="mt-date-error">Previsão vencida</small>
                        )}
                      </td>
                      <td>
                        {oficinaLabel(row.origem)}
                        <small>{row.prestador || "Prestador não informado"}</small>
                      </td>
                      <td>{fmt(row.entrada)}</td>
                      <td>{fmt(row.previsao)}</td>
                      <td>
                        <details>
                          <summary>{row.motivo || row.ponto || "Ver serviço completo"}</summary>
                          <p>{row.narrativa || "Narrativa não informada"}</p>
                          <small>{row.classificationReason}</small>
                          {displayStatus(row) === "encerrado" && closure && (
                            <small>{closure} · encerramento operacional</small>
                          )}
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && view !== "panel" && (
          <footer className="mt-pagination">
            <span>
              Exibindo {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, rows.length)} de {rows.length} · relatórios incluem toda a seleção
            </span>
            <div>
              <button
                type="button"
                className="mt-btn"
                aria-label="Página anterior"
                disabled={currentPage === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <span>Página {currentPage} de {pages}</span>
              <button
                type="button"
                className="mt-btn"
                aria-label="Próxima página"
                disabled={currentPage === pages}
                onClick={() => {
                  setPage((current) => current + 1);
                  setExpanded(null);
                }}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </footer>
        )}
      </section>

      <aside className="mt-method">
        <ShieldCheck size={20} aria-hidden="true" />
        <p>
          <strong>Rastreabilidade da origem.</strong> Saída validada encerra operacionalmente a ordem — por status explícito ou por saída detectada da fonte. Falha de atualização não encerra; se a ordem reaparecer, o acompanhamento a reabre. Nenhuma execução humana é inventada.
        </p>
      </aside>
    </div>
  );
}
