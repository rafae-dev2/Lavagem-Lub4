import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { BIModel, BIRow } from "./managementAnalytics";
import { parseTrackingDate } from "./maintenanceTracking";
import { resolveEquipmentImage, preloadEquipmentImages } from "./equipmentImages";
import {
  assertEquipmentReportImagesLoaded,
  drawEquipmentPdfImage,
} from "./equipmentReportImages";
import { downloadIllustratedExcel } from "./equipmentExcel";

export interface ManagementReportOptions {
  rows: BIRow[];
  model: BIModel;
  filters: string[];
  sourceUpdated: string | null;
  lastSynced: string | null;
  sourceError?: string | null;
}

type RGB = [number, number, number];
type RowRecord = Record<string, unknown>;

interface ReportSummary {
  total: number | null;
  open: number | null;
  waiting: number | null;
  inProgress: number | null;
  closed: number | null;
  overdue: number | null;
  fleets: number | null;
  meanWaitingDays: number | null;
  medianWaitingDays: number | null;
  p90WaitingDays: number | null;
  meanOpenDays: number | null;
  waitingWithDate: number | null;
  openWithDate: number | null;
  withForecast: number | null;
  invalidDates: number | null;
  closureDetected: number | null;
  meanObservedCycleDays: number | null;
}

const COLORS = {
  darkGreen: [20, 72, 47] as RGB,
  green: [31, 107, 69] as RGB,
  gold: [193, 145, 47] as RGB,
  goldLight: [250, 244, 224] as RGB,
  greenLight: [232, 244, 236] as RGB,
  glass: [248, 252, 249] as RGB,
  border: [196, 220, 202] as RGB,
  line: [201, 218, 205] as RGB,
  ink: [24, 52, 37] as RGB,
  muted: [72, 101, 84] as RGB,
  white: [255, 255, 255] as RGB,
  warning: [126, 76, 0] as RGB,
  warningFill: [255, 248, 225] as RGB,
  absence: [126, 42, 42] as RGB,
  absenceFill: [252, 237, 237] as RGB,
} as const;

const REPORT_TIME_ZONE = "America/Sao_Paulo";
const MARGIN_X = 6;
const FOOTER_H = 13;
const COMPACT_HEADER_H = 20;
const CONTENT_W = 285;
const TABLE_WIDTHS = [31, 33, 32, 30, 25, 31, 31, 72] as const;
const STALE_SOURCE_HOURS = 24;

function record(value: BIRow): RowRecord {
  return value as unknown as RowRecord;
}

function value(row: BIRow, key: string): unknown {
  return record(row)[key];
}

function text(valueToFormat: unknown, fallback = ""): string {
  if (valueToFormat === null || valueToFormat === undefined) return fallback;
  const result = String(valueToFormat);
  return result.trim() ? result : fallback;
}

function textPreserving(valueToFormat: unknown, fallback = ""): string {
  if (valueToFormat === null || valueToFormat === undefined) return fallback;
  const result = String(valueToFormat);
  return result.length ? result : fallback;
}

function numberOrNull(valueToFormat: unknown): number | null {
  if (typeof valueToFormat === "number")
    return Number.isFinite(valueToFormat) ? valueToFormat : null;
  if (typeof valueToFormat === "string" && valueToFormat.trim() !== "") {
    const parsed = Number(valueToFormat);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function booleanValue(valueToFormat: unknown): boolean {
  return valueToFormat === true || valueToFormat === "true" || valueToFormat === 1;
}

function isClosed(row: BIRow): boolean {
  return text(value(row, "statusKey")).toLowerCase() === "encerrado";
}

function isWaiting(row: BIRow): boolean {
  return ["aguardando", "programado"].includes(text(value(row, "statusKey")).toLowerCase()) && booleanValue(value(row, "ativo"));
}

function isInProgress(row: BIRow): boolean {
  return text(value(row, "statusKey")).toLowerCase() === "andamento";
}

function rowIsOpen(row: BIRow): boolean {
  return booleanValue(value(row, "ativo")) && !isClosed(row);
}

function localIsoDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return `${values.year || "1970"}-${values.month || "01"}-${values.day || "01"}`;
}

function parseDate(valueToFormat: unknown): Date | null {
  const raw = text(valueToFormat);
  if (!raw) return null;
  const parsed = parseTrackingDate(raw);
  return parsed ? new Date(parsed.timestamp) : null;
}

function formatDate(valueToFormat: unknown, withTime = true): string {
  const raw = text(valueToFormat);
  if (!raw) return "Não informado";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const parsed = parseDate(dateOnly ? `${raw}T12:00:00Z` : raw);
  if (!parsed) return `Data inconsistente (${raw})`;
  const options: Intl.DateTimeFormatOptions = dateOnly || !withTime
    ? { timeZone: REPORT_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }
    : {
        timeZone: REPORT_TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      };
  return new Intl.DateTimeFormat("pt-BR", options).format(parsed);
}

function sourceTime(valueToFormat: string | null | undefined): string {
  return text(valueToFormat) ? formatDate(valueToFormat, true) : "Não informado";
}

function formatNumber(valueToFormat: number | null, decimals = 1): string {
  if (valueToFormat === null || !Number.isFinite(valueToFormat)) return "Não calculado";
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(valueToFormat);
}

function integer(valueToFormat: number | null): string {
  if (valueToFormat === null || !Number.isFinite(valueToFormat)) return "Não calculado";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(valueToFormat);
}

function safeFilenamePart(valueToFormat: string, fallback: string): string {
  const normalized = valueToFormat
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLocaleLowerCase("en-US");
  return normalized.slice(0, 70) || fallback;
}

function filename(extension: "pdf" | "xlsx", now = new Date()): string {
  return `central-gerencial-${safeFilenamePart(localIsoDate(now), "snapshot")}.${extension}`;
}

function setText(
  doc: jsPDF,
  color: RGB,
  size: number,
  style: "normal" | "bold" | "italic" = "normal",
): void {
  doc.setTextColor(...color);
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
}

function sanitizeExcelCell(valueToFormat: unknown): unknown {
  if (typeof valueToFormat !== "string") return valueToFormat ?? "";
  // Excel interprets these leading characters as formulas. Keep the complete
  // source text visible while forcing a literal cell value.
  return /^[\t\r\n ]*[=+\-@]/.test(valueToFormat)
    ? `'${valueToFormat}`
    : valueToFormat;
}

function sanitizeRows(rows: Array<Array<unknown>>): Array<Array<unknown>> {
  return rows.map((row) => row.map((cell) => sanitizeExcelCell(cell)));
}

function sanitizeObject(object: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(object).map(([key, cell]) => [key, sanitizeExcelCell(cell)]),
  );
}

