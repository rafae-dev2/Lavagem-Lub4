import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Layers,
  MapPin,
  Wrench,
} from "lucide-react";
import { formatApoioDate as formatDate } from "../lib/apoioDate";
import {
  trackingClosedAt,
  trackingClosureOrigin,
  type TrackingRow,
} from "../lib/maintenanceTracking";
import {
  buildTrackingDossierCopyText,
  filterTrackingPanelRows,
  groupTrackingPanelRows,
  summarizeTrackingPanelMetrics,
  type TrackingClassifiedItem,
  type TrackingPanelGroupBy,
  type TrackingQuickFilter,
} from "../lib/trackingOperationalPanel";
import { closureOriginLabel } from "./MaintenanceOrderCard";
import EquipmentThumbnail from "./EquipmentThumbnail";
import "../styles/apoio-operational-panel.css";

interface TrackingOperationalPanelProps {
  rows: TrackingRow[];
  clock?: Date;
}

function formatForecastHint(item: TrackingClassifiedItem): string {
  if (item.closed) return "Ordem encerrada";
  if (item.forecastDeltaDays === null) return "Previsão não informada";
  if (item.forecastDeltaDays < 0) {
    const late = Math.abs(item.forecastDeltaDays);
    return `Atrasada há ${late} ${late === 1 ? "dia" : "dias"}`;
  }
  if (item.forecastDeltaDays === 0) return "Previsão vence hoje";
  return `Faltam ${item.forecastDeltaDays} ${item.forecastDeltaDays === 1 ? "dia" : "dias"}`;
}

function TrackingDossierBody({ item }: { item: TrackingClassifiedItem }) {
  const [copied, setCopied] = useState(false);
  const { row, statusLabel, closed, overdue, daysOpen, local, provider, slaProgressPct } = item;
  const detectedAt = closed ? trackingClosedAt(row) : null;
  const origin = closed ? trackingClosureOrigin(row) : null;
  const narrative = row.narrativa?.trim() || "Sem narrativa informada na origem.";

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildTrackingDossierCopyText(item));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="apoio-dossier__body">
      <div className="apoio-dossier__header">
        <EquipmentThumbnail equipment={row} size="card" />
        <div className="apoio-dossier__headline">
          <div className="apoio-dossier__kicker">
            <span>{row.apoio || "Controle Apoio"}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">OS {row.os || "—"}</span>
          </div>
          <h4>Frota {row.frota === "SEM-FROTA" ? "Não informada" : row.frota}</h4>
          <p className="apoio-dossier__model">
            {row.equipamento || row.modelo || "Equipamento não informado"}
          </p>
        </div>
        <div className="apoio-dossier__status-col">
          <span className={`apoio-op-status is-${item.tier}`}>
            {closed && <CheckCircle2 size={12} aria-hidden="true" />}
            {statusLabel}
          </span>
          {daysOpen !== null && (
            <span className={`apoio-op-days tabular-nums${overdue ? " is-overdue" : ""}`}>
              {daysOpen} {daysOpen === 1 ? "dia" : "dias"}
            </span>
          )}
        </div>
      </div>

      {overdue && (
        <div className="apoio-dossier__alert" role="note">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>
            Previsão vencida em {formatDate(row.previsao)} · {formatForecastHint(item)}.
          </span>
        </div>
      )}

      {slaProgressPct !== null && (
        <div className="mt-sla-bar" aria-label="Progresso do prazo da ordem">
          <div className="mt-sla-bar__top">
            <span>Linha do prazo ({formatForecastHint(item)})</span>
            <strong className="tabular-nums">{slaProgressPct}%</strong>
          </div>
          <div className="mt-sla-bar__track">
            <div
              className={`mt-sla-bar__fill${overdue ? " is-overdue" : closed ? " is-closed" : ""}`}
              style={{ width: `${slaProgressPct}%` }}
            />
          </div>
        </div>
      )}

      <dl className="apoio-dossier__grid">
        <div>
          <dt>Local / Oficina</dt>
          <dd>{local}</dd>
        </div>
        <div>
          <dt>Prestador / Responsável</dt>
          <dd>{provider}</dd>
        </div>
        <div>
          <dt>Entrada da OS</dt>
          <dd className="tabular-nums">{formatDate(row.entrada)}</dd>
        </div>
        <div>
          <dt>Previsão de saída</dt>
          <dd className="tabular-nums">{formatDate(row.previsao)}</dd>
        </div>
        <div>
          <dt>Status na fonte</dt>
          <dd>{row.status?.trim() || "Não informado"}</dd>
        </div>
        <div>
          <dt>Última leitura</dt>
          <dd className="tabular-nums">{formatDate(row.ultima_vista || row.primeira_vista)}</dd>
        </div>
      </dl>

      <div className="apoio-dossier__narrative">
        <strong>Serviço / narrativa completa</strong>
        <p>{narrative}</p>
        {row.classificationReason && (
          <p className="apoio-dossier__footnote" style={{ marginTop: 6 }}>
            Critério: {row.classificationReason}
          </p>
        )}
      </div>

      <div className="mt-dossier-actions">
        {closed && detectedAt ? (
          <p className="apoio-dossier__footnote" style={{ margin: 0 }}>
            Encerrada em {formatDate(detectedAt)} ({closureOriginLabel(origin)}).
          </p>
        ) : (
          <span className="apoio-dossier__footnote" style={{ margin: 0 }}>
            {row.motivo || row.ponto || "Registro da integração compartilhada"}
          </span>
        )}
        <button
          type="button"
          className="mt-dossier-copy-btn"
          onClick={() => void handleCopySummary()}
        >
          {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          <span>{copied ? "Resumo copiado" : "Copiar resumo"}</span>
        </button>
      </div>
    </div>
  );
}

