import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type {
  TrackingCounts,
  TrackingModule,
  TrackingRow,
} from "./maintenanceTracking";
import {
  getTrackingCounts,
  parseTrackingDate,
  trackingClosedAt,
  trackingClosureLabel,
  trackingClosureOrigin,
  TRACKING_TITLES,
} from "./maintenanceTracking";
import { oficinaLabel } from "../types/apoio";
import { resolveEquipmentImage, preloadEquipmentImages } from "./equipmentImages";
import {
  assertEquipmentReportImagesLoaded,
  drawEquipmentPdfImage,
} from "./equipmentReportImages";
import { downloadIllustratedExcel } from "./equipmentExcel";

export interface TrackingReportOptions {
  rows: TrackingRow[];
  module: TrackingModule;
  filters: string[];
  sourceUpdated: string | null;
  lastSynced: string | null;
  sourceError?: string | null;
}

type RGB = [number, number, number];

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

const MARGIN_X = 6;
const FOOTER_H = 13;
const COMPACT_HEADER_H = 20;
const CONTENT_W = 285;
// A4 landscape content width: 42 + 45 + 31 + 34 + 25 + 25 + 83 = 285 mm.
const TABLE_WIDTHS = [42, 45, 31, 34, 25, 25, 83] as const;
const REPORT_TIME_ZONE = "America/Sao_Paulo";

function text(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function localIsoDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts)
    if (part.type !== "literal") values[part.type] = part.value;
  return `${values.year || "1970"}-${values.month || "01"}-${values.day || "01"}`;
}

function safeFilenamePart(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLocaleLowerCase("en-US");
  return normalized.slice(0, 70) || fallback;
}

function filename(
  extension: "pdf" | "xlsx",
  options: TrackingReportOptions,
  now = new Date(),
): string {
  const module = safeFilenamePart(
    TRACKING_TITLES[options.module] || options.module,
    "manutencao",
  );
  return `gestao-ordens-manutencao-${module}-${localIsoDate(now)}.${extension}`;
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

function formatDate(value: string | null | undefined, withTime = true): string {
  const raw = text(value);
  if (!raw) return "—";
  const parsed = parseTrackingDate(raw);
  if (!parsed) return `Data inconsistente (${raw})`;
  const date = new Date(parsed.timestamp);
  const options: Intl.DateTimeFormatOptions =
    parsed.dateOnly || !withTime
      ? {
          timeZone: REPORT_TIME_ZONE,
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }
      : {
          timeZone: REPORT_TIME_ZONE,
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        };
  return new Intl.DateTimeFormat("pt-BR", options).format(date);
}

function sourceTime(value: string | null | undefined): string {
  return text(value) ? formatDate(value, true) : "Não informado";
}

function displayStatus(row: TrackingRow): string {
  const parts = [trackingClosureLabel(row)];
  if (row.overdue) parts.push("Atrasado");
  const closureOrigin = trackingClosureOrigin(row);
  const closedAt = trackingClosedAt(row);
  if (closureOrigin === "ausencia") {
    parts.push("origem: ausencia");
    if (closedAt) parts.push(`detecção: ${formatDate(closedAt, true)}`);
  } else if (closureOrigin === "fonte") {
    parts.push("origem: fonte");
    if (!row.ativo && closedAt)
      parts.push(`saída detectada: ${formatDate(closedAt, true)}`);
  } else if (!row.ativo) {
    parts.push("Ausente da fonte; status não conclusivo");
  }
  if (
    text(row.status) &&
    text(row.status).toLocaleLowerCase("pt-BR") !==
      trackingClosureLabel(row).toLocaleLowerCase("pt-BR")
  ) {
    parts.push(`Fonte: ${text(row.status)}`);
  }
  return parts.join(" · ");
}

function providerAndLocation(row: TrackingRow): string {
  const location = oficinaLabel(text(row.origem));
  const provider = text(row.prestador);
  return provider ? `${location} / ${provider}` : location;
}

function warningLines(
  options: TrackingReportOptions,
  logoWarning: string | null,
): string[] {
  const warnings = [
    "Encerramento operacional por saída da fonte; data detectada não confirma execução real.",
  ];
  if (text(options.sourceError)) {
    const sourceError = text(options.sourceError);
    warnings.push(
      `Atualização da fonte pendente: ${sourceError.slice(0, 420)}${sourceError.length > 420 ? "…" : ""}. Consulte o aplicativo antes de decidir.`,
    );
  }
  if (logoWarning) warnings.push(`Logotipo não carregado: ${logoWarning}`);
  return warnings;
}

function compactFilterSummary(filters: string[]): string {
  if (!filters.length) return "Sem filtros informados";
  const visible = filters.slice(0, 8).map((filter) => {
    const value = text(filter, "Filtro sem rótulo");
    return value.length > 150 ? `${value.slice(0, 150)}…` : value;
  });
  if (filters.length > visible.length)
    visible.push(`+${filters.length - visible.length} filtro(s) no Excel`);
  return visible.join(" · ");
}

function drawFooter(doc: jsPDF, page: number, total: number): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...COLORS.white);
  doc.rect(0, pageH - FOOTER_H, pageW, FOOTER_H, "F");
  doc.setDrawColor(...COLORS.green);
  doc.setLineWidth(0.35);
  doc.line(MARGIN_X, pageH - FOOTER_H, pageW - MARGIN_X, pageH - FOOTER_H);
  setText(doc, COLORS.green, 7.1, "bold");
  doc.text("BRANCO PERES AGRO", MARGIN_X, pageH - 4.3);
  setText(doc, COLORS.muted, 6.9);
  doc.text("Gestão de Ordens de Manutenção", pageW / 2, pageH - 4.3, {
    align: "center",
  });
  doc.text(`Página ${page}/${total}`, pageW - MARGIN_X, pageH - 4.3, {
    align: "right",
  });
}