function modelSummary(model: BIModel): ReportSummary {
  const source = (model as unknown as { summary?: Partial<ReportSummary> }).summary || {};
  return {
    total: numberOrNull(source.total),
    open: numberOrNull(source.open),
    waiting: numberOrNull(source.waiting),
    inProgress: numberOrNull(source.inProgress),
    closed: numberOrNull(source.closed),
    overdue: numberOrNull(source.overdue),
    fleets: numberOrNull(source.fleets),
    meanWaitingDays: numberOrNull(source.meanWaitingDays),
    medianWaitingDays: numberOrNull(source.medianWaitingDays),
    p90WaitingDays: numberOrNull(source.p90WaitingDays),
    meanOpenDays: numberOrNull(source.meanOpenDays),
    waitingWithDate: numberOrNull(source.waitingWithDate),
    openWithDate: numberOrNull(source.openWithDate),
    withForecast: numberOrNull(source.withForecast),
    invalidDates: numberOrNull(source.invalidDates),
    closureDetected: numberOrNull(source.closureDetected),
    meanObservedCycleDays: numberOrNull(source.meanObservedCycleDays),
  };
}

function fallbackSummary(rows: BIRow[], summary: ReportSummary): ReportSummary {
  const waitingDays = rows
    .filter(isWaiting)
    .map((row) => numberOrNull(value(row, "waitingDays")))
    .filter((item): item is number => item !== null);
  const openDays = rows
    .filter(rowIsOpen)
    .map((row) => numberOrNull(value(row, "ageDays")))
    .filter((item): item is number => item !== null);
  const fleets = new Set(rows.map((row) => text(value(row, "frota"))).filter(Boolean));
  const count = (predicate: (row: BIRow) => boolean): number => rows.filter(predicate).length;
  const mean = (values: number[]): number | null =>
    values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : null;
  const invalidDates = rows.filter((row) => {
    const fields = ["openedDate", "entrada", "previsao", "closedDate", "closedDetectedAt"];
    return fields.some((field) => {
      const raw = value(row, field);
      return Boolean(text(raw)) && parseDate(raw) === null;
    });
  }).length;
  const forecastRows = rows.filter((row) => text(value(row, "previsao")));
  const detected = rows.filter((row) => text(value(row, "closedDetectedAt"))).length;
  return {
    total: summary.total ?? rows.length,
    open: summary.open ?? count(rowIsOpen),
    waiting: summary.waiting ?? count(isWaiting),
    inProgress: summary.inProgress ?? count(isInProgress),
    closed: summary.closed ?? count(isClosed),
    overdue: summary.overdue ?? count((row) => booleanValue(value(row, "forecastOverdue"))),
    fleets: summary.fleets ?? fleets.size,
    meanWaitingDays: summary.meanWaitingDays ?? mean(waitingDays),
    medianWaitingDays: summary.medianWaitingDays,
    p90WaitingDays: summary.p90WaitingDays,
    meanOpenDays: summary.meanOpenDays ?? mean(openDays),
    waitingWithDate: summary.waitingWithDate ?? waitingDays.length,
    openWithDate: summary.openWithDate ?? openDays.length,
    withForecast: summary.withForecast ?? forecastRows.length,
    invalidDates: summary.invalidDates ?? invalidDates,
    closureDetected: summary.closureDetected ?? detected,
    meanObservedCycleDays: summary.meanObservedCycleDays,
  };
}

function selectionScope(filters: string[]): string {
  const joined = filters.join(" ").toLocaleLowerCase("pt-BR");
  if (/\b(all|todos|todas)\b/.test(joined)) return "all";
  if (/\b(own|registered|cadastrad[oa]s?)\b/.test(joined)) return "registered";
  if (/\b(unregistered|não cadastrad[oa]s?)\b/.test(joined)) return "unregistered";
  return filters.length ? "filtros da seleção" : "all";
}

