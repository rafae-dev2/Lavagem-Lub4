import type {
  ApoioData,
  ApoioOrder,
  ApoioReportRow,
} from "../types/apoio";
import { oficinaLabel } from "../types/apoio";
import {
  getMaintenanceOrderClosure,
  parseTrackingDate,
} from "./maintenanceTracking";

export type BIStatus =
  | "programado"
  | "aguardando"
  | "andamento"
  | "encerrado"
  | "outros";

export interface BIFilters {
  query: string;
  groups: string[];
  statuses: BIStatus[];
  locations: string[];
  providers: string[];
  classes: string[];
  workshops: string[];
  scope: "all" | "registered" | "unregistered";
  start: string;
  end: string;
  ageMin: string;
  ageMax: string;
  ageBandKey?: string;
  waitingOnly: boolean;
  overdueOnly: boolean;
}

export const BI_DEFAULT_FILTERS: BIFilters = {
  query: "",
  groups: [],
  statuses: [],
  locations: [],
  providers: [],
  classes: [],
  workshops: [],
  scope: "all",
  start: "",
  end: "",
  ageMin: "",
  ageMax: "",
  waitingOnly: false,
  overdueOnly: false,
};

export const BI_STATUS_LABELS: Record<BIStatus, string> = {
  programado: "Programado",
  aguardando: "Aguardando / pendente",
  andamento: "Em andamento",
  encerrado: "Encerrado",
  outros: "Outros",
};

export interface BIAgeBand {
  key: string;
  label: string;
  min: number;
  max: number | null;
}

export const BI_AGE_BANDS: BIAgeBand[] = [
  { key: "0-2", label: "0–2 dias", min: 0, max: 2 },
  { key: "3-7", label: "3–7 dias", min: 3, max: 7 },
  { key: "8-15", label: "8–15 dias", min: 8, max: 15 },
  { key: "16-30", label: "16–30 dias", min: 16, max: 30 },
  { key: "31-60", label: "31–60 dias", min: 31, max: 60 },
  { key: "61+", label: "61+ dias", min: 61, max: null },
];

export interface BIRow extends ApoioReportRow {
  groupId: string;
  registered: boolean;
  statusKey: BIStatus;
  statusName: string;
  ageDays: number | null;
  waitingDays: number | null;
  observedCycleDays: number | null;
  forecastOverdue: boolean;
  forecastDaysLate: number | null;
  openedDate: string;
  closedDate: string;
  closureType: "fonte" | "ausencia" | null;
  closedDetectedAt: string | null;
  workshop: string;
}

export interface BIGroupPoint {
  id: string;
  label: string;
  total: number;
  open: number;
  waiting: number;
  inProgress: number;
  closed: number;
  other: number;
  meanWaitingDays: number | null;
  p90WaitingDays: number | null;
  overdue: number;
}

export interface BIModel {
  rows: BIRow[];
  summary: {
    total: number;
    open: number;
    waiting: number;
    inProgress: number;
    closed: number;
    overdue: number;
    fleets: number;
    meanWaitingDays: number | null;
    medianWaitingDays: number | null;
    p90WaitingDays: number | null;
    meanOpenDays: number | null;
    waitingWithDate: number;
    openWithDate: number;
    withForecast: number;
    invalidDates: number;
    closureDetected: number;
    meanObservedCycleDays: number | null;
  };
  groupsChart: BIGroupPoint[];
  statusChart: { key: BIStatus; label: string; count: number }[];
  agingChart: (BIAgeBand & { count: number })[];
  trendChart: {
    date: string;
    label: string;
    opened: number;
    detectedClosed: number;
  }[];
  paretoChart: {
    id: string;
    label: string;
    count: number;
    cumulativePercent: number;
  }[];
  workshopChart: {
    id: string;
    label: string;
    count: number;
    meanWaitingDays: number | null;
  }[];
  scatterChart: {
    id: string;
    label: string;
    count: number;
    meanWaitingDays: number | null;
    p90WaitingDays: number | null;
  }[];
  heatmap: {
    id: string;
    label: string;
    total: number;
    counts: Record<string, number>;
  }[];
}