function drawCompactHeader(doc: jsPDF, moduleTitle: string): void {
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
  doc.text(moduleTitle, 7, 15.2);
  setText(doc, [210, 247, 220], 6.8, "bold");
  doc.text("CONTINUAÇÃO", pageW - MARGIN_X, 8.1, { align: "right" });
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
    return {
      dataUrl: null,
      warning: "ambiente do navegador indisponível para /logo.png",
    };
  }
  return new Promise<LogoResult>((resolve) => {
    const image = new Image();
    let settled = false;
    const timer = window.setTimeout(
      () =>
        finish({
          dataUrl: null,
          warning: "tempo limite ao carregar /logo.png",
        }),
      5000,
    );
    const finish = (result: LogoResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(result);
    };
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext("2d");
        if (!context || !canvas.width || !canvas.height) {
          finish({
            dataUrl: null,
            warning: "canvas indisponível para converter /logo.png",
          });
          return;
        }
        context.drawImage(image, 0, 0);
        finish({ dataUrl: canvas.toDataURL("image/png"), warning: null });
      } catch {
        finish({
          dataUrl: null,
          warning: "não foi possível converter /logo.png para o PDF",
        });
      }
    };
    image.onerror = () =>
      finish({
        dataUrl: null,
        warning: "arquivo /logo.png não pôde ser carregado",
      });
    image.src = "/logo.png";
  });
}

function drawMetricBoxes(
  doc: jsPDF,
  counts: TrackingCounts,
  y: number,
): number {
  const entries: Array<[string, number]> = [
    ["Total", counts.total],
    ["Programado", counts.programado],
    ["Andamento", counts.andamento],
    ["Encerrado", counts.encerrado],
    ["Ausente", counts.ausente],
    ["Outros", counts.outros],
    ["Atrasado", counts.atrasado],
    ["Frotas", counts.frotas],
  ];
  const gap = 1.8;
  const boxW = (CONTENT_W - gap * (entries.length - 1)) / entries.length;
  const boxH = 16;
  entries.forEach(([label, value], index) => {
    const x = MARGIN_X + index * (boxW + gap);
    doc.setFillColor(...(index === 0 ? COLORS.greenLight : COLORS.glass));
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, boxW, boxH, 1.2, 1.2, "FD");
    setText(doc, COLORS.green, 10.4, "bold");
    doc.text(String(value), x + boxW / 2, y + 7, { align: "center" });
    setText(doc, COLORS.muted, 5.3, "bold");
    doc.text(label, x + boxW / 2, y + 12.5, { align: "center" });
  });
  return y + boxH;
}