function metadataAlerts(
  options: ManagementReportOptions,
  generatedAt: Date,
): string[] {
  const alerts: string[] = [];
  const sourceDate = parseDate(options.sourceUpdated);
  if (!text(options.sourceUpdated)) {
    alerts.push("Alerta de metadados: atualização da fonte não informada.");
  } else if (!sourceDate) {
    alerts.push("Alerta de metadados: data de atualização da fonte inválida.");
  } else {
    const ageHours = (generatedAt.getTime() - sourceDate.getTime()) / 3600000;
    if (ageHours > STALE_SOURCE_HOURS) {
      alerts.push("Alerta: metadados da fonte possivelmente expirados (última atualização há mais de 24 horas).");
    } else if (ageHours < -1 / 60) {
      alerts.push("Alerta de metadados: atualização da fonte está no futuro em relação à emissão.");
    }
  }
  if (text(options.sourceError)) alerts.push(`Erro da fonte: ${textPreserving(options.sourceError)}`);
  return alerts;
}

function compactFilterSummary(filters: string[]): string {
  return filters.length ? filters.map((filter) => textPreserving(filter, "Filtro sem rótulo")).join(" | ") : "Sem filtros informados";
}

interface LogoResult {
  dataUrl: string | null;
  warning: string | null;
}

async function loadLogo(): Promise<LogoResult> {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof Image === "undefined"
  ) {
    return { dataUrl: null, warning: "ambiente do navegador indisponível para /logo.png" };
  }
  return new Promise<LogoResult>((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (result: LogoResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(result);
    };
    const timer = window.setTimeout(
      () => finish({ dataUrl: null, warning: "tempo limite ao carregar /logo.png" }),
      5000,
    );
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext("2d");
        if (!context || !canvas.width || !canvas.height) {
          finish({ dataUrl: null, warning: "canvas indisponível para converter /logo.png" });
          return;
        }
        context.drawImage(image, 0, 0);
        finish({ dataUrl: canvas.toDataURL("image/png"), warning: null });
      } catch {
        finish({ dataUrl: null, warning: "não foi possível converter /logo.png para o PDF" });
      }
    };
    image.onerror = () => finish({ dataUrl: null, warning: "arquivo /logo.png não pôde ser carregado" });
    image.src = "/logo.png";
  });
}

function drawFooter(doc: jsPDF, generatedAt: Date, page: number, total: number): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...COLORS.white);
  doc.rect(0, pageH - FOOTER_H, pageW, FOOTER_H, "F");
  doc.setDrawColor(...COLORS.green);
  doc.setLineWidth(0.35);
  doc.line(MARGIN_X, pageH - FOOTER_H, pageW - MARGIN_X, pageH - FOOTER_H);
  setText(doc, COLORS.green, 6.9, "bold");
  doc.text("BRANCO PERES AGRO - Central Gerencial", MARGIN_X, pageH - 4.3);
  setText(doc, COLORS.muted, 6.6);
  doc.text(`Emissão Brasília: ${formatDate(generatedAt.toISOString(), true)}`, pageW / 2, pageH - 4.3, { align: "center" });
  doc.text(`Página ${page}/${total}`, pageW - MARGIN_X, pageH - 4.3, { align: "right" });
}

function drawCompactHeader(doc: jsPDF): void {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLORS.darkGreen);
  doc.rect(0, 0, pageW, COMPACT_HEADER_H, "F");
  doc.setFillColor(...COLORS.green);
  doc.rect(0, 0, 2.2, COMPACT_HEADER_H, "F");
  doc.setFillColor(...COLORS.gold);
  doc.rect(2.2, COMPACT_HEADER_H - 1.1, pageW - 2.2, 1.1, "F");
  setText(doc, COLORS.white, 9.1, "bold");
  doc.text("BRANCO PERES AGRO", 7, 8.1);
  setText(doc, [218, 239, 225], 8.1);
  doc.text("Central Gerencial", 7, 15.2);
  setText(doc, [210, 247, 220], 6.8, "bold");
  doc.text("CONTINUAÇÃO", pageW - MARGIN_X, 8.1, { align: "right" });
}

function drawKpis(doc: jsPDF, summary: ReportSummary, y: number): number {
  const entries: Array<[string, string]> = [
    ["Total", integer(summary.total)],
    ["Em aberto", integer(summary.open)],
    ["Aguardando", integer(summary.waiting)],
    ["Andamento", integer(summary.inProgress)],
    ["Encerradas", integer(summary.closed)],
    ["Atrasadas", integer(summary.overdue)],
    ["Frotas", integer(summary.fleets)],
    ["Média idade fila (dias)", formatNumber(summary.meanWaitingDays)],
  ];
  const gap = 1.8;
  const boxW = (CONTENT_W - gap * (entries.length - 1)) / entries.length;
  const boxH = 16;
  entries.forEach(([label, valueToDraw], index) => {
    const x = MARGIN_X + index * (boxW + gap);
    doc.setFillColor(...(index === 0 ? COLORS.greenLight : COLORS.glass));
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, boxW, boxH, 1.2, 1.2, "FD");
    setText(doc, COLORS.green, 9.2, "bold");
    doc.text(valueToDraw, x + boxW / 2, y + 7, { align: "center" });
    setText(doc, COLORS.muted, 5.05, "bold");
    doc.text(label, x + boxW / 2, y + 12.5, { align: "center" });
  });
  return y + boxH;
}