const DAY_MS = 86_400_000;
const CLOSED_STATUSES = new Set(["encerrado", "fechado", "finalizado", "concluido", "concluído"]);
const WAITING_STATUSES = new Set([
  "aguardando",
  "aguardando peca",
  "aguardando peça",
  "pendente",
  "pendentes",
  "aguardando material",
  "aguardando pecas",
]);
const PROGRAMMED_STATUSES = new Set(["programado", "programada", "agendado", "agendada"]);
const IN_PROGRESS_STATUSES = new Set([
  "andamento",
  "em andamento",
  "em execucao",
  "em execução",
  "executando",
  "iniciado",
]);
// Formatters são imutáveis e caros de criar; uma instância atende toda a fotografia.
const BRAZIL_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const TREND_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function fold(value: unknown): string {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

function validDate(value: unknown): ReturnType<typeof parseTrackingDate> {
  const raw = text(value);
  if (!raw) return null;
  try {
    return parseTrackingDate(raw);
  } catch {
    return null;
  }
}

function validNow(now: Date): Date {
  return now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date(Number.NaN);
}

function brazilDay(timestamp: number): string | null {
  if (!Number.isFinite(timestamp)) return null;
  const parts = BRAZIL_DAY_FORMATTER.formatToParts(new Date(timestamp));
  const values: Record<string, string> = {};
  for (const part of parts) if (part.type !== "literal") values[part.type] = part.value;
  return values.year && values.month && values.day
    ? `${values.year}-${values.month}-${values.day}`
    : null;
}

function dateOffset(day: string, offset: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, date + offset));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function finiteDays(from: number | undefined, to: number | undefined): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  const value = (to! - from!) / DAY_MS;
  return value >= 0 ? value : null;
}

function quantile(values: number[], p: number): number | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const rank = (sorted.length - 1) * p;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
}

