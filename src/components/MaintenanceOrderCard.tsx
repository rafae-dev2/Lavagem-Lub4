import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  LogIn,
  MapPin,
  Truck,
} from "lucide-react";
import type { ReactNode } from "react";
import { formatApoioDate as fmt } from "../lib/apoioDate";
import EquipmentThumbnail from "./EquipmentThumbnail";
import {
  parseTrackingDate,
  statusLabel,
  trackingClosureOrigin,
  trackingClosedAt,
  trackingObservedDays,
  TrackingRow,
} from "../lib/maintenanceTracking";
import { oficinaLabel } from "../types/apoio";

interface MaintenanceOrderCardProps {
  row: TrackingRow;
  expanded: boolean;
  onToggle: () => void;
  clock: Date;
  /** Conteúdo específico do módulo, mantido dentro da área de detalhes. */
  extraDetails?: ReactNode;
}

type ClosureOrigin = "fonte" | "ausencia" | null;

function presentationStatus(row: TrackingRow) {
  return row.trackingStatus === "ausente" ? "outros" : row.trackingStatus;
}

export function closureOriginLabel(origin: ClosureOrigin) {
  if (origin === "ausencia") return "Saída validada da fonte";
  if (origin === "fonte") return "Status fonte";
  return "Encerramento operacional";
}

function closureNote(origin: ClosureOrigin) {
  if (origin === "ausencia") {
    return "Saída validada da listagem; encerra operacionalmente o acompanhamento. Não registra execução humana.";
  }
  if (origin === "fonte") {
    return "Encerramento informado pela fonte; o acompanhamento não reconstrói execução humana.";
  }
  return "Encerramento operacional conforme os dados disponíveis na fonte.";
}

export function MaintenanceStatusBadge({ row }: { row: TrackingRow }) {
  const status = presentationStatus(row);
  const origin = status === "encerrado" ? trackingClosureOrigin(row) : null;
  return (
    <span className={`mt-status mt-status--${status}`}>
      <span className="mt-status-dot" aria-hidden="true" />
      <span>{statusLabel(status)}</span>
      {status === "encerrado" && (
        <small>{closureOriginLabel(origin)}</small>
      )}
    </span>
  );
}

function formatDetectedAt(row: TrackingRow) {
  const detectedAt = trackingClosedAt(row);
  return detectedAt ? fmt(detectedAt) : "Data não informada";
}

function formatObservedDate(value: string | null | undefined) {
  return value && parseTrackingDate(value) ? fmt(value) : fmt(value);
}