function drawFirstPageHeader(
  doc: jsPDF,
  options: ManagementReportOptions,
  rows: BIRow[],
  summary: ReportSummary,
  logo: LogoResult,
  generatedAt: Date,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - MARGIN_X * 2;
  const alerts = metadataAlerts(options, generatedAt);
  doc.setFillColor(...COLORS.darkGreen);
  doc.rect(0, 0, pageW, 38, "F");
  doc.setFillColor(...COLORS.green);
  doc.rect(0, 0, 2.2, 38, "F");
  doc.setFillColor(...COLORS.gold);
  doc.rect(2.2, 36.6, pageW - 2.2, 1.4, "F");

  let left = 8;
  if (logo.dataUrl) {
    doc.addImage(logo.dataUrl, "PNG", 8, 5, 19, 19);
    left = 31;
  }
  setText(doc, COLORS.white, 11.3, "bold");
  doc.text("BRANCO PERES AGRO", left, 12);
  setText(doc, [224, 241, 229], 7.3);
  doc.text("Fonte gerencial - snapshot analítico", left, 19);
  setText(doc, [211, 255, 224], 13.1, "bold");
  doc.text("Central Gerencial", left, 32);
  setText(doc, COLORS.white, 7.6, "bold");
  doc.text("RELATÓRIO", pageW - MARGIN_X, 11, { align: "right" });
  setText(doc, [228, 239, 233], 6.8);
  doc.text(`Emitido em ${formatDate(generatedAt.toISOString(), true)}`, pageW - MARGIN_X, 18, { align: "right" });
  doc.text(`${rows.length} ${rows.length === 1 ? "linha" : "linhas"}`, pageW - MARGIN_X, 25, { align: "right" });

  let y = 44;
  setText(doc, COLORS.green, 8.8, "bold");
  doc.text("Resumo do snapshot", MARGIN_X, y);
  y += 4.5;
  setText(doc, COLORS.muted, 6.9);
  doc.text(`Fonte atualizada: ${sourceTime(options.sourceUpdated)}`, MARGIN_X, y);
  doc.text(`Última sincronização: ${sourceTime(options.lastSynced)}`, pageW - MARGIN_X, y, { align: "right" });
  y += 5;

  setText(doc, COLORS.muted, 6.4);
  const filterLines = doc.splitTextToSize(`Filtros: ${compactFilterSummary(options.filters)}`, contentW);
  doc.text(filterLines, MARGIN_X, y);
  y += Math.max(5, filterLines.length * 3.05) + 2;

  const alertText = alerts.length
    ? alerts.join(" ")
    : "Sem alerta de fonte informado. Os dados abaixo representam o snapshot recebido.";
  const alertLines = doc.splitTextToSize(alertText, contentW - 7);
  const alertH = Math.max(10, alertLines.length * 3.1 + 5);
  doc.setFillColor(...(alerts.length ? COLORS.warningFill : COLORS.greenLight));
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN_X, y, contentW, alertH, 1.2, 1.2, "FD");
  setText(doc, alerts.length ? COLORS.warning : COLORS.green, 6.7, "bold");
  doc.text(alertLines, MARGIN_X + 3, y + 4.1);
  y += alertH + 4;

  y = drawKpis(doc, summary, y) + 4;
  setText(doc, COLORS.green, 7.8, "bold");
  doc.text("Quantidade e qualidade da base", MARGIN_X, y);
  y += 3.5;
  setText(doc, COLORS.muted, 6.15);
  const quality = [
    `Linhas válidas do snapshot: ${integer(rows.length)}`,
    `Fila com idade válida: ${integer(summary.waitingWithDate)} | Abertas com idade válida: ${integer(summary.openWithDate)} | Com previsão: ${integer(summary.withForecast)}`,
    `Datas inválidas ou ausentes em campos avaliados: ${integer(summary.invalidDates)} | Encerramentos detectados: ${integer(summary.closureDetected)}`,
    `Mediana idade fila: ${formatNumber(summary.medianWaitingDays)} dias | P90 idade fila: ${formatNumber(summary.p90WaitingDays)} dias | Média ciclo observado: ${formatNumber(summary.meanObservedCycleDays)} dias (não é duração real do reparo)`,
    "MTTR e data de conclusão real: não calculados; a fonte não traz início de execução e status encerrado sem detecção não recebe data inventada.",
  ];
  const qualityLines = quality.flatMap((line) => doc.splitTextToSize(line, contentW));
  doc.text(qualityLines, MARGIN_X, y);
  y += Math.max(15, qualityLines.length * 3.0) + 3;
  setText(doc, COLORS.green, 7.8, "bold");
  doc.text("Ordens completas da seleção", MARGIN_X, y);
  return y + 3;
}