function mean(values: number[]): number | null {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function groupLabelForSource(value: string): string {
  return text(value) || "Grupo sem informação";
}

function classifyStatus(order: ApoioOrder, closure: ReturnType<typeof getMaintenanceOrderClosure>): BIStatus {
  // O fechamento validado do helper sempre vence o status bruto.
  if (closure.status === "encerrado") return "encerrado";
  if (order.ativo !== true) return "outros";
  const raw = fold(order.status);
  if (WAITING_STATUSES.has(raw)) return "aguardando";
  if (PROGRAMMED_STATUSES.has(raw)) return "programado";
  if (IN_PROGRESS_STATUSES.has(raw)) return "andamento";
  return "outros";
}

function evidenceIsUsable(order: ApoioOrder, now: Date): boolean {
  const first = validDate(order.primeira_vista);
  const last = validDate(order.ultima_vista);
  const detected = validDate(order.ausente_desde);
  if (!first || !last || !detected || !Number.isFinite(now.getTime())) return false;
  return first.timestamp <= last.timestamp && last.timestamp <= detected.timestamp && detected.timestamp <= now.getTime();
}

function entryDate(row: BIRow) {
  return validDate(row.entrada);
}

function isQueue(row: Pick<BIRow, "statusKey">): boolean {
  return row.statusKey === "programado" || row.statusKey === "aguardando";
}

function closureForRow(order: ApoioOrder, now: Date, closure: ReturnType<typeof getMaintenanceOrderClosure>): ReturnType<typeof getMaintenanceOrderClosure> {
  if (closure.status === "encerrado" && closure.origin === "ausencia" && !evidenceIsUsable(order, now)) {
    return { status: "outros", origin: null, detectedAt: null };
  }
  return closure;
}

export function buildBIRows(data: ApoioData | null, now: Date): BIRow[] {
  if (!data || !Array.isArray(data.orders)) return [];
  const reference = validNow(now);
  const fleetsByKey = new Map<string, ApoioData["fleets"][number]>();
  for (const fleet of data.fleets || []) {
    const key = fold(fleet.frota);
    if (key && !fleetsByKey.has(key)) fleetsByKey.set(key, fleet);
  }
  const groupsById = new Map<string, ApoioData["groups"][number]>();
  for (const group of data.groups || []) if (!groupsById.has(group.id)) groupsById.set(group.id, group);
  const todayKey = brazilDay(reference.getTime());
  const rows: BIRow[] = [];

  for (const order of data.orders) {
    const fleet = fleetsByKey.get(fold(order.frota));
    const registered = Boolean(fleet);
    const group = fleet ? groupsById.get(fleet.grupo_id) : undefined;
    const groupId = fleet
      ? `apoio:${text(fleet.grupo_id) || "sem-informacao"}`
      : `fonte:${fold(order.grupo_fonte) || "sem-informacao"}`;
    const apoio = fleet
      ? text(group?.nome) || "Grupo sem informação"
      : groupLabelForSource(order.grupo_fonte);
    const equipamento = fleet
      ? text(fleet.nome) || text(order.modelo) || "Equipamento da fonte"
      : text(order.modelo) || "Equipamento da fonte";
    const originalClosure = getMaintenanceOrderClosure(order);
    const closure = closureForRow(order, reference, originalClosure);
    const statusKey = classifyStatus(order, closure);
    const entry = validDate(order.entrada);
    const entryUsable = Boolean(entry && Number.isFinite(reference.getTime()) && entry!.timestamp <= reference.getTime());
    const observedLast = validDate(order.ultima_vista);
    const observedCycleDays =
      statusKey === "encerrado" && entryUsable && observedLast && observedLast.timestamp <= reference.getTime()
        ? finiteDays(entry!.timestamp, observedLast.timestamp)
        : null;
    const ageDays =
      order.ativo === true && statusKey !== "encerrado" && entryUsable
        ? finiteDays(entry!.timestamp, reference.getTime())
        : null;
    const waitingDays = isQueue({ statusKey }) ? ageDays : null;
    const due = validDate(order.previsao);
    const forecastOverdue =
      order.ativo === true && statusKey !== "encerrado" && Boolean(due && todayKey && (due!.dateOnly ? due!.dateKey < todayKey! : due!.timestamp < reference.getTime()));
    const forecastDaysLate = forecastOverdue ? finiteDays(due!.timestamp, reference.getTime()) : null;
    const detected = text(closure.detectedAt);
    const detectedParsed = detected ? validDate(detected) : null;
    const usableDetected = detectedParsed && evidenceIsUsable(order, reference) ? detected : null;
    const location = oficinaLabel(text(order.origem));
    const workshopDetail = location === "Oficina Externa" ? text(order.prestador) || text(order.ponto) : text(order.ponto) || text(order.setor);
    const workshop = workshopDetail ? `${location} · ${workshopDetail}` : location;

    rows.push({
      ...order,
      apoio,
      equipamento,
      groupId,
      registered,
      statusKey,
      statusName: BI_STATUS_LABELS[statusKey],
      ageDays,
      waitingDays,
      observedCycleDays,
      forecastOverdue,
      forecastDaysLate,
      openedDate: entry ? (entry.dateOnly ? entry.dateKey : brazilDay(entry.timestamp) || "") : "",
      closedDate: usableDetected || "",
      closureType: statusKey === "encerrado" ? closure.origin : null,
      closedDetectedAt: usableDetected,
      workshop,
    });
  }
  return rows;
}

function validFilterDate(value: string): boolean {
  return !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && Boolean(validDate(value)));
}

