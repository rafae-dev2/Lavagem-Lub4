import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  X,
} from "lucide-react";
import { Programacao } from "../types";
import {
  buildDashboardFocusCopyText,
  buildDashboardFocusDetail,
  type DashboardFocusContext,
} from "../lib/dashboardFocusMode";
import EquipmentThumbnail from "./EquipmentThumbnail";
import StatusBadge from "./StatusBadge";
import "../styles/dashboard-focus-mode.css";

interface DashboardFocusModalProps {
  schedule: Programacao | null;
  context: DashboardFocusContext;
  allSchedules: readonly Programacao[];
  queueLength: number;
  queueIndex: number;
  onClose: () => void;
  onNavigateQueue?: (direction: "prev" | "next") => void;
}

export default function DashboardFocusModal({
  schedule,
  context,
  allSchedules,
  queueLength,
  queueIndex,
  onClose,
  onNavigateQueue,
}: DashboardFocusModalProps) {
  const [copied, setCopied] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const detail = useMemo(() => {
    if (!schedule) return null;
    return buildDashboardFocusDetail(schedule, context, allSchedules);
  }, [schedule, context, allSchedules]);

  useEffect(() => {
    setCopied(false);
  }, [schedule?.id]);

  useEffect(() => {
    if (!schedule) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowLeft" && onNavigateQueue && queueLength > 1) {
        event.preventDefault();
        onNavigateQueue("prev");
      } else if (event.key === "ArrowRight" && onNavigateQueue && queueLength > 1) {
        event.preventDefault();
        onNavigateQueue("next");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [schedule, onClose, onNavigateQueue, queueLength]);

  if (!schedule || !detail || typeof document === "undefined") return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildDashboardFocusCopyText(detail));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return createPortal(
    <div
      className="dash-focus-backdrop"
      role="presentation"
      data-testid="dashboard-focus-overlay"
      onClick={onClose}
    >
      <div
        className="dash-focus-stage"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeBtnRef}
          type="button"
          className="dash-focus-floating-close"
          aria-label="Fechar modo foco"
          title="Fechar modo foco (Esc)"
          onClick={onClose}
        >
          <X size={17} aria-hidden="true" />
          <span>Fechar</span>
        </button>

        <article
          key={schedule.id}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dash-focus-title"
          className="dash-focus-card animate-fade-in-up"
        >
          <div className="dash-focus-scroll">
            <div className="dash-focus-header">
              <EquipmentThumbnail equipment={schedule} size="card" />
              <div className="dash-focus-headline">
                <div className="dash-focus-kicker">
                  <span>{context === "atrasados" ? "Tarefa Atrasada" : "Próximos 7 Dias"}</span>
                  <span aria-hidden="true">·</span>
                  <span>{detail.originLabel}</span>
                  {schedule.numeroOS && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">OS {schedule.numeroOS}</span>
                    </>
                  )}
                </div>
                <h2 id="dash-focus-title" className="dash-focus-title">
                  Frota {schedule.frota}
                </h2>
                <p className="dash-focus-subtitle">
                  {schedule.tipoPreventiva || "Lavagem / Lubrificação"}
                  {schedule.apoioNome ? ` · ${schedule.apoioNome}` : ""}
                </p>
              </div>
              <div className="dash-focus-status-col">
                <StatusBadge status={schedule.situacao} size="md" />
              </div>
            </div>

            <div className={`dash-focus-banner is-${detail.urgencyTone}`} role="status">
              {detail.urgencyTone === "overdue" ? (
                <AlertTriangle size={16} aria-hidden="true" />
              ) : detail.urgencyTone === "completed" ? (
                <CheckCircle2 size={16} aria-hidden="true" />
              ) : detail.urgencyTone === "today" ? (
                <Clock size={16} aria-hidden="true" />
              ) : (
                <CalendarClock size={16} aria-hidden="true" />
              )}
              <span>{detail.urgencyText}</span>
            </div>

            <dl className="dash-focus-grid">
              <div className="dash-focus-field">
                <dt>Local / Ponto</dt>
                <dd>{schedule.descricaoPonto || "Não informado"}</dd>
              </div>
              <div className="dash-focus-field">
                <dt>Data Programada</dt>
                <dd className="tabular-nums">{detail.formattedProgramada}</dd>
              </div>
              <div className="dash-focus-field">
                <dt>Horário Agendado</dt>
                <dd className="tabular-nums">{schedule.horarioAgendado || "Não informado"}</dd>
              </div>
              <div className="dash-focus-field">
                <dt>Data Realizada</dt>
                <dd className="tabular-nums">{detail.formattedRealizada}</dd>
              </div>
              <div className="dash-focus-field">
                <dt>Status na Origem</dt>
                <dd>{schedule.statusPCM?.trim() || schedule.situacao}</dd>
              </div>
              <div className="dash-focus-field">
                <dt>Grupo Apoio</dt>
                <dd>{schedule.apoioNome?.trim() || "Cadastro geral"}</dd>
              </div>
            </dl>

            <section className="dash-focus-section" aria-label="Observações e narrativa">
              <h3 className="dash-focus-section__title">Observações e narrativa operacional</h3>
              <p className="dash-focus-narrative">{detail.narrativeText}</p>
            </section>

            {detail.recentFleetHistory.length > 0 && (
              <section className="dash-focus-section" aria-label="Histórico recente da frota">
                <h3 className="dash-focus-section__title">
                  Histórico recente da Frota {schedule.frota}
                </h3>
                <div className="dash-focus-history">
                  {detail.recentFleetHistory.map((entry) => (
                    <div key={entry.id} className="dash-focus-history__row">
                      <div className="dash-focus-history__left">
                        <strong className="tabular-nums">{entry.dataFormatted}</strong>
                        <span className="dash-focus-history__muted" aria-hidden="true">·</span>
                        <span>{entry.tipoPreventiva}</span>
                        <span className="dash-focus-history__muted" aria-hidden="true">·</span>
                        <span className="dash-focus-history__muted">{entry.local}</span>
                      </div>
                      <StatusBadge status={entry.situacao} size="sm" />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="dash-focus-footer">
            <div className="dash-focus-nav">
              {onNavigateQueue && queueLength > 1 ? (
                <>
                  <button
                    type="button"
                    className="dash-focus-nav__btn"
                    aria-label="Ordem anterior"
                    onClick={() => onNavigateQueue("prev")}
                  >
                    <ChevronLeft size={15} aria-hidden="true" />
                    <span>Anterior</span>
                  </button>
                  <span className="dash-focus-nav__count tabular-nums">
                    {queueIndex + 1} de {queueLength}
                  </span>
                  <button
                    type="button"
                    className="dash-focus-nav__btn"
                    aria-label="Próxima ordem"
                    onClick={() => onNavigateQueue("next")}
                  >
                    <span>Próxima</span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <span className="dash-focus-nav__count">Modo Foco · Esc para fechar</span>
              )}
            </div>

            <button
              type="button"
              className="dash-focus-action-btn"
              onClick={() => void handleCopy()}
            >
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              <span>{copied ? "Resumo copiado" : "Copiar resumo"}</span>
            </button>
          </div>
        </article>
      </div>
    </div>,
    document.body,
  );
}