function statusDisplay(row: BIRow): string {
  const statusName = text(value(row, "statusName"), "Status não informado");
  const statusKey = text(value(row, "statusKey"), "outros");
  const rawStatus = text(value(row, "status"), "Não informado");
  const flags: string[] = [`BI: ${statusKey}`, `Bruto: ${rawStatus}`];
  if (booleanValue(value(row, "forecastOverdue"))) flags.push("Previsão atrasada");
  return `${statusName}\n${flags.join("\n")}`;
}

function groupDisplay(row: BIRow): string {
  const group = text(value(row, "apoio"), text(value(row, "grupo_fonte"), "Grupo sem informação"));
  const groupId = text(value(row, "groupId"), "ID não informado");
  const registered = booleanValue(value(row, "registered"));
  const sourceGroup = text(value(row, "grupo_fonte"));
  const sourceLine = sourceGroup && sourceGroup !== group ? `Fonte: ${sourceGroup}` : "";
  return [group, `ID: ${groupId}`, registered ? "Cadastro: registrado" : "Cadastro: não registrado", sourceLine]
    .filter(Boolean)
    .join("\n");
}

function datesDisplay(row: BIRow): string {
  return [
    `Entrada: ${formatDate(value(row, "entrada") || value(row, "openedDate"), true)}`,
    `Previsão: ${formatDate(value(row, "previsao"), true)}`,
  ].join("\n");
}

function ageDisplay(row: BIRow): string {
  const age = numberOrNull(value(row, "ageDays"));
  const waiting = numberOrNull(value(row, "waitingDays"));
  const observed = numberOrNull(value(row, "observedCycleDays"));
  const late = numberOrNull(value(row, "forecastDaysLate"));
  return [
    `Idade aberta: ${formatNumber(age)} d`,
    `Idade da fila: ${formatNumber(waiting)} d`,
    `Ciclo observado: ${formatNumber(observed)} d`,
    `Atraso previsão: ${formatNumber(late)} d`,
  ].join("\n");
}

function closureDisplay(row: BIRow): string {
  const closureType = text(value(row, "closureType"), "Não informado");
  const closedDate = value(row, "closedDate");
  const detectedAt = value(row, "closedDetectedAt");
  return [
    `Tipo: ${closureType}`,
    `Encerramento: ${formatDate(closedDate, true)}`,
    `Detecção: ${formatDate(detectedAt, true)}`,
    `Última presença: ${formatDate(value(row, "ultima_vista"), true)}`,
  ].join("\n");
}

function flagsDisplay(row: BIRow): string {
  const registered = booleanValue(value(row, "registered"));
  const active = booleanValue(value(row, "ativo"));
  const scope = registered ? "registered" : "unregistered";
  return [
    `Escopo: ${scope}`,
    `Ativo na fonte: ${active ? "SIM" : "NÃO"}`,
    `Frota: ${text(value(row, "frota"), "Sem frota")}`,
    `OS: ${text(value(row, "os"), "Não informada")}`,
  ].join("\n");
}

function narrativeDisplay(row: BIRow): string {
  return [
    `Equipamento: ${textPreserving(value(row, "equipamento"), "Não informado")}`,
    `Modelo: ${textPreserving(value(row, "modelo"), "Não informado")}`,
    `Narrativa: ${textPreserving(value(row, "narrativa"), "Não informada")}`,
    `Motivo: ${textPreserving(value(row, "motivo"), "Não informado")}`,
    `Classe: ${textPreserving(value(row, "classe"), "Não informada")}`,
    `Classificação: ${textPreserving(value(row, "classificationReason"), "Não informada")}`,
    `Evidência: ${textPreserving(value(row, "ultima_vista"), "Última presença não informada")}`,
  ].join("\n");
}

function pdfRow(row: BIRow): string[] {
  return [
    `${text(value(row, "frota"), "Sem frota informada")}\nOS ${text(value(row, "os"), "Não informada")}`,
    groupDisplay(row),
    statusDisplay(row),
    datesDisplay(row),
    ageDisplay(row),
    closureDisplay(row),
    flagsDisplay(row),
    narrativeDisplay(row),
  ];
}

function drawFinalFooters(doc: jsPDF, generatedAt: Date): void {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    drawFooter(doc, generatedAt, page, total);
  }
}