function validAge(value: string): boolean {
  if (!value) return true;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

export function validateBIFilters(filters: BIFilters): string | null {
  if (!filters || typeof filters !== "object") return "Filtros inválidos.";
  if (filters.ageBandKey && !BI_AGE_BANDS.some(band => band.key === filters.ageBandKey)) return "Faixa de idade inválida.";
  if (!validFilterDate(filters.start) || !validFilterDate(filters.end)) return "Data de período inválida.";
  if (filters.start && filters.end && filters.start > filters.end) return "A data inicial não pode ser posterior à final.";
  if (!validAge(filters.ageMin) || !validAge(filters.ageMax)) return "Limite de idade inválido.";
  if (filters.ageMin && filters.ageMax && Number(filters.ageMin) > Number(filters.ageMax)) return "A idade mínima não pode ser maior que a máxima.";
  if (!["all", "registered", "unregistered"].includes(filters.scope)) return "Escopo inválido.";
  const statuses = Array.isArray(filters.statuses) ? filters.statuses : [];
  if (statuses.some((status) => !(status in BI_STATUS_LABELS))) return "Status inválido.";
  return null;
}

function inList(value: unknown, values: string[]): boolean {
  if (!values.length) return true;
  const candidate = fold(value);
  return values.some((item) => fold(item) === candidate);
}

function groupMatches(row: BIRow, groups: string[]): boolean {
  if (!groups.length) return true;
  return groups.some((group) => fold(group) === fold(row.groupId) || fold(group) === fold(row.apoio));
}

export function filterBIRows(rows: BIRow[], filters: BIFilters): BIRow[] {
  if (validateBIFilters(filters)) return [];
  const start = filters.start ? validDate(filters.start) : null;
  const end = filters.end ? validDate(filters.end) : null;
  const ageMin = filters.ageMin ? Number(filters.ageMin) : null;
  const ageMax = filters.ageMax ? Number(filters.ageMax) : null;
  const tokens = fold(filters.query).split(" ").filter(Boolean);

  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (filters.scope === "registered" && !row.registered) return false;
    if (filters.scope === "unregistered" && row.registered) return false;
    if (filters.statuses.length && !filters.statuses.includes(row.statusKey)) return false;
    if (!groupMatches(row, filters.groups)) return false;
    if (!inList(oficinaLabel(row.origem), filters.locations)) return false;
    if (!inList(row.prestador, filters.providers)) return false;
    if (!inList(row.classe, filters.classes)) return false;
    if (!inList(row.workshop, filters.workshops)) return false;
    if (filters.waitingOnly && !isQueue(row)) return false;
    if (filters.overdueOnly && (!row.forecastOverdue || row.statusKey === "encerrado")) return false;
    if (filters.ageBandKey && (row.waitingDays === null || ageBand(row.waitingDays)?.key !== filters.ageBandKey)) return false;
    if (ageMin !== null && (row.ageDays === null || row.ageDays < ageMin)) return false;
    if (ageMax !== null && (row.ageDays === null || row.ageDays > ageMax)) return false;
    if (start || end) {
      const entry = entryDate(row);
      if (!entry) return false;
      const entryDay = entry.dateOnly ? entry.dateKey : brazilDay(entry.timestamp) || "";
      if (start && entryDay < start.dateKey) return false;
      if (end && entryDay > end.dateKey) return false;
    }
    if (tokens.length) {
      const haystack = fold([
        row.frota,
        `OS ${row.os}`,
        row.narrativa,
        row.equipamento,
        row.apoio,
      ].join(" "));
      if (!tokens.every((token) => haystack.includes(token))) return false;
    }
    return true;
  });
}

function dateQualityInvalid(value: unknown, now: Date): boolean {
  const raw = text(value);
  if (!raw) return false;
  const parsed = validDate(raw);
  return !parsed || parsed.timestamp > now.getTime();
}

function ageBand(value: number): BIAgeBand | null {
  const wholeDays = Math.floor(value);
  return BI_AGE_BANDS.find((band) => wholeDays >= band.min && (band.max === null || wholeDays <= band.max)) || null;
}

function groupPoint(rows: BIRow[], id: string, label: string): BIGroupPoint {
  const waiting: number[] = [];
  let open = 0;
  let queue = 0;
  let inProgress = 0;
  let closed = 0;
  let other = 0;
  let overdue = 0;
  for (const row of rows) {
    if (row.waitingDays !== null) waiting.push(row.waitingDays);
    if (row.ativo === true && row.statusKey !== "encerrado") open += 1;
    if (isQueue(row)) queue += 1;
    if (row.statusKey === "andamento") inProgress += 1;
    if (row.statusKey === "encerrado") closed += 1;
    if (row.statusKey === "outros") other += 1;
    if (row.forecastOverdue && row.statusKey !== "encerrado") overdue += 1;
  }
  return {
    id,
    label,
    total: rows.length,
    open,
    waiting: queue,
    inProgress,
    closed,
    other,
    meanWaitingDays: mean(waiting),
    p90WaitingDays: quantile(waiting, 0.9),
    overdue,
  };
}