export default function TrackingOperationalPanel({
  rows,
  clock,
}: TrackingOperationalPanelProps) {
  const [groupBy, setGroupBy] = useState<TrackingPanelGroupBy>("priority");
  const [quickFilter, setQuickFilter] = useState<TrackingQuickFilter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [collapsedBuckets, setCollapsedBuckets] = useState<Record<string, boolean>>({});

  const summary = useMemo(
    () => summarizeTrackingPanelMetrics(rows, clock),
    [rows, clock],
  );

  const scopedRows = useMemo(
    () => filterTrackingPanelRows(rows, quickFilter, clock),
    [rows, quickFilter, clock],
  );

  const buckets = useMemo(
    () => groupTrackingPanelRows(scopedRows, groupBy, clock),
    [scopedRows, groupBy, clock],
  );

  const flatItems = useMemo(
    () => buckets.flatMap((bucket) => bucket.items),
    [buckets],
  );

  useEffect(() => {
    if (!flatItems.length) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !flatItems.some((item) => item.row.chave === selectedKey)) {
      setSelectedKey(flatItems[0].row.chave);
    }
  }, [flatItems, selectedKey]);

  const selectedItem = useMemo(
    () => flatItems.find((item) => item.row.chave === selectedKey) ?? flatItems[0] ?? null,
    [flatItems, selectedKey],
  );

  const toggleBucket = (id: string) => {
    setCollapsedBuckets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!rows.length) return null;

  return (
    <div className="apoio-op-panel" data-testid="tracking-operational-panel">
      <div className="apoio-op-controls">
        <div className="apoio-op-triage" role="group" aria-label="Triagem rápida das ordens">
          <button
            type="button"
            className={`apoio-op-chip${quickFilter === "all" ? " is-active" : ""}`}
            aria-pressed={quickFilter === "all"}
            onClick={() => setQuickFilter("all")}
          >
            <span>Todas</span>
            <strong className="tabular-nums">{summary.total}</strong>
          </button>
          <button
            type="button"
            className={`apoio-op-chip is-danger${quickFilter === "overdue" ? " is-active" : ""}`}
            aria-pressed={quickFilter === "overdue"}
            onClick={() => setQuickFilter(quickFilter === "overdue" ? "all" : "overdue")}
          >
            <AlertTriangle size={13} aria-hidden="true" />
            <span>Vencidas</span>
            <strong className="tabular-nums">{summary.overdueCount}</strong>
          </button>
          <button
            type="button"
            className={`apoio-op-chip is-progress${quickFilter === "progress" ? " is-active" : ""}`}
            aria-pressed={quickFilter === "progress"}
            onClick={() => setQuickFilter(quickFilter === "progress" ? "all" : "progress")}
          >
            <Wrench size={13} aria-hidden="true" />
            <span>Andamento</span>
            <strong className="tabular-nums">{summary.inProgressCount}</strong>
          </button>
          <button
            type="button"
            className={`apoio-op-chip${quickFilter === "scheduled" ? " is-active" : ""}`}
            aria-pressed={quickFilter === "scheduled"}
            onClick={() => setQuickFilter(quickFilter === "scheduled" ? "all" : "scheduled")}
          >
            <CalendarClock size={13} aria-hidden="true" />
            <span>Programadas</span>
            <strong className="tabular-nums">{summary.scheduledCount}</strong>
          </button>
          <button
            type="button"
            className={`apoio-op-chip${quickFilter === "external" ? " is-active" : ""}`}
            aria-pressed={quickFilter === "external"}
            onClick={() => setQuickFilter(quickFilter === "external" ? "all" : "external")}
          >
            <Building2 size={13} aria-hidden="true" />
            <span>Oficina externa</span>
            <strong className="tabular-nums">{summary.externalCount}</strong>
          </button>
        </div>

        <div className="apoio-op-groupby" role="group" aria-label="Agrupar ordens por">
          <Layers size={14} className="apoio-op-groupby__icon" aria-hidden="true" />
          <button
            type="button"
            className={`apoio-op-groupby__btn${groupBy === "priority" ? " is-active" : ""}`}
            aria-pressed={groupBy === "priority"}
            onClick={() => setGroupBy("priority")}
          >
            Urgência
          </button>
          <button
            type="button"
            className={`apoio-op-groupby__btn${groupBy === "location" ? " is-active" : ""}`}
            aria-pressed={groupBy === "location"}
            onClick={() => setGroupBy("location")}
          >
            Oficina
          </button>
          <button
            type="button"
            className={`apoio-op-groupby__btn${groupBy === "provider" ? " is-active" : ""}`}
            aria-pressed={groupBy === "provider"}
            onClick={() => setGroupBy("provider")}
          >
            Prestador
          </button>
        </div>
      </div>

      {!buckets.length ? (
        <div className="apoio-op-empty" role="status">
          <p>Nenhuma ordem corresponde a este filtro rápido de triagem.</p>
          <button
            type="button"
            className="apoio-op-chip is-active"
            onClick={() => setQuickFilter("all")}
          >
            Ver todas ({summary.total})
          </button>
        </div>
      ) : (
        <div className="apoio-op-workspace">
          <div className="apoio-op-queue" role="list" aria-label="Fila agrupada de ordens">
            {buckets.map((bucket) => {
              const collapsed = Boolean(collapsedBuckets[bucket.id]);
              return (
                <section
                  key={bucket.id}
                  className={`apoio-op-bucket is-${bucket.tone}`}
                  aria-label={`${bucket.label} (${bucket.items.length})`}
                >
                  <button
                    type="button"
                    className="apoio-op-bucket__header"
                    aria-expanded={!collapsed}
                    onClick={() => toggleBucket(bucket.id)}
                  >
                    <span className="apoio-op-bucket__title">
                      {collapsed ? (
                        <ChevronRight size={15} aria-hidden="true" />
                      ) : (
                        <ChevronDown size={15} aria-hidden="true" />
                      )}
                      <strong>{bucket.label}</strong>
                    </span>
                    <span className="apoio-op-bucket__meta">
                      {bucket.overdueCount > 0 && bucket.id !== "overdue" && (
                        <span className="apoio-op-bucket__overdue tabular-nums">
                          {bucket.overdueCount} venc.
                        </span>
                      )}
                      <span className="apoio-op-bucket__count tabular-nums">
                        {bucket.items.length}
                      </span>
                    </span>
                  </button>

                  {!collapsed && (
                    <div className="apoio-op-bucket__list">
                      {bucket.items.map((item) => {
                        const isSelected = selectedItem?.row.chave === item.row.chave;
                        return (
                          <div
                            key={item.row.chave}
                            role="listitem"
                            className={`apoio-op-item${isSelected ? " is-selected" : ""}${item.overdue ? " is-overdue" : ""}`}
                          >
                            <button
                              type="button"
                              className="apoio-op-row"
                              aria-pressed={isSelected}
                              onClick={() => setSelectedKey(item.row.chave)}
                            >
                              <div className="apoio-op-row__thumb">
                                <EquipmentThumbnail equipment={item.row} size="table" />
                              </div>
                              <div className="apoio-op-row__main">
                                <div className="apoio-op-row__top">
                                  <strong className="apoio-op-row__fleet tabular-nums">
                                    {item.row.frota}
                                  </strong>
                                  <span className="apoio-op-row__equip">
                                    {item.row.equipamento || item.row.modelo || "Equipamento"}
                                  </span>
                                  <span className="apoio-op-row__os tabular-nums">
                                    OS {item.row.os || "—"}
                                  </span>
                                </div>
                                <div className="apoio-op-row__meta">
                                  <span>
                                    <MapPin size={11} aria-hidden="true" />
                                    {item.local}
                                  </span>
                                  <span>
                                    <CalendarClock size={11} aria-hidden="true" />
                                    Prev. {formatDate(item.row.previsao)}
                                  </span>
                                  {item.daysOpen !== null && (
                                    <span className="tabular-nums">
                                      <Clock size={11} aria-hidden="true" />
                                      {item.daysOpen}d
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="apoio-op-row__aside">
                                <span className={`apoio-op-status is-${item.tier}`}>
                                  {item.statusLabel}
                                </span>
                              </div>
                            </button>

                            {isSelected && (
                              <div className="apoio-op-inline-dossier">
                                <TrackingDossierBody item={item} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <aside
            className="apoio-op-inspector"
            aria-label="Dossiê da ordem selecionada"
          >
            {selectedItem ? (
              <TrackingDossierBody item={selectedItem} />
            ) : (
              <div className="apoio-op-empty">
                <p>Selecione uma ordem na fila para visualizar o dossiê completo.</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