export default function MaintenanceOrderCard({
  row,
  expanded,
  onToggle,
  clock,
  extraDetails,
}: MaintenanceOrderCardProps) {
  const days = trackingObservedDays(row, clock);
  const status = presentationStatus(row);
  const origin = status === "encerrado" ? trackingClosureOrigin(row) : null;
  const detailId = `mt-detail-${encodeURIComponent(row.chave)}`;
  const fleet = row.frota === "SEM-FROTA" ? "Não informada" : row.frota;
  const local = oficinaLabel(row.origem);
  const provider = row.prestador || "Prestador não informado";
  const point = [row.setor, row.ponto].filter(Boolean).join(" · ");
  const detectedAt = trackingClosedAt(row);
  const lastSeen = row.ultima_vista || row.primeira_vista;

  return (
    <article
      className={`glass-card mt-order ${row.overdue ? "mt-order--late" : ""} ${status === "encerrado" ? "mt-order--closed" : ""} ${expanded ? "is-expanded is-active" : ""}`}
      aria-label={`OS ${row.os || "não informada"}, frota ${fleet}`}
    >
      {status === "encerrado" && (
        <div className="mt-closed-ribbon" aria-label="Ordem encerrada">
          <strong>ENCERRADA</strong>
          <span>{closureOriginLabel(origin)}</span>
        </div>
      )}
      <header className="mt-order-head">
        <div className="mt-equipment-identity-row">
          <div className="mt-order-identity">
            <span className="mt-card-kicker">{row.apoio}</span>
            <h3 className="mt-fleet-title">
              <Truck size={22} aria-hidden="true" />
              <span>
                <small>FROTA</small>
                <strong>{fleet}</strong>
              </span>
            </h3>
            <p className="mt-equipment">
              {row.equipamento || row.modelo || "Equipamento não informado"}
              <span className="mt-os">OS {row.os || "Não informada"}</span>
            </p>
          </div>
          <EquipmentThumbnail equipment={row} size="card" />
        </div>
        <div className="mt-card-badges">
          <MaintenanceStatusBadge row={row} />
          {days !== null && (
            <span className={`mt-days ${row.overdue ? "mt-days--late" : ""}`}>
              <strong>{days}</strong>
              <small>{days === 1 ? "dia observado" : "dias observados"}</small>
            </span>
          )}
        </div>
      </header>

      <dl className="mt-quadrants">
        <div className="mt-quadrant">
          <MapPin size={22} aria-hidden="true" />
          <div>
            <dt>Local / prestador</dt>
            <dd>{local}</dd>
            <small>{provider}</small>
            {point && <small>{point}</small>}
          </div>
        </div>
        <div className="mt-quadrant">
          <LogIn size={22} aria-hidden="true" />
          <div>
            <dt>Entrada</dt>
            <dd>{fmt(row.entrada)}</dd>
            <small>Data informada pela fonte</small>
          </div>
        </div>
        <div className={`mt-quadrant ${row.overdue ? "mt-quadrant--late" : ""}`}>
          <CalendarClock size={22} aria-hidden="true" />
          <div>
            <dt>Previsão de saída</dt>
            <dd>
              {fmt(row.previsao)}
              {row.overdue && (
                <AlertTriangle size={16} aria-label="Previsão de saída vencida" />
              )}
            </dd>
            <small>{row.overdue ? "Prazo vencido na fonte" : "Previsão, não confirmação"}</small>
          </div>
        </div>
        <div className="mt-quadrant mt-quadrant--status">
          <CheckCircle2 size={22} aria-hidden="true" />
          <div>
            <dt>Status / histórico</dt>
            <dd>{statusLabel(status)}</dd>
            {status === "encerrado" ? (
              <small>
                {closureOriginLabel(origin)}
                {detectedAt ? ` · ${fmt(detectedAt)}` : ""}
              </small>
            ) : (
              <small>{row.status || "Status não informado na fonte"}</small>
            )}
          </div>
        </div>
      </dl>

      {status === "encerrado" && (
        <section className="mt-closure-summary" aria-label="Fatos do encerramento">
          <div className="mt-closure-fact mt-closure-fact--detection">
            <span>DETECÇÃO</span>
            <strong>{formatDetectedAt(row)}</strong>
            <small>Detecção operacional; não é data de realização.</small>
          </div>
          <div className="mt-closure-fact">
            <span>ÚLTIMA PRESENÇA</span>
            <strong>{lastSeen ? formatObservedDate(lastSeen) : "Data não informada"}</strong>
            <small>Último registro disponível na fonte.</small>
          </div>
          <div className="mt-closure-fact mt-closure-fact--clear">
            <span>ATRASO</span>
            <strong>Sem atraso</strong>
            <small>Encerramento não confirma execução humana.</small>
          </div>
        </section>
      )}

      {row.overdue && (
        <p className="mt-late-label">
          <AlertTriangle size={16} aria-hidden="true" />
          Previsão vencida · a situação não é alterada por atraso
        </p>
      )}

      <section className="mt-narrative-section" aria-label="Serviço da ordem">
        <p className="mt-label">Serviço / narrativa</p>
        <p className={`mt-narrative ${expanded ? "" : "line-clamp-3"}`}>
          {row.narrativa || row.motivo || "Serviço não informado na origem."}
        </p>
      </section>

      <div className="mt-order-bottom">
        <span className="mt-source-fact">
          <Building2 size={15} aria-hidden="true" />
          {status === "encerrado"
            ? `${closureOriginLabel(origin)}${detectedAt ? ` em ${fmt(detectedAt)}` : ""}`
            : "Acompanhamento na fonte"}
        </span>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailId}
          onClick={onToggle}
        >
          {expanded ? "Ocultar detalhes" : "Ver detalhes"}
          <ChevronDown size={17} className={expanded ? "mt-rotated" : ""} aria-hidden="true" />
        </button>
      </div>

      <div id={detailId} hidden={!expanded} className="mt-observations">
        <div className="mt-timeline-header">
          <strong>FROTA {fleet}</strong>
          <span>OS {row.os || "Não informada"}</span>
        </div>
        <ol className="mt-timeline" aria-label="Linha factual de acompanhamento da ordem">
          <li className="mt-timeline-event">
            <strong>Entrada</strong>
            <span>{fmt(row.entrada)}</span>
            <small>Data informada pela fonte</small>
          </li>
          <li className={`mt-timeline-event${row.overdue ? " is-late" : ""}`}>
            <strong>Previsão de saída{row.overdue ? " · atrasada" : ""}</strong>
            <span>{fmt(row.previsao)}</span>
            <small>Previsão operacional; não confirma execução</small>
          </li>
          {status === "encerrado" && (
            <li className="mt-timeline-event is-closed">
              <strong>{closureOriginLabel(origin)}</strong>
              <span>{formatDetectedAt(row)}</span>
              <small>{closureNote(origin)}</small>
            </li>
          )}
          {lastSeen && (
            <li className="mt-timeline-event">
              <strong>Última observação na fonte</strong>
              <span>{formatObservedDate(lastSeen)}</span>
              <small>Registro factual disponível no acompanhamento</small>
            </li>
          )}
        </ol>
        {extraDetails}
        <details className="mt-full-history">
          <summary>
            Ver histórico e campos da fonte
            <ChevronDown size={17} aria-hidden="true" />
          </summary>
          <dl className="mt-detail-meta">
            <div>
              <dt>Último status da fonte</dt>
              <dd>{row.status || "Não informado"}</dd>
            </div>
            <div>
              <dt>Encerramento operacional</dt>
              <dd>{status === "encerrado" ? closureOriginLabel(origin) : "Não encerrada"}</dd>
            </div>
            {status === "encerrado" && (
              <div>
                <dt>Data detectada</dt>
                <dd>{formatDetectedAt(row)}</dd>
              </div>
            )}
            <div>
              <dt>Classe / motivo</dt>
              <dd>
                {row.classe || "Não informado"} · {row.motivo || "Não informado"}
              </dd>
            </div>
            <div>
              <dt>Setor / ponto</dt>
              <dd>
                {row.setor || "Não informado"} · {row.ponto || "Não informado"}
              </dd>
            </div>
            <div>
              <dt>Critério de seleção</dt>
              <dd>{row.classificationReason}</dd>
            </div>
            <div>
              <dt>Primeira observação</dt>
              <dd>{fmt(row.primeira_vista)}</dd>
            </div>
            <div>
              <dt>Última observação</dt>
              <dd>{fmt(row.ultima_vista)}</dd>
            </div>
            <div className="mt-detail-full">
              <dt>Narrativa completa</dt>
              <dd>{row.narrativa || "Não informada"}</dd>
            </div>
          </dl>
          <p className="mt-date-note">
            Saída validada encerra operacionalmente o acompanhamento; falha de atualização não encerra e uma ordem que reaparece é reaberta. Nenhuma execução humana é inventada.
          </p>
        </details>
      </div>
    </article>
  );
}