async function buildManagementPdf(options: ManagementReportOptions): Promise<jsPDF> {
  const rows = Array.isArray(options.rows) ? options.rows : [];
  const generatedAt = new Date();
  const summary = fallbackSummary(rows, modelSummary(options.model));
  const equipmentImages = await preloadEquipmentImages(rows);
  assertEquipmentReportImagesLoaded(rows, equipmentImages);
  const logo = await loadLogo();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  let startY = drawFirstPageHeader(doc, options, rows, summary, logo, generatedAt);
  if (startY > pageH - FOOTER_H - 24) {
    doc.addPage();
    drawCompactHeader(doc);
    startY = COMPACT_HEADER_H + 4;
  }

  const drawnEquipmentRows = new Set<number>();
  autoTable(doc, {
    startY,
    margin: { left: MARGIN_X, right: MARGIN_X, top: COMPACT_HEADER_H + 3, bottom: FOOTER_H + 1 },
    tableWidth: CONTENT_W,
    theme: "grid",
    pageBreak: "auto",
    rowPageBreak: "auto",
    showHead: "everyPage",
    head: [[
      "Frota / OS",
      "Grupo / cadastro",
      "Status BI / bruto",
      "Entrada / previsão",
      "Idade e espera",
      "Encerramento / detecção",
      "Escopo / flags",
      "Narrativa e evidências completas",
    ]],
    body: rows.map(pdfRow),
    styles: {
      font: "helvetica",
      fontSize: 6.15,
      cellPadding: { top: 1.25, right: 1.05, bottom: 1.25, left: 1.05 },
      overflow: "linebreak",
      valign: "top",
      textColor: COLORS.ink,
      lineColor: COLORS.line,
      lineWidth: 0.18,
    },
    headStyles: {
      fillColor: COLORS.darkGreen,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 6.35,
      minCellHeight: 7.5,
      valign: "middle",
    },
    alternateRowStyles: { fillColor: [248, 250, 248] as RGB },
    columnStyles: {
      0: { cellWidth: TABLE_WIDTHS[0] },
      1: { cellWidth: TABLE_WIDTHS[1] },
      2: { cellWidth: TABLE_WIDTHS[2] },
      3: { cellWidth: TABLE_WIDTHS[3] },
      4: { cellWidth: TABLE_WIDTHS[4] },
      5: { cellWidth: TABLE_WIDTHS[5] },
      6: { cellWidth: TABLE_WIDTHS[6] },
      7: { cellWidth: TABLE_WIDTHS[7] },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const row = rows[data.row.index];
      const resolvedEquipment = row ? resolveEquipmentImage(row) : null;
      const hasEquipmentImage = Boolean(
        resolvedEquipment && equipmentImages.has(resolvedEquipment.key),
      );
      if (data.column.index === 7 && hasEquipmentImage) {
        data.cell.styles.cellPadding = {
          top: 1.25,
          right: 1.05,
          bottom: 1.25,
          left: 16,
        };
        data.cell.styles.minCellHeight = 14;
      }
      if (data.column.index === 2) {
        const raw = String(data.cell.raw || "");
        if (raw.includes("Previsão atrasada")) {
          data.cell.styles.textColor = COLORS.warning;
          data.cell.styles.fontStyle = "bold";
        }
      }
      if (data.column.index === 6 && String(data.cell.raw || "").includes("Ativo na fonte: NÃO")) {
        data.cell.styles.textColor = COLORS.absence;
        data.cell.styles.fillColor = COLORS.absenceFill;
      }
    },
    didDrawCell: (data) => {
      if (
        data.section !== "body" ||
        data.column.index !== 7 ||
        data.cell.height < 13.8 ||
        drawnEquipmentRows.has(data.row.index)
      ) {
        return;
      }
      const row = rows[data.row.index];
      if (!row) return;
      if (
        drawEquipmentPdfImage(
          doc,
          row,
          equipmentImages,
          data.cell.x + 1.05,
          data.cell.y + 1.25,
          12,
          9,
        )
      ) {
        drawnEquipmentRows.add(data.row.index);
      }
    },
    willDrawPage: (pageData) => {
      if (pageData.pageNumber > 1) drawCompactHeader(doc);
    },
  });

  if (!rows.length) {
    setText(doc, COLORS.muted, 8.5);
    doc.text("Nenhuma linha classificada para este snapshot.", MARGIN_X, startY + 7);
  }
  drawFinalFooters(doc, generatedAt);
  return doc;
}

function summaryRows(
  options: ManagementReportOptions,
  rows: BIRow[],
  summary: ReportSummary,
  generatedAt: Date,
): Array<[string, unknown]> {
  const alerts = metadataAlerts(options, generatedAt);
  const scope = selectionScope(Array.isArray(options.filters) ? options.filters : []);
  const result: Array<[string, unknown]> = [
    ["Relatório", "Central Gerencial"],
    ["Empresa", "BRANCO PERES AGRO"],
    ["Emitido em (Brasília)", formatDate(generatedAt.toISOString(), true)],
    ["Emitido em (ISO UTC)", generatedAt.toISOString()],
    ["Fonte atualizada (Brasília)", sourceTime(options.sourceUpdated)],
    ["Última sincronização (Brasília)", sourceTime(options.lastSynced)],
    ["Escopo do snapshot", scope],
    ["Linhas válidas exportadas", rows.length],
    ["Total", summary.total],
    ["Em aberto", summary.open],
    ["Aguardando", summary.waiting],
    ["Em andamento", summary.inProgress],
    ["Encerradas", summary.closed],
    ["Atrasadas", summary.overdue],
    ["Frotas distintas", summary.fleets],
    ["Média idade fila (dias)", summary.meanWaitingDays],
    ["Mediana idade fila (dias)", summary.medianWaitingDays],
    ["P90 idade fila (dias)", summary.p90WaitingDays],
    ["Média idade aberta (dias)", summary.meanOpenDays],
    ["Fila com idade válida", summary.waitingWithDate],
    ["Abertas com idade válida", summary.openWithDate],
    ["Com previsão", summary.withForecast],
    ["Datas inválidas", summary.invalidDates],
    ["Encerramentos detectados", summary.closureDetected],
    ["Média ciclo observado (dias; não reparo real)", summary.meanObservedCycleDays],
    ["MTTR / conclusão real", "Não calculado pela fonte"],
    ["Filtros", compactFilterSummary(options.filters)],
    ["Alertas", alerts.length ? alerts.join(" | ") : "Nenhum alerta informado"],
    ["Nota de fonte", "Exportação de snapshot; não é ledger histórico completo."],
  ];
  const filters = Array.isArray(options.filters) && options.filters.length
    ? options.filters
    : ["Sem filtros informados"];
  filters.forEach((filter, index) => result.push([`Filtro ${index + 1}`, filter]));
  return result;
}