function drawFirstPageHeader(
  doc: jsPDF,
  options: TrackingReportOptions,
  rows: TrackingRow[],
  counts: TrackingCounts,
  logo: LogoResult,
  generatedAt: Date,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - MARGIN_X * 2;
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
  doc.text("Gestão de Ordens de Manutenção", left, 19);
  setText(doc, [211, 255, 224], 13.1, "bold");
  doc.text(TRACKING_TITLES[options.module], left, 32);
  setText(doc, COLORS.white, 7.6, "bold");
  doc.text("RELATÓRIO", pageW - MARGIN_X, 11, { align: "right" });
  setText(doc, [228, 239, 233], 6.8);
  doc.text(
    `Gerado em ${formatDate(generatedAt.toISOString(), true)}`,
    pageW - MARGIN_X,
    18,
    { align: "right" },
  );
  doc.text(
    `${rows.length} ${rows.length === 1 ? "ordem" : "ordens"}`,
    pageW - MARGIN_X,
    25,
    { align: "right" },
  );

  let y = 44;
  setText(doc, COLORS.green, 8.8, "bold");
  doc.text("Resumo operacional", MARGIN_X, y);
  y += 4.5;
  setText(doc, COLORS.muted, 6.9);
  doc.text(
    `Fonte atualizada: ${sourceTime(options.sourceUpdated)}`,
    MARGIN_X,
    y,
  );
  doc.text(
    `Última sincronização: ${sourceTime(options.lastSynced)}`,
    pageW - MARGIN_X,
    y,
    { align: "right" },
  );
  y += 5;

  setText(doc, COLORS.muted, 6.6);
  const filterText = `Filtros: ${compactFilterSummary(options.filters)}`;
  const filterLines = doc.splitTextToSize(filterText, contentW);
  doc.text(filterLines, MARGIN_X, y);
  y += Math.max(5, filterLines.length * 3.1) + 2;

  const warnings = warningLines(options, logo.warning);
  const warningText = warnings.join(" ");
  const warningLinesWrapped = doc.splitTextToSize(warningText, contentW - 7);
  const warningH = Math.max(10, warningLinesWrapped.length * 3.1 + 5);
  doc.setFillColor(...COLORS.warningFill);
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN_X, y, contentW, warningH, 1.2, 1.2, "FD");
  setText(doc, COLORS.warning, 6.7, "bold");
  doc.text(warningLinesWrapped, MARGIN_X + 3, y + 4.1);
  y += warningH + 4;

  y = drawMetricBoxes(doc, counts, y);
  return y + 5;
}