export function buildBIModel(rows: BIRow[], now: Date): BIModel {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const reference = validNow(now);
  const statusKeys: BIStatus[] = ["programado", "aguardando", "andamento", "encerrado", "outros"];
  const waitingValues: number[] = [];
  const openValues: number[] = [];
  const observedValues: number[] = [];
  const fleets = new Set<string>();
  const statusCounts: Record<BIStatus, number> = {
    programado: 0,
    aguardando: 0,
    andamento: 0,
    encerrado: 0,
    outros: 0,
  };
  let open = 0;
  let waiting = 0;
  let closed = 0;
  let inProgress = 0;
  let overdue = 0;
  let withForecast = 0;
  let invalidDates = 0;
  let closureDetected = 0;

  const byGroup = new Map<string, { label: string; rows: BIRow[] }>();
  for (const row of sourceRows) {
    const fleet = fold(row.frota);
    if (fleet) fleets.add(fleet);
    statusCounts[row.statusKey] += 1;
    if (row.ativo === true && row.statusKey !== "encerrado") open += 1;
    if (isQueue(row)) waiting += 1;
    if (row.statusKey === "andamento") inProgress += 1;
    if (row.statusKey === "encerrado") closed += 1;
    if (row.forecastOverdue && row.statusKey !== "encerrado") overdue += 1;
    if (row.waitingDays !== null) waitingValues.push(row.waitingDays);
    if (row.statusKey !== "encerrado" && row.ageDays !== null) openValues.push(row.ageDays);
    if (row.observedCycleDays !== null) observedValues.push(row.observedCycleDays);
    if (validDate(row.previsao)) withForecast += 1;
    if (!text(row.entrada) || dateQualityInvalid(row.entrada, reference)) invalidDates += 1;
    if (row.closedDetectedAt) closureDetected += 1;
    const existing = byGroup.get(row.groupId) || { label: row.apoio, rows: [] };
    existing.rows.push(row);
    if (!existing.label) existing.label = row.apoio;
    byGroup.set(row.groupId, existing);
  }
  const groupsChart = [...byGroup.entries()].map(([id, value]) => groupPoint(value.rows, id, value.label));
  groupsChart.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "pt-BR"));

  const agingChart = BI_AGE_BANDS.map((band) => ({
    ...band,
    count: waitingValues.reduce((total, value) => total + (ageBand(value)?.key === band.key ? 1 : 0), 0),
  }));

  const today = brazilDay(reference.getTime()) || "";
  const trendChart: BIModel["trendChart"] = [];
  const openedByDate = new Map<string, number>();
  const closedByDate = new Map<string, number>();
  for (const row of sourceRows) {
    if (row.openedDate) openedByDate.set(row.openedDate, (openedByDate.get(row.openedDate) || 0) + 1);
    if (row.closedDetectedAt) {
      const date = brazilDay(validDate(row.closedDetectedAt)?.timestamp ?? NaN);
      if (date) closedByDate.set(date, (closedByDate.get(date) || 0) + 1);
    }
  }
  if (today) {
    for (let index = 89; index >= 0; index -= 1) {
      const date = dateOffset(today, -index);
      const dateForLabel = new Date(`${date}T12:00:00Z`);
      trendChart.push({
        date,
        label: TREND_LABEL_FORMATTER.format(dateForLabel),
        opened: openedByDate.get(date) || 0,
        detectedClosed: closedByDate.get(date) || 0,
      });
    }
  }

  const queueByGroup = new Map<string, { label: string; count: number }>();
  for (const row of sourceRows.filter(isQueue)) {
    const current = queueByGroup.get(row.groupId) || { label: row.apoio, count: 0 };
    current.count += 1;
    queueByGroup.set(row.groupId, current);
  }
  const queueGroups = [...queueByGroup.entries()]
    .map(([id, value]) => ({ id, label: value.label, count: value.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
  const totalQueue = queueGroups.reduce((sum, item) => sum + item.count, 0);
  const paretoBase = queueGroups.slice(0, 10);
  const remaining = queueGroups.slice(10).reduce((sum, item) => sum + item.count, 0);
  if (remaining) paretoBase.push({ id: "__other__", label: "Demais grupos", count: remaining });
  let cumulative = 0;
  const paretoChart = paretoBase.map((item) => {
    cumulative += item.count;
    return {
      ...item,
      cumulativePercent: totalQueue ? (cumulative / totalQueue) * 100 : 0,
    };
  });
  if (paretoChart.length) paretoChart[paretoChart.length - 1].cumulativePercent = 100;

  const byWorkshop = new Map<string, { label: string; rows: BIRow[] }>();
  for (const row of sourceRows) {
    const id = fold(row.workshop) || "sem-informacao";
    const existing = byWorkshop.get(id) || { label: row.workshop || "Origem não informada", rows: [] };
    existing.rows.push(row);
    byWorkshop.set(id, existing);
  }
  const workshopChart = [...byWorkshop.entries()]
    .map(([id, value]) => ({
      id,
      label: value.label,
      count: value.rows.length,
      meanWaitingDays: mean(value.rows.flatMap((row) => row.waitingDays === null ? [] : [row.waitingDays])),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));

  const scatterChart = groupsChart
    .map((group) => {
      const values = (byGroup.get(group.id)?.rows || []).flatMap((row) => row.waitingDays === null ? [] : [row.waitingDays]);
      return {
        id: group.id,
        label: group.label,
        count: values.length,
        meanWaitingDays: mean(values),
        p90WaitingDays: quantile(values, 0.9),
      };
    })
    .filter((point) => point.count > 0);

  const heatmap = groupsChart.map((group) => {
    const counts: Record<string, number> = {};
    for (const band of BI_AGE_BANDS) counts[band.key] = 0;
    for (const row of byGroup.get(group.id)?.rows || []) {
      if (row.waitingDays === null) continue;
      const band = ageBand(row.waitingDays);
      if (band) counts[band.key] += 1;
    }
    return {
      id: group.id,
      label: group.label,
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      counts,
    };
  }).filter((point) => point.total > 0);

  return {
    rows: sourceRows,
    summary: {
      total: sourceRows.length,
      open,
      waiting,
      inProgress,
      closed,
      overdue,
      fleets: fleets.size,
      meanWaitingDays: mean(waitingValues),
      medianWaitingDays: quantile(waitingValues, 0.5),
      p90WaitingDays: quantile(waitingValues, 0.9),
      meanOpenDays: mean(openValues),
      waitingWithDate: waitingValues.length,
      openWithDate: openValues.length,
      withForecast,
      invalidDates,
      closureDetected,
      meanObservedCycleDays: mean(observedValues),
    },
    groupsChart,
    statusChart: statusKeys.map((key) => ({ key, label: BI_STATUS_LABELS[key], count: statusCounts[key] })),
    agingChart,
    trendChart,
    paretoChart,
    workshopChart,
    scatterChart,
    heatmap,
  };
}

export function getBIFilterLabels(filters: BIFilters, allRows: BIRow[]): string[] {
  if (validateBIFilters(filters)) return ["Filtros inválidos — seleção vazia"];
  const labels: string[] = [];
  if (text(filters.query)) labels.push(`Busca: ${text(filters.query)}`);
  if (filters.groups.length) {
    const names = filters.groups.map((value) => allRows.find((row) => fold(row.groupId) === fold(value))?.apoio || value);
    labels.push(`Grupos: ${[...new Set(names)].join(", ")}`);
  }
  if (filters.statuses.length) labels.push(`Status: ${filters.statuses.map((status) => BI_STATUS_LABELS[status]).join(", ")}`);
  if (filters.locations.length) labels.push(`Local: ${filters.locations.join(", ")}`);
  if (filters.providers.length) labels.push(`Prestador: ${filters.providers.map(value => value || "Não informado").join(", ")}`);
  if (filters.classes.length) labels.push(`Classe: ${filters.classes.map(value => value || "Não informada").join(", ")}`);
  if (filters.workshops.length) labels.push(`Oficina/ponto: ${filters.workshops.join(", ")}`);
  if (filters.scope !== "all") labels.push(`Escopo: ${filters.scope === "registered" ? "cadastradas" : "não cadastradas"}`);
  if (filters.start || filters.end) labels.push(`Entrada: ${filters.start || "início"} a ${filters.end || "hoje"}`);
  if (filters.ageBandKey) labels.push(`Faixa da fila: ${BI_AGE_BANDS.find(band => band.key === filters.ageBandKey)?.label} completos`);
  if (filters.ageMin || filters.ageMax) labels.push(`Idade aberta: ${filters.ageMin || "0"}–${filters.ageMax || "aberto"} dias`);
  if (filters.waitingOnly) labels.push("Somente fila");
  if (filters.overdueOnly) labels.push("Somente atrasadas");
  return labels;
}
