import type { TrackingRow } from "./maintenanceTracking";
import {
  getEffectiveHideEncerradas,
  getOperationalCutoff,
  getOperationalWindowKey,
  setManualHideEncerradas,
} from "./scheduleVisibility";
import { parseTrackingDate, trackingClosedAt } from "./maintenanceTracking";

/**
 * Visibilidade dos módulos de acompanhamento. A política do corte e a
 * preferência são as mesmas de Lavagem/Programações; este módulo somente
 * adapta TrackingRow ao contrato já compartilhado.
 */
export function shouldHideClosedTrackingRow(
  row: TrackingRow,
  now = new Date(),
): boolean {
  if (row.trackingStatus !== "encerrado") return false;

  // PCM/saída validada chega aqui por trackingClosedAt. Sem a data oficial de
  // detecção não há base temporal confiável para arquivar a linha.
  const closedAt = trackingClosedAt(row);
  const parsed = closedAt ? parseTrackingDate(closedAt) : null;
  if (!parsed) return false;

  const cutoff = getOperationalCutoff(now);
  return Number.isFinite(cutoff.getTime()) && parsed.timestamp < cutoff.getTime();
}

export function countHiddenTrackingRows(
  rows: TrackingRow[],
  now = new Date(),
): number {
  return (Array.isArray(rows) ? rows : []).filter((row) =>
    shouldHideClosedTrackingRow(row, now),
  ).length;
}

/** Aplica somente o estado de ocultação; filtros de status permanecem na página. */
export function getVisibleTrackingRows(
  rows: TrackingRow[],
  hideEncerradas: boolean,
  now = new Date(),
): TrackingRow[] {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!hideEncerradas) return safeRows;
  return safeRows.filter((row) => !shouldHideClosedTrackingRow(row, now));
}

export {
  getEffectiveHideEncerradas,
  getOperationalCutoff,
  getOperationalWindowKey,
  setManualHideEncerradas,
};
