import { oficinaLabel } from "../types/apoio";
import {
  parseTrackingDate,
  statusLabel,
  type TrackingRow,
} from "./maintenanceTracking";

export type TrackingUrgencyTier =
  | "overdue"
  | "progress"
  | "scheduled"
  | "other"
  | "closed";

export type TrackingPanelGroupBy = "priority" | "location" | "provider";
export type TrackingQuickFilter =
  | "all"
  | "overdue"
  | "progress"
  | "scheduled"
  | "external";

export interface TrackingClassifiedItem {
  row: TrackingRow;
  tier: TrackingUrgencyTier;
  statusLabel: string;
  closed: boolean;
  overdue: boolean;
  isExternal: boolean;
  local: string;
  provider: string;
  daysOpen: number | null;
  slaProgressPct: number | null;
  forecastDeltaDays: number | null;
}

export interface TrackingPanelBucket {
  id: string;
  label: string;
  tone: "danger" | "progress" | "scheduled" | "neutral" | "closed";
  items: TrackingClassifiedItem[];
  overdueCount: number;
}

export interface TrackingPanelMetrics {
  total: number;
  overdueCount: number;
  inProgressCount: number;
  scheduledCount: number;
  externalCount: number;
  closedCount: number;
  distinctFleets: number;
}

const MS_PER_DAY = 86_400_000;