function pdfRow(row: TrackingRow): string[] {
  const equipmentGroup = [
    text(row.equipamento, "Equipamento não informado"),
    text(row.apoio, "Apoio não informado"),
    text(row.grupo_fonte) && text(row.grupo_fonte) !== text(row.apoio)
      ? `Fonte: ${text(row.grupo_fonte)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const service = [
    `Narrativa: ${text(row.narrativa, "Não informada")}`,
    `Motivo: ${text(row.motivo, "Não informado")}`,
    `Classe: ${text(row.classe, "Não informada")}`,
    `Critério: ${text(row.classificationReason, "Não informado")}`,
  ].join("\n");
  return [
    `${text(row.frota, "Sem frota informada")}\nOS ${text(row.os, "—")}`,
    equipmentGroup,
    displayStatus(row),
    providerAndLocation(row),
    formatDate(row.entrada, true),
    formatDate(row.previsao, true),
    service,
  ];
}

function drawFinalFooters(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    drawFooter(doc, page, total);
  }
}

async function buildTrackingPdf(
  options: TrackingReportOptions,
): Promise<jsPDF> {
  const rows = Array.isArray(options.rows) ? options.rows : [];
  const counts = getTrackingCounts(rows);
  const generatedAt = new Date();
  const equipmentImages = await preloadEquipmentImages(rows);
  assertEquipmentReportImagesLoaded(rows, equipmentImages);
  const logo = await loadLogo();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  let startY = drawFirstPageHeader(
    doc,
    options,
    rows,
    counts,
    logo,
    generatedAt,
  );
  if (startY > pageH - FOOTER_H - 27) {
    doc.addPage();
    drawCompactHeader(doc, TRACKING_TITLES[options.module]);
    startY = COMPACT_HEADER_H + 4;
  }

  const drawnEquipmentRows = new Set<number>();
  autoTable(doc, {
    startY,
    margin: {
      left: MARGIN_X,
      right: MARGIN_X,
      top: COMPACT_HEADER_H + 3,
      bottom: FOOTER_H + 1,
    },
    tableWidth: CONTENT_W,
    theme: "grid",
    pageBreak: "auto",
    rowPageBreak: "avoid",
    showHead: "everyPage",
    head: [
      [
        "Frota / OS",
        "Equipamento / grupo",
        "Situação",
        "Local / prestador",
        "Entrada",
        "Previsão",
        "Serviço — narrativa, motivo, classe e critério",
      ],
    ],
    body: rows.map(pdfRow),
    styles: {
      font: "helvetica",
      fontSize: 7.2,
      cellPadding: { top: 1.45, right: 1.25, bottom: 1.45, left: 1.25 },
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
      fontSize: 7.3,
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
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const row = rows[data.row.index];
      const resolvedEquipment = row ? resolveEquipmentImage(row) : null;
      const hasEquipmentImage = Boolean(
        resolvedEquipment && equipmentImages.has(resolvedEquipment.key),
      );
      if (data.column.index === 1 && hasEquipmentImage) {
        data.cell.styles.cellPadding = {
          top: 1.45,
          right: 1.25,
          bottom: 1.45,
          left: 16,
        };
        data.cell.styles.minCellHeight = 14;
      }
      if (data.column.index === 2) {
        const raw = String(data.cell.raw || "");
        if (raw.includes("Ausente") || raw.includes("saída da fonte")) {
          data.cell.styles.textColor = COLORS.absence;
          data.cell.styles.fillColor = COLORS.absenceFill;
          data.cell.styles.fontStyle = "bold";
        } else if (raw.includes("Atrasado")) {
          data.cell.styles.textColor = COLORS.warning;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    didDrawCell: (data) => {
      if (
        data.section !== "body" ||
        data.column.index !== 1 ||
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
          data.cell.x + 1.25,
          data.cell.y + 1.45,
          12,
          9,
        )
      ) {
        drawnEquipmentRows.add(data.row.index);
      }
    },
    willDrawPage: (pageData) => {
      if (pageData.pageNumber > 1)
        drawCompactHeader(doc, TRACKING_TITLES[options.module]);
    },
  });

  if (!rows.length) {
    setText(doc, COLORS.muted, 8.5);
    doc.text(
      "Nenhuma ordem classificada para este módulo.",
      MARGIN_X,
      startY + 7,
    );
  }
  drawFinalFooters(doc);
  return doc;
}

function sanitizeExcelCell(value: unknown): unknown {
  if (typeof value !== "string") return value ?? "";
  // Excel treats these leading characters as formulas. Prefixing an apostrophe
  // keeps the literal source value visible while preventing formula execution.
  return /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function excelRow(row: TrackingRow): Record<string, unknown> {
  const raw: Record<string, unknown> = {
    Chave: row.chave,
    OS: row.os,
    Frota: row.frota,
    Equipamento: row.equipamento,
    Modelo: row.modelo,
    Apoio: row.apoio,
    "Grupo fonte": row.grupo_fonte,
    Setor: row.setor,
    Ponto: row.ponto,
    Origem: row.origem,
    Prestador: row.prestador,
    "Status fonte": row.status,
    "Status rastreamento": row.trackingStatus,
    "Status exibido": displayStatus(row),
    "Origem encerramento": trackingClosureOrigin(row) || "",
    "Data detecção encerramento": trackingClosedAt(row) || "",
    Atrasado: row.overdue ? "SIM" : "NÃO",
    Entrada: row.entrada,
    Previsão: row.previsao,
    Narrativa: row.narrativa,
    Motivo: row.motivo,
    Classe: row.classe,
    "Código ponto": row.cd_ponto,
    "Razão da classificação": row.classificationReason,
    Ativo: row.ativo ? "SIM" : "NÃO",
    "Primeira vista": row.primeira_vista,
    "Última vista": row.ultima_vista,
    "Ausente desde": row.ausente_desde,
  };
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, sanitizeExcelCell(value)]),
  );
}

function summaryRows(
  options: TrackingReportOptions,
  counts: TrackingCounts,
  generatedAt: Date,
): Array<[string, unknown]> {
  const rows: Array<[string, unknown]> = [
    ["Relatório", "Gestão de Ordens de Manutenção"],
    ["Módulo", TRACKING_TITLES[options.module]],
    ["Gerado em (Brasília)", formatDate(generatedAt.toISOString(), true)],
    ["Gerado em (ISO UTC)", generatedAt.toISOString()],
    ["Fonte atualizada (Brasília)", sourceTime(options.sourceUpdated)],
    ["Última sincronização (Brasília)", sourceTime(options.lastSynced)],
    [
      "Fonte atualizada (ISO original)",
      options.sourceUpdated || "Não informado",
    ],
    [
      "Última sincronização (ISO original)",
      options.lastSynced || "Não informado",
    ],
    ["Total", counts.total],
    ["Programado", counts.programado],
    ["Andamento", counts.andamento],
    ["Encerrado", counts.encerrado],
    ["Ausente", counts.ausente],
    ["Outros", counts.outros],
    ["Atrasado", counts.atrasado],
    ["Frotas distintas", counts.frotas],
  ];
  const filters = Array.isArray(options.filters) && options.filters.length
    ? options.filters
    : ["Sem filtros informados"];
  filters.forEach((filter, index) =>
    rows.push([`Filtro ${index + 1}`, filter]),
  );
  rows.push([
    "Advertência",
    "Encerramento operacional por saída da fonte; data detectada não confirma execução real.",
  ]);
  if (text(options.sourceError))
    rows.push(["Erro da fonte", options.sourceError]);
  return rows;
}

function configureWidths(sheet: XLSX.WorkSheet, max = 42): void {
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

function styleExcelBranding(
  sheet: XLSX.WorkSheet,
  rows: Array<{ row: number; fill: string; color: string }>,
): void {
  const range = sheet["!ref"]
    ? XLSX.utils.decode_range(sheet["!ref"])
    : { s: { c: 0, r: 0 }, e: { c: 1, r: 0 } };
  rows.forEach(({ row, fill, color }) => {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ c: column, r: row - 1 });
      if (!sheet[address]) sheet[address] = { t: "s", v: "" };
      sheet[address].s = {
        fill: { patternType: "solid", fgColor: { rgb: fill } },
        font: { bold: true, color: { rgb: color } },
      };
    }
  });
}

function styleExcelDetailHeader(sheet: XLSX.WorkSheet): void {
  const range = sheet["!ref"]
    ? XLSX.utils.decode_range(sheet["!ref"])
    : { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const address = XLSX.utils.encode_cell({ c: column, r: range.s.r });
    if (!sheet[address]) continue;
    sheet[address].s = {
      fill: { patternType: "solid", fgColor: { rgb: "146B45" } },
      font: { bold: true, color: { rgb: "FFFFFF" } },
    };
  }
}

export async function exportTrackingPDF(
  options: TrackingReportOptions,
): Promise<void> {
  const doc = await buildTrackingPdf({
    ...options,
    rows: Array.isArray(options.rows) ? options.rows : [],
    filters: Array.isArray(options.filters) ? options.filters : [],
  });
  await doc.save(filename("pdf", options), { returnPromise: true });
}

export async function exportTrackingExcel(
  options: TrackingReportOptions,
): Promise<void> {
  const rows = Array.isArray(options.rows) ? options.rows : [];
  const equipmentImages = await preloadEquipmentImages(rows);
  assertEquipmentReportImagesLoaded(rows, equipmentImages);
  const counts = getTrackingCounts(rows);
  const generatedAt = new Date();
  const workbook = XLSX.utils.book_new();

  const summaryValues: Array<[unknown, unknown]> = [
    ["BRANCO PERES AGRO", ""],
    ["Gestão de Ordens de Manutenção", TRACKING_TITLES[options.module]],
    ["", ""],
    ["Campo", "Valor"],
    ...summaryRows(options, counts, generatedAt),
  ];
  const summary = XLSX.utils.aoa_to_sheet(
    summaryValues.map((row) => row.map((value) => sanitizeExcelCell(value))),
  );
  configureWidths(summary, 110);
  styleExcelBranding(summary, [
    { row: 1, fill: "14482F", color: "FFFFFF" },
    { row: 2, fill: "C1912F", color: "14382F" },
    { row: 4, fill: "1F6B45", color: "FFFFFF" },
  ]);
  XLSX.utils.book_append_sheet(workbook, summary, "Resumo");

  const detailHeaders = Object.keys(
    excelRow(
      rows[0] ||
        ({
          chave: "",
          os: "",
          frota: "",
          modelo: "",
          grupo_fonte: "",
          setor: "",
          ponto: "",
          origem: "",
          prestador: "",
          status: "",
          entrada: "",
          previsao: "",
          narrativa: "",
          ativo: true,
          primeira_vista: "",
          ultima_vista: "",
          ausente_desde: null,
          classe: "",
          motivo: "",
          cd_ponto: "",
          apoio: "",
          equipamento: "",
          trackingStatus: "outros",
          classificationReason: "",
          overdue: false,
          closureOrigin: null,
          closedDetectedAt: null,
        } as TrackingRow),
    ),
  );
  const details = XLSX.utils.json_to_sheet(
    rows.length ? rows.map(excelRow) : [],
    { header: detailHeaders },
  );
  configureWidths(details);
  styleExcelDetailHeader(details);
  if (details["!ref"]) details["!autofilter"] = { ref: details["!ref"] };
  XLSX.utils.book_append_sheet(workbook, details, "Ordens");

  await downloadIllustratedExcel(
    workbook,
    rows,
    filename("xlsx", options, generatedAt),
  );
}

/** Exportada para testes de contrato sem acionar download. */
export { buildTrackingPdf as buildTrackingPDF };