function excelRow(row: BIRow): Record<string, unknown> {
  const statusKey = text(value(row, "statusKey"), "outros");
  const statusName = text(value(row, "statusName"), "Não informado");
  const registered = booleanValue(value(row, "registered"));
  const active = booleanValue(value(row, "ativo"));
  return {
    Chave: textPreserving(value(row, "chave")),
    OS: textPreserving(value(row, "os")),
    Frota: textPreserving(value(row, "frota")),
    Equipamento: textPreserving(value(row, "equipamento")),
    Modelo: textPreserving(value(row, "modelo")),
    Grupo: textPreserving(value(row, "apoio"), text(value(row, "grupo_fonte"), "Grupo sem informação")),
    "ID grupo": textPreserving(value(row, "groupId")),
    Cadastro: registered ? "registered" : "unregistered",
    "Grupo fonte": textPreserving(value(row, "grupo_fonte")),
    Setor: textPreserving(value(row, "setor")),
    Ponto: textPreserving(value(row, "ponto")),
    Origem: textPreserving(value(row, "origem")),
    Prestador: textPreserving(value(row, "prestador")),
    "Status BI": statusKey,
    "Nome status": statusName,
    "Status bruto": textPreserving(value(row, "status")),
    "Atrasada previsão": booleanValue(value(row, "forecastOverdue")) ? "SIM" : "NÃO",
    "Ativo na fonte": active ? "SIM" : "NÃO",
    Entrada: textPreserving(value(row, "entrada") || value(row, "openedDate")),
    Previsão: textPreserving(value(row, "previsao")),
    "Idade aberta dias": numberOrNull(value(row, "ageDays")),
    "Idade fila dias": numberOrNull(value(row, "waitingDays")),
    "Ciclo observado dias": numberOrNull(value(row, "observedCycleDays")),
    "Dias atraso previsão": numberOrNull(value(row, "forecastDaysLate")),
    "Tipo encerramento": textPreserving(value(row, "closureType")),
    "Data encerramento": textPreserving(value(row, "closedDate")),
    "Data detecção encerramento": textPreserving(value(row, "closedDetectedAt")),
    "Última presença": textPreserving(value(row, "ultima_vista")),
    Narrativa: textPreserving(value(row, "narrativa")),
    Motivo: textPreserving(value(row, "motivo")),
    Classe: textPreserving(value(row, "classe")),
    "Critério classificação": textPreserving(value(row, "classificationReason")),
    "Evidência grupo": registered
      ? "Grupo associado ao cadastro; ID preservado."
      : "Grupo identificado na fonte; não cadastrado.",
    "Evidência fechamento": textPreserving(value(row, "closedDetectedAt"))
      ? "Detecção preservada; não afirma conclusão real."
      : "Sem data de detecção válida.",
  };
}

function configureWidths(sheet: XLSX.WorkSheet, max = 46): void {
  const range = sheet["!ref"]
    ? XLSX.utils.decode_range(sheet["!ref"])
    : { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
  const widths: XLSX.ColInfo[] = [];
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    let width = 12;
    for (let row = range.s.r; row <= Math.min(range.e.r, 100); row += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ c: column, r: row })];
      width = Math.max(width, Math.min(max, String(cell?.v ?? "").length + 2));
    }
    widths.push({ wch: width });
  }
  sheet["!cols"] = widths;
}

function styleSheetTitle(sheet: XLSX.WorkSheet, row: number, fill: string, color: string): void {
  const range = sheet["!ref"]
    ? XLSX.utils.decode_range(sheet["!ref"])
    : { s: { c: 0, r: 0 }, e: { c: 1, r: 0 } };
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const address = XLSX.utils.encode_cell({ c: column, r: row - 1 });
    if (!sheet[address]) sheet[address] = { t: "s", v: "" };
    sheet[address].s = {
      fill: { patternType: "solid", fgColor: { rgb: fill } },
      font: { bold: true, color: { rgb: color } },
    };
  }
}

function styleTableHeader(sheet: XLSX.WorkSheet, row = 0): void {
  const range = sheet["!ref"]
    ? XLSX.utils.decode_range(sheet["!ref"])
    : { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const address = XLSX.utils.encode_cell({ c: column, r: row });
    if (!sheet[address]) continue;
    sheet[address].s = {
      fill: { patternType: "solid", fgColor: { rgb: "146B45" } },
      font: { bold: true, color: { rgb: "FFFFFF" } },
    };
  }
}