function toUtcDayKeyMs(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function parsedDateKeyMs(value: string | null | undefined): number | null {
  const parsed = parseTrackingDate(value);
  if (!parsed) return null;
  const ms = Date.parse(`${parsed.dateKey}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

export function isExternalWorkshop(origem?: string | null): boolean {
  const normalized = (origem || "").trim().toLocaleLowerCase("pt-BR");
  return (
    normalized === "terceiro" ||
    normalized === "externo" ||
    normalized === "externa" ||
    normalized === "oficina externa"
  );
}

export function classifyTrackingRow(
  row: TrackingRow,
  clock: Date = new Date(),
): TrackingClassifiedItem {
  const closed = row.trackingStatus === "encerrado";
  const overdue = !closed && Boolean(row.overdue);
  const tier: TrackingUrgencyTier = closed
    ? "closed"
    : overdue
      ? "overdue"
      : row.trackingStatus === "andamento"
        ? "progress"
        : row.trackingStatus === "programado"
          ? "scheduled"
          : "other";

  const todayMs = toUtcDayKeyMs(clock);
  const entradaMs = parsedDateKeyMs(row.entrada);
  const previsaoMs = parsedDateKeyMs(row.previsao);

  const daysOpen =
    entradaMs !== null
      ? Math.max(0, Math.round((todayMs - entradaMs) / MS_PER_DAY))
      : null;

  const forecastDeltaDays =
    previsaoMs !== null
      ? Math.round((previsaoMs - todayMs) / MS_PER_DAY)
      : null;

  let slaProgressPct: number | null = null;
  if (closed) {
    slaProgressPct = 100;
  } else if (entradaMs !== null && previsaoMs !== null) {
    const totalSpan = Math.max(MS_PER_DAY, previsaoMs - entradaMs);
    const elapsed = Math.max(0, todayMs - entradaMs);
    slaProgressPct = Math.min(100, Math.round((elapsed / totalSpan) * 100));
  }

  return {
    row,
    tier,
    statusLabel: overdue ? "Prazo vencido" : statusLabel(row.trackingStatus),
    closed,
    overdue,
    isExternal: isExternalWorkshop(row.origem),
    local: oficinaLabel(row.origem),
    provider: row.prestador?.trim() || "Prestador não informado",
    daysOpen,
    slaProgressPct,
    forecastDeltaDays,
  };
}

export function summarizeTrackingPanelMetrics(
  rows: readonly TrackingRow[],
  clock: Date = new Date(),
): TrackingPanelMetrics {
  const fleets = new Set<string>();
  let overdueCount = 0;
  let inProgressCount = 0;
  let scheduledCount = 0;
  let externalCount = 0;
  let closedCount = 0;

  for (const row of rows) {
    const item = classifyTrackingRow(row, clock);
    if (row.frota && row.frota !== "SEM-FROTA") fleets.add(row.frota);
    if (item.closed) closedCount += 1;
    if (item.overdue) overdueCount += 1;
    if (!item.closed && row.trackingStatus === "andamento") inProgressCount += 1;
    if (!item.closed && row.trackingStatus === "programado") scheduledCount += 1;
    if (item.isExternal) externalCount += 1;
  }

  return {
    total: rows.length,
    overdueCount,
    inProgressCount,
    scheduledCount,
    externalCount,
    closedCount,
    distinctFleets: fleets.size,
  };
}

export function filterTrackingPanelRows(
  rows: readonly TrackingRow[],
  quickFilter: TrackingQuickFilter,
  clock: Date = new Date(),
): TrackingRow[] {
  if (quickFilter === "all") return [...rows];
  return rows.filter((row) => {
    const item = classifyTrackingRow(row, clock);
    if (quickFilter === "overdue") return item.overdue;
    if (quickFilter === "progress") return !item.closed && row.trackingStatus === "andamento";
    if (quickFilter === "scheduled") return !item.closed && row.trackingStatus === "programado";
    if (quickFilter === "external") return item.isExternal;
    return true;
  });
}

const PRIORITY_BUCKET_META: Record<
  TrackingUrgencyTier,
  { label: string; tone: TrackingPanelBucket["tone"]; rank: number }
> = {
  overdue: { label: "Previsão vencida", tone: "danger", rank: 0 },
  progress: { label: "Em andamento", tone: "progress", rank: 1 },
  scheduled: { label: "Programadas", tone: "scheduled", rank: 2 },
  other: { label: "Outros status", tone: "neutral", rank: 3 },
  closed: { label: "Encerradas", tone: "closed", rank: 4 },
};

function compareClassifiedItems(
  a: TrackingClassifiedItem,
  b: TrackingClassifiedItem,
): number {
  const rankDiff = PRIORITY_BUCKET_META[a.tier].rank - PRIORITY_BUCKET_META[b.tier].rank;
  if (rankDiff !== 0) return rankDiff;
  const daysA = a.daysOpen ?? -1;
  const daysB = b.daysOpen ?? -1;
  if (daysB !== daysA) return daysB - daysA;
  return a.row.frota.localeCompare(b.row.frota, "pt-BR", { numeric: true });
}

export function groupTrackingPanelRows(
  rows: readonly TrackingRow[],
  groupBy: TrackingPanelGroupBy,
  clock: Date = new Date(),
): TrackingPanelBucket[] {
  const classified = rows.map((row) => classifyTrackingRow(row, clock));
  const map = new Map<string, TrackingPanelBucket>();

  for (const item of classified) {
    let key: string;
    let label: string;
    let tone: TrackingPanelBucket["tone"] = "neutral";

    if (groupBy === "priority") {
      key = item.tier;
      label = PRIORITY_BUCKET_META[item.tier].label;
      tone = PRIORITY_BUCKET_META[item.tier].tone;
    } else if (groupBy === "location") {
      key = item.local;
      label = item.local;
      tone = item.isExternal ? "scheduled" : "progress";
    } else {
      key = item.provider;
      label = item.provider;
      tone = item.isExternal ? "scheduled" : "neutral";
    }

    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
      if (item.overdue) existing.overdueCount += 1;
    } else {
      map.set(key, {
        id: key,
        label,
        tone,
        items: [item],
        overdueCount: item.overdue ? 1 : 0,
      });
    }
  }

  const buckets = Array.from(map.values());
  for (const bucket of buckets) {
    bucket.items.sort(compareClassifiedItems);
  }

  if (groupBy === "priority") {
    buckets.sort(
      (a, b) =>
        PRIORITY_BUCKET_META[a.id as TrackingUrgencyTier].rank -
        PRIORITY_BUCKET_META[b.id as TrackingUrgencyTier].rank,
    );
  } else {
    buckets.sort(
      (a, b) =>
        b.overdueCount - a.overdueCount ||
        b.items.length - a.items.length ||
        a.label.localeCompare(b.label, "pt-BR"),
    );
  }

  return buckets;
}

export function buildTrackingDossierCopyText(item: TrackingClassifiedItem): string {
  const { row, statusLabel: status, local, provider, daysOpen } = item;
  const lines = [
    `Frota ${row.frota} · OS ${row.os || "Não informada"}`,
    `Equipamento: ${row.equipamento || row.modelo || "Não informado"} (${row.apoio || "Apoio"})`,
    `Situação: ${status}${daysOpen !== null ? ` · ${daysOpen} ${daysOpen === 1 ? "dia" : "dias"} em aberto` : ""}`,
    `Local: ${local} · Prestador: ${provider}`,
    `Entrada: ${row.entrada || "—"} · Previsão: ${row.previsao || "—"}`,
    `Serviço: ${row.narrativa?.trim() || row.motivo?.trim() || "Não informado"}`,
  ];
  return lines.join("\n");
}