function buildIndicatorsSheet(
  options: ManagementReportOptions,
  rows: BIRow[],
  summary: ReportSummary,
  generatedAt: Date,
): XLSX.WorkSheet {
  const values: Array<[unknown, unknown]> = [
    ["BRANCO PERES AGRO", ""],
    ["Central Gerencial", "Indicadores do snapshot"],
    ["", ""],
    ["Campo", "Valor"],
    ...summaryRows(options, rows, summary, generatedAt),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(sanitizeRows(values));
  configureWidths(sheet, 110);
  styleSheetTitle(sheet, 1, "14482F", "FFFFFF");
  styleSheetTitle(sheet, 2, "C1912F", "14382F");
  styleTableHeader(sheet, 3);
  return sheet;
}

function buildOrdersSheet(rows: BIRow[]): XLSX.WorkSheet {
  const values = rows.map((row) => sanitizeObject(excelRow(row)));
  const fallback = excelRow(({
    chave: "",
    os: "",
    frota: "",
    equipamento: "",
    modelo: "",
    apoio: "",
    grupo_fonte: "",
    groupId: "",
    registered: false,
    setor: "",
    ponto: "",
    origem: "",
    prestador: "",
    status: "",
    statusKey: "outros",
    statusName: "",
    forecastOverdue: false,
    ativo: true,
    entrada: "",
    openedDate: "",
    previsao: "",
    ageDays: null,
    waitingDays: null,
    observedCycleDays: null,
    forecastDaysLate: null,
    closureType: null,
    closedDate: null,
    closedDetectedAt: null,
    ultima_vista: "",
    narrativa: "",
    motivo: "",
    classe: "",
    classificationReason: "",
  } as unknown as BIRow));
  const headers = Object.keys(fallback);
  const sheet = XLSX.utils.json_to_sheet(values, { header: headers });
  configureWidths(sheet);
  styleTableHeader(sheet, 0);
  if (sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] };
  return sheet;
}

function buildMethodologySheet(options: ManagementReportOptions, rows: BIRow[]): XLSX.WorkSheet {
  const scope = selectionScope(Array.isArray(options.filters) ? options.filters : []);
  const values: Array<[unknown, unknown]> = [
    ["BRANCO PERES AGRO", ""],
    ["Central Gerencial", "Metodologia e evidências"],
    ["", ""],
    ["Item", "Descrição"],
    ["Fonte", "Snapshot recebido do analytics; este relatório não consulta banco, não executa SQL e não altera dados."],
    ["Escopo", `${scope}; a planilha Ordens contém todas as ${rows.length} linhas válidas recebidas na seleção.`],
    ["Cadastro", "registered identifica grupo/equipamento associado ao cadastro; unregistered identifica grupo preservado somente da fonte."],
    ["Fila", "Idade da fila é Entrada até agora para ordens abertas; não representa tempo líquido de execução."],
    ["Encerradas", "Ciclo observado é Entrada até última presença válida; encerramento derivado traz detecção e não confirma duração real."],
    ["Datas", "Datas ausentes, inválidas ou futuras não são inventadas; permanecem em branco ou na qualidade da base."],
    ["Atraso", "forecastOverdue/forecastDaysLate descrevem atraso em relação à previsão, sem transformar isso em conclusão."],
    ["Qualidade", "Indicadores informam denominadores e contagens disponíveis; valores nulos aparecem como não calculados."],
    ["Privacidade", "Não são exportadas linhas desabilitadas, comentários de origem ou conteúdo fora do snapshot selecionado."],
    ["Segurança", "Textos iniciados por =, +, -, @, tab ou CR/LF recebem apóstrofo para não executar fórmulas no Excel."],
    ["Data de emissão", formatDate(new Date().toISOString(), true)],
    ["Filtros", compactFilterSummary(options.filters)],
    ["Fonte atualizada", sourceTime(options.sourceUpdated)],
    ["Última sincronização", sourceTime(options.lastSynced)],
    ["Erro da fonte", textPreserving(options.sourceError, "Nenhum erro informado")],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(sanitizeRows(values));
  configureWidths(sheet, 120);
  styleSheetTitle(sheet, 1, "14482F", "FFFFFF");
  styleSheetTitle(sheet, 2, "C1912F", "14382F");
  styleTableHeader(sheet, 3);
  return sheet;
}

export async function exportManagementPDF(options: ManagementReportOptions): Promise<void> {
  const safeOptions: ManagementReportOptions = {
    ...options,
    rows: Array.isArray(options.rows) ? options.rows : [],
    filters: Array.isArray(options.filters) ? options.filters : [],
  };
  const doc = await buildManagementPdf(safeOptions);
  await doc.save(filename("pdf"), { returnPromise: true });
}

export async function exportManagementExcel(options: ManagementReportOptions): Promise<void> {
  const rows = Array.isArray(options.rows) ? options.rows : [];
  const equipmentImages = await preloadEquipmentImages(rows);
  assertEquipmentReportImagesLoaded(rows, equipmentImages);
  const generatedAt = new Date();
  const summary = fallbackSummary(rows, modelSummary(options.model));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildIndicatorsSheet(options, rows, summary, generatedAt), "Indicadores");
  XLSX.utils.book_append_sheet(workbook, buildOrdersSheet(rows), "Ordens");
  XLSX.utils.book_append_sheet(workbook, buildMethodologySheet(options, rows), "Metodologia");
  await downloadIllustratedExcel(workbook, rows, filename("xlsx", generatedAt));
}

/** Exportada para testes de contrato sem acionar o download do PDF. */
export { buildManagementPdf as buildManagementPDF };
