import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  type ApoioReportOptions,
  type ApoioReportRow,
} from '../types/apoio';
import {
  reportDate,
  reportDays,
  reportEquipment,
  reportFleet,
  reportGroups,
  reportLocation,
  reportProvider,
} from './apoioReportData';
import { getMaintenanceOrderClosure } from './maintenanceTracking';
import { resolveEquipmentImage, preloadEquipmentImages } from './equipmentImages';
import {
  assertEquipmentReportImagesLoaded,
  drawEquipmentPdfImage,
} from './equipmentReportImages';
import { downloadIllustratedExcel } from './equipmentExcel';
import { createLogoWatermarkDataUrl, type WatermarkAsset } from './reportWatermark';
import { isEmergencyOrder } from './tvOrders';

type RGB = [number, number, number];
type GroupedRows = ReturnType<typeof reportGroups>[number];

type PDFLogo = {
  dataUrl: string | null;
  warning: string | null;
};
type PDFBackdrop = { dataUrl: string | null };

const COLORS = {
  darkGreen: [14, 55, 35] as RGB,
  green: [26, 92, 59] as RGB,
  greenMedium: [46, 139, 87] as RGB,
  emeraldBright: [52, 211, 153] as RGB,
  greenLight: [232, 244, 236] as RGB,
  glass: [248, 252, 249] as RGB,
  glassBorder: [198, 224, 208] as RGB,
  ink: [21, 40, 29] as RGB,
  muted: [72, 101, 84] as RGB,
  line: [194, 219, 201] as RGB,
  white: [255, 255, 255] as RGB,
  warning: [146, 64, 14] as RGB,
  warningFill: [255, 247, 237] as RGB,
  absence: [126, 42, 42] as RGB,
  absenceFill: [252, 237, 237] as RGB,
};

const PDF_MARGIN_X = 6;
const PDF_FOOTER_H = 14;
const PDF_HEADER_H = 27;
const PDF_TABLE_WIDTH_MM = 285;
const PDF_COLUMN_WIDTHS = [43, 22, 24, 23, 42, 44, 87] as const;

function text(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function reportDisplayText(value: unknown, fallback = ''): string {
  return text(value, fallback)
    .replace(/não constam mais na fonte/gi, 'ausentes da listagem')
    .replace(/ausentes na fonte/gi, 'ausentes na listagem')
    .replace(/\bfonte\b/gi, 'listagem');
}

function reportRawStatus(row: ApoioReportRow): string {
  return text(row.status, 'Não informado');
}

/** Estado operacional para relatórios; o status bruto permanece explícito. */
function reportOperationalStatus(row: ApoioReportRow): string {
  const closure = getMaintenanceOrderClosure(row);
  const raw = reportRawStatus(row);
  if (closure.status === 'encerrado') {
    const origin = closure.origin === 'ausencia' ? 'ausência validada' : 'status da fonte';
    const detected = closure.detectedAt ? reportDate(closure.detectedAt, false) : 'não informada';
    return `Encerrada\nOrigem: ${origin}\nData de detecção: ${detected}\nExecução: não inferida\nStatus bruto: ${raw}`;
  }
  if (closure.status === 'ausente') {
    return `Outros · Sem confirmação\nÚltima presença: ${reportDate(row.ultima_vista, false)}\nStatus bruto: ${raw}`;
  }
  const label = closure.status === 'programado' ? 'Programada' : closure.status === 'andamento' ? 'Em andamento' : 'Outros';
  return `${label}\nStatus bruto: ${raw}`;
}

function getOperationalReportKpis(rows: ApoioReportRow[]): { label: string; value: number }[] {
  const fleets = new Set(rows.map(row => reportFleet(row)).filter(fleet => fleet !== 'Sem frota informada'));
  return [
    { label: 'Frotas distintas', value: fleets.size },
    { label: 'Ordens filtradas', value: rows.length },
    { label: 'Internas', value: rows.filter(row => reportLocation(row) === 'Oficina Interna').length },
    { label: 'Externas', value: rows.filter(row => reportLocation(row) === 'Oficina Externa').length },
    { label: 'Andamento', value: rows.filter(row => getMaintenanceOrderClosure(row).status === 'andamento').length },
    { label: 'Programadas', value: rows.filter(row => getMaintenanceOrderClosure(row).status === 'programado').length },
    { label: 'Encerradas', value: rows.filter(row => getMaintenanceOrderClosure(row).status === 'encerrado').length },
  ];
}

function safeFilenamePart(value: string, fallback: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLocaleLowerCase('en-US');
  return normalized.slice(0, 70) || fallback;
}

function reportFilename(extension: 'pdf' | 'xlsx', options: ApoioReportOptions, now = new Date()): string {
  const view = safeFilenamePart(reportDisplayText(options.view, 'apoio'), 'apoio');
  if (extension === 'pdf') {
    return `controle-equipamentos-apoio-${view}-${localIsoDate(now)}.${extension}`;
  }
  const filters = options.filtersExcel?.length
    ? safeFilenamePart(reportDisplayText(options.filtersExcel.join('-')), 'filtros')
    : options.filters?.length
      ? safeFilenamePart(reportDisplayText(options.filters.join('-')), 'filtros')
      : 'sem-filtros';
  return `controle-equipamentos-apoio-${view}-${filters}-${localIsoDate(now)}.${extension}`;
}

function getCurrentPage(doc: jsPDF): number {
  return doc.getCurrentPageInfo().pageNumber;
}

function setPdfText(doc: jsPDF, color: RGB, size: number, style: 'normal' | 'bold' | 'italic' = 'normal') {
  doc.setTextColor(...color);
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
}

function createPdfBackdrop(): PDFBackdrop {
  if (typeof document === 'undefined') return { dataUrl: null };
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 260;
    const context = canvas.getContext('2d');
    if (!context) return { dataUrl: null };

    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#14482F');
    gradient.addColorStop(0.48, '#1F6B45');
    gradient.addColorStop(1, '#2E8B57');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const previousFilter = context.filter;
    context.filter = 'blur(48px)';
    context.globalCompositeOperation = 'screen';
    const glow = (x: number, y: number, radius: number, color: string) => {
      context.fillStyle = color;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    };
    glow(canvas.width * 0.82, canvas.height * 0.12, 170, 'rgba(255,255,255,.20)');
    glow(canvas.width * 0.58, canvas.height * 0.95, 150, 'rgba(177,235,201,.22)');
    glow(canvas.width * 0.16, canvas.height * 0.18, 105, 'rgba(255,255,255,.12)');
    context.filter = previousFilter;
    context.globalCompositeOperation = 'source-over';
    context.strokeStyle = 'rgba(255,255,255,.14)';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(canvas.width * 0.89, canvas.height * 0.28, 120, 0.15, Math.PI * 1.2);
    context.stroke();
    return { dataUrl: canvas.toDataURL('image/png') };
  } catch {
    return { dataUrl: null };
  }
}

function drawFooterLine(doc: jsPDF): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...COLORS.greenMedium);
  doc.setLineWidth(0.45);
  doc.line(PDF_MARGIN_X, pageH - PDF_FOOTER_H + 1, pageW - PDF_MARGIN_X, pageH - PDF_FOOTER_H + 1);
}

function drawFooter(doc: jsPDF, page: number, total: number): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...COLORS.white);
  doc.rect(0, pageH - PDF_FOOTER_H + 1.2, pageW, PDF_FOOTER_H - 1.2, 'F');
  drawFooterLine(doc);
  setPdfText(doc, COLORS.green, 7.2, 'bold');
  doc.text('BRANCO PERES AGRO', PDF_MARGIN_X, pageH - 4.2);
  setPdfText(doc, COLORS.muted, 7, 'normal');
  doc.text('Controle de Equipamentos — Apoio', pageW / 2, pageH - 4.2, { align: 'center' });
  doc.text(`Página ${page}/${total}`, pageW - PDF_MARGIN_X, pageH - 4.2, { align: 'right' });
}

function drawPageWatermark(doc: jsPDF, watermark: WatermarkAsset): void {
  if (!watermark.dataUrl) return;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const sizeMm = 112;
  const x = (pageW - sizeMm) / 2;
  const y = (pageH - sizeMm) / 2 + 6;
  doc.addImage(watermark.dataUrl, 'PNG', x, y, sizeMm, sizeMm);
}

function drawCompactHeader(doc: jsPDF, logo: PDFLogo, backdrop: PDFBackdrop): void {
  const pageW = doc.internal.pageSize.getWidth();
  if (backdrop.dataUrl) {
    doc.addImage(backdrop.dataUrl, 'PNG', 0, 0, pageW, PDF_HEADER_H);
  } else {
    doc.setFillColor(...COLORS.darkGreen);
    doc.rect(0, 0, pageW, PDF_HEADER_H, 'F');
  }
  doc.setFillColor(...COLORS.emeraldBright);
  doc.rect(0, 0, pageW, 1.1, 'F');
  doc.rect(0, 0, 2.4, PDF_HEADER_H, 'F');

  let left = 7;
  if (logo.dataUrl) {
    doc.addImage(logo.dataUrl, 'PNG', 7, 4.2, 18, 18);
    left = 29;
  }
  setPdfText(doc, COLORS.white, 10.5, 'bold');
  doc.text('BRANCO PERES AGRO', left, 10.8);
  setPdfText(doc, [225, 235, 229], 8.3, 'normal');
  doc.text('Controle de Equipamentos — Apoio', left, 18.4);
  setPdfText(doc, [190, 246, 207], 7.2, 'bold');
  doc.text('RELATÓRIO EXECUTIVO', pageW - PDF_MARGIN_X, 10.8, { align: 'right' });
}

function drawFirstPageHeader(
  doc: jsPDF,
  options: ApoioReportOptions,
  rows: ApoioReportRow[],
  logo: PDFLogo,
  backdrop: PDFBackdrop,
  watermark: WatermarkAsset,
  generatedAt: Date,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - PDF_MARGIN_X * 2;
  drawPageWatermark(doc, watermark);

  if (backdrop.dataUrl) {
    doc.addImage(backdrop.dataUrl, 'PNG', 0, 0, pageW, 43);
  } else {
    doc.setFillColor(...COLORS.darkGreen);
    doc.rect(0, 0, pageW, 43, 'F');
  }
  doc.setFillColor(...COLORS.emeraldBright);
  doc.rect(0, 0, pageW, 1.3, 'F');
  doc.rect(0, 0, 2.6, 43, 'F');

  let left = 8;
  if (logo.dataUrl) {
    doc.addImage(logo.dataUrl, 'PNG', 8, 6.2, 21, 21);
    left = 34;
  }
  setPdfText(doc, COLORS.white, 12.5, 'bold');
  doc.text('BRANCO PERES AGRO', left, 13);
  setPdfText(doc, [226, 239, 231], 8, 'normal');
  doc.text('Controle de Equipamentos — Apoio', left, 20.5);
  const pdfHeading = text(options.reportTitle, 'CONTROLE DE EQUIPAMENTOS').toLocaleUpperCase('pt-BR');
  setPdfText(doc, [211, 255, 224], pdfHeading.length > 32 ? 12 : 16, 'bold');
  doc.text(pdfHeading, left, 34.5);
  setPdfText(doc, COLORS.emeraldBright, 8.2, 'bold');
  doc.text('APOIO · MANUTENÇÃO', pageW - PDF_MARGIN_X, 12, { align: 'right' });
  setPdfText(doc, [228, 239, 233], 7.3, 'normal');
  doc.text(`Gerado em ${reportDate(generatedAt.toISOString(), true)}`, pageW - PDF_MARGIN_X, 20, { align: 'right' });
  doc.text(`${rows.length} ${rows.length === 1 ? 'ordem selecionada' : 'ordens selecionadas'}`, pageW - PDF_MARGIN_X, 27, {
    align: 'right',
  });

  let y = 49;
  const headerPageLimit = pageH - PDF_FOOTER_H - 24;
  const continueHeader = () => {
    doc.addPage();
    drawPageWatermark(doc, watermark);
    drawCompactHeader(doc, logo, backdrop);
    y = PDF_HEADER_H + 5;
    setPdfText(doc, COLORS.green, 8.2, 'bold');
    doc.text('Resumo operacional — continuação', PDF_MARGIN_X, y);
    y += 5;
  };
  const ensureHeaderSpace = (height: number) => {
    if (y + height > headerPageLimit) continueHeader();
  };
  setPdfText(doc, COLORS.green, 9.2, 'bold');
  doc.text('Resumo operacional', PDF_MARGIN_X, y);
  y += 4.5;

  const activeFilters = (options.filters ?? []).map((item) => reportDisplayText(item)).filter(Boolean);
  const filterLine = activeFilters.length ? activeFilters.join('  ·  ') : 'Visão operacional completa da seleção';
  setPdfText(doc, COLORS.muted, 7.5, 'normal');
  const wrappedFilters = doc.splitTextToSize(filterLine, contentW - 44);
  doc.text(wrappedFilters[0] ?? filterLine, PDF_MARGIN_X, y);
  doc.text(`Ordens selecionadas: ${rows.length}`, pageW - PDF_MARGIN_X, y, { align: 'right' });
  y += 5.5;

  const hasClosedRows = rows.some((row) => getMaintenanceOrderClosure(row).status === 'encerrado');
  const hasUnconfirmedRows = rows.some((row) => getMaintenanceOrderClosure(row).status === 'ausente');
  if (hasClosedRows || hasUnconfirmedRows) {
    y += 1.5;
    const historyNote = [
      hasClosedRows ? 'Encerradas: estado operacional confirmado; data exibida é de detecção e execução não é inferida.' : '',
      hasUnconfirmedRows ? 'Ausências sem prova permanecem “Outros · Sem confirmação”.' : '',
    ].filter(Boolean).join(' ');
    const noteLines = doc.splitTextToSize(historyNote, contentW - 8);
    const noteH = Math.max(9, noteLines.length * 3.8 + 4);
    ensureHeaderSpace(noteH);
    doc.setFillColor(...COLORS.greenLight);
    doc.setDrawColor(...COLORS.glassBorder);
    doc.setLineWidth(0.35);
    doc.roundedRect(PDF_MARGIN_X, y, contentW, noteH, 1.5, 1.5, 'FD');
    setPdfText(doc, COLORS.green, 7.3, 'bold');
    doc.text(noteLines, PDF_MARGIN_X + 3, y + 4.8);
    y += noteH + 2;
  }

  const warnings: string[] = [];
  if (text(options.sourceError)) warnings.push('Atualização pendente: consulte o aplicativo antes de tomar decisões.');
  if (logo.warning) warnings.push(`Atenção — logotipo: ${logo.warning}`);
  if (warnings.length) {
    y += 1.5;
    let warningLines = warnings.flatMap((warning) => doc.splitTextToSize(warning, contentW - 8));
    while (warningLines.length) {
      ensureHeaderSpace(9);
      const availableLines = Math.max(1, Math.floor((headerPageLimit - y - 4) / 3.8));
      const chunk = warningLines.splice(0, availableLines);
      const warningH = Math.max(9, chunk.length * 3.8 + 4);
      doc.setFillColor(...COLORS.warningFill);
      doc.setDrawColor(...COLORS.greenMedium);
      doc.setLineWidth(0.35);
      doc.roundedRect(PDF_MARGIN_X, y, contentW, warningH, 1.5, 1.5, 'FD');
      setPdfText(doc, COLORS.warning, 7.3, 'bold');
      doc.text(chunk, PDF_MARGIN_X + 3, y + 4.8);
      y += warningH + 3;
    }
  } else {
    y += 2;
  }

  const kpis = getOperationalReportKpis(rows);
  const gap = 2.2;
  const boxW = (contentW - gap * (kpis.length - 1)) / kpis.length;
  const boxH = 18.5;
  ensureHeaderSpace(boxH + 7);
  kpis.forEach((kpi, index) => {
    const x = PDF_MARGIN_X + index * (boxW + gap);
    doc.setFillColor(...(index === 0 ? COLORS.greenLight : COLORS.glass));
    doc.setDrawColor(...COLORS.glassBorder);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, boxW, boxH, 1.6, 1.6, 'FD');
    doc.setFillColor(...(index === 3 ? [180, 83, 9] as RGB : COLORS.greenMedium));
    doc.rect(x + 0.5, y, boxW - 1, 1.3, 'F');
    setPdfText(doc, COLORS.green, 13, 'bold');
    doc.text(String(kpi.value), x + boxW / 2, y + 8.6, { align: 'center' });
    setPdfText(doc, COLORS.muted, 6.3, 'bold');
    doc.text(doc.splitTextToSize(kpi.label, boxW - 3), x + boxW / 2, y + 14.4, { align: 'center' });
  });
  y += boxH + 7;

  return y;
}

async function loadLogoForPdf(): Promise<PDFLogo> {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof Image === 'undefined') {
    return { dataUrl: null, warning: 'ambiente do navegador indisponível para carregar /logo.png' };
  }

  return new Promise<PDFLogo>((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext('2d');
        if (!context || !canvas.width || !canvas.height) {
          resolve({ dataUrl: null, warning: 'canvas indisponível para converter /logo.png' });
          return;
        }
        context.drawImage(image, 0, 0);
        resolve({ dataUrl: canvas.toDataURL('image/png'), warning: null });
      } catch {
        resolve({ dataUrl: null, warning: 'não foi possível converter /logo.png para o PDF' });
      }
    };
    image.onerror = () => resolve({ dataUrl: null, warning: 'arquivo /logo.png não pôde ser carregado' });
    // Same-origin asset: do not set crossOrigin, so a valid local logo remains usable.
    image.src = '/logo.png';
  });
}

function drawGroupHeading(doc: jsPDF, group: GroupedRows, y: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  const width = pageW - PDF_MARGIN_X * 2;
  const height = 7.5;
  doc.setFillColor(...COLORS.green);
  doc.roundedRect(PDF_MARGIN_X, y, width, height, 1.2, 1.2, 'F');
  setPdfText(doc, COLORS.white, 8.2, 'bold');
  doc.text(`Apoio: ${group.apoio}  /  ${group.location}`, PDF_MARGIN_X + 3, y + 5.1);
  setPdfText(doc, [226, 239, 231], 7.1, 'normal');
  doc.text(`${group.rows.length} ${group.rows.length === 1 ? 'registro' : 'registros'}`, pageW - PDF_MARGIN_X - 3, y + 5.1, {
    align: 'right',
  });
  return y + height + 2;
}

function pdfRow(row: ApoioReportRow, now: Date) {
  return {
    fleet: `${reportFleet(row)}\n${reportEquipment(row)}`,
    os: text(row.os, '—'),
    entrada: reportDate(row.entrada, false),
    dias: reportDays(row, now),
        status: reportOperationalStatus(row),
    local: reportProvider(row),
    narrativa: text(row.narrativa, '—'),
  };
}

function drawFinalFooters(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    drawFooter(doc, page, total);
  }
}

async function buildPdf(options: ApoioReportOptions): Promise<jsPDF> {
  const rows = Array.isArray(options.rows) ? options.rows : [];
  const generatedAt = new Date();
  const equipmentImages = await preloadEquipmentImages(rows);
  assertEquipmentReportImagesLoaded(rows, equipmentImages);
  const [logo, watermark] = await Promise.all([
    loadLogoForPdf(),
    createLogoWatermarkDataUrl('/logo.png', {
      alpha: 0.055,
      size: 520,
      withFrameRings: true,
      ringColor: 'rgba(20, 72, 47, 0.08)',
    }),
  ]);
  const backdrop = createPdfBackdrop();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  let firstContentY = drawFirstPageHeader(doc, options, rows, logo, backdrop, watermark, generatedAt);
  const minimumTableSpace = 24;
  if (firstContentY > pageH - PDF_FOOTER_H - minimumTableSpace) {
    doc.addPage();
    drawPageWatermark(doc, watermark);
    drawCompactHeader(doc, logo, backdrop);
    firstContentY = PDF_HEADER_H + 5;
  }

  const groups = reportGroups(rows, options.preserveRowOrder);
  let cursorY = firstContentY;
  const now = new Date();
  groups.forEach((group, groupIndex) => {
    const currentPage = getCurrentPage(doc);
    if (cursorY > pageH - PDF_FOOTER_H - 19) {
      doc.addPage();
      drawPageWatermark(doc, watermark);
      drawCompactHeader(doc, logo, backdrop);
      cursorY = PDF_HEADER_H + 5;
    } else if (groupIndex > 0 && currentPage !== getCurrentPage(doc)) {
      cursorY = PDF_HEADER_H + 5;
    }

    cursorY = drawGroupHeading(doc, group, cursorY);
    const drawnEquipmentRows = new Set<number>();
    autoTable(doc, {
      startY: cursorY,
      margin: { left: PDF_MARGIN_X, right: PDF_MARGIN_X, top: PDF_HEADER_H + 14, bottom: PDF_FOOTER_H + 1 },
      theme: 'grid',
      pageBreak: 'auto',
      rowPageBreak: 'avoid',
      showHead: 'everyPage',
      tableWidth: PDF_TABLE_WIDTH_MM,
      head: [[
        'Frota / equipamento',
        'OS',
        'Entrada',
        'Dias observados',
        'Status',
        'Local / prestador',
        'Narrativa',
      ]],
      body: group.rows.map((row) => {
        const value = pdfRow(row, now);
        return [value.fleet, value.os, value.entrada, value.dias, value.status, value.local, value.narrativa];
      }),
      styles: {
        font: 'helvetica',
        fontSize: 7.7,
        cellPadding: { top: 1.7, right: 1.5, bottom: 1.7, left: 1.5 },
        overflow: 'linebreak',
        valign: 'top',
        textColor: COLORS.ink,
        lineColor: COLORS.line,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: COLORS.darkGreen,
        textColor: COLORS.white,
        fontStyle: 'bold',
        fontSize: 7.6,
        halign: 'left',
        valign: 'middle',
        minCellHeight: 7,
      },
      alternateRowStyles: { fillColor: [244, 250, 246] as RGB },
      columnStyles: {
        0: { cellWidth: PDF_COLUMN_WIDTHS[0] },
        1: { cellWidth: PDF_COLUMN_WIDTHS[1] },
        2: { cellWidth: PDF_COLUMN_WIDTHS[2] },
        3: { cellWidth: PDF_COLUMN_WIDTHS[3], halign: 'center' },
        4: { cellWidth: PDF_COLUMN_WIDTHS[4] },
        5: { cellWidth: PDF_COLUMN_WIDTHS[5] },
        6: { cellWidth: PDF_COLUMN_WIDTHS[6] },
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const row = group.rows[data.row.index];
        const emergency = row ? isEmergencyOrder(row) : false;
        const resolvedEquipment = row ? resolveEquipmentImage(row) : null;
        const hasEquipmentImage = Boolean(
          resolvedEquipment && equipmentImages.has(resolvedEquipment.key),
        );
        if (data.column.index === 0 && hasEquipmentImage) {
          data.cell.styles.cellPadding = {
            top: 1.7,
            right: 1.5,
            bottom: 1.7,
            left: 16,
          };
          data.cell.styles.minCellHeight = 14;
        }
        if (emergency && (data.column.index === 4 || data.column.index === 5)) {
          data.cell.styles.textColor = COLORS.warning;
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 3 && data.cell.raw && String(data.cell.raw).startsWith('Verificar data')) {
          data.cell.styles.textColor = COLORS.warning;
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 4 && data.cell.raw && String(data.cell.raw).startsWith('Encerrada')) {
          data.cell.styles.textColor = COLORS.green;
          data.cell.styles.fillColor = COLORS.greenLight;
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 4 && data.cell.raw && String(data.cell.raw).includes('Sem confirmação')) {
          data.cell.styles.textColor = COLORS.absence;
          data.cell.styles.fillColor = COLORS.absenceFill;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawCell: (data) => {
        if (
          data.section !== 'body' ||
          data.column.index !== 0 ||
          data.cell.height < 13.8 ||
          drawnEquipmentRows.has(data.row.index)
        ) {
          return;
        }
        const row = group.rows[data.row.index];
        if (!row) return;
        if (
          drawEquipmentPdfImage(
            doc,
            row,
            equipmentImages,
            data.cell.x + 1.5,
            data.cell.y + 1.7,
            12,
            9,
          )
        ) {
          drawnEquipmentRows.add(data.row.index);
        }
      },
      willDrawPage: (pageData) => {
        if (getCurrentPage(doc) > 1) {
          drawPageWatermark(doc, watermark);
          drawCompactHeader(doc, logo, backdrop);
        }
        if (pageData.pageNumber > 1) drawGroupHeading(doc, group, PDF_HEADER_H + 3);
      },
      didDrawPage: () => {
        drawFooterLine(doc);
      },
    });

    const lastTable = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
    cursorY = typeof lastTable?.finalY === 'number' ? lastTable.finalY + 5 : cursorY + 12;
  });

  if (!groups.length) {
    setPdfText(doc, COLORS.muted, 9, 'normal');
    doc.text('Nenhuma ordem selecionada para este relatório.', PDF_MARGIN_X, cursorY);
    drawFooterLine(doc);
  }

  drawFinalFooters(doc);
  return doc;
}

function excelDate(value: string | null | undefined): string {
  return reportDate(value, true);
}

function excelDetailRow(row: ApoioReportRow, now: Date): Record<string, unknown> {
  const days = reportDays(row, now);
  const numericDays = /^\d+$/.test(days) ? Number(days) : null;
  return {
    Apoio: text(row.apoio, 'Apoio não informado'),
    OS: row.os ?? '',
    Frota: reportFleet(row),
    Equipamento: reportEquipment(row),
    Modelo: row.modelo ?? '',
    'Grupo equipamento': row.grupo_fonte ?? '',
    Setor: row.setor ?? '',
    Ponto: row.ponto ?? '',
    Origem: row.origem ?? '',
    'Categoria de local': reportLocation(row),
    Prestador: row.prestador ?? '',
    'Local / prestador exibido': reportProvider(row),
    Status: row.status ?? '',
    'Status bruto': row.status ?? '',
    'Status operacional': reportOperationalStatus(row),
    'Status no relatório': reportOperationalStatus(row),
    'Origem do encerramento': getMaintenanceOrderClosure(row).origin ?? '',
    'Data detecção encerramento': getMaintenanceOrderClosure(row).detectedAt ?? '',
    Entrada: row.entrada ?? '',
    'Entrada (formatada)': excelDate(row.entrada),
    Previsão: row.previsao ?? '',
    'Previsão (formatada)': excelDate(row.previsao),
    'Dias observados': numericDays,
    'Dias — observação': numericDays === null ? days : '',
    Narrativa: row.narrativa ?? '',
  };
}

function excelMetaRows(options: ApoioReportOptions, rows: ApoioReportRow[], now: Date): Array<[string, unknown]> {
  const kpis = getOperationalReportKpis(rows);
  const metadata: Array<[string, unknown]> = [
    ['Relatório', text(options.reportTitle, 'Controle de Equipamentos — Apoio')],
    ['Visão', reportDisplayText(options.view, 'Não informada')],
    ['Gerado em', reportDate(now.toISOString(), true)],
    ['Ordens filtradas', rows.length],
  ];
  (options.filtersExcel || options.filters)?.forEach((filter, index) => metadata.push([`Filtro ativo ${index + 1}`, reportDisplayText(filter, 'Filtro sem rótulo')]));
  if (text(options.sourceError)) metadata.push(['Aviso', 'Atualização pendente: consulte o aplicativo antes de tomar decisões.']);
  if (!(options.filtersExcel || options.filters)?.length) metadata.push(['Filtros ativos', 'Sem filtros informados']);
  kpis.forEach((kpi) => metadata.push([`KPI — ${kpi.label}`, kpi.value]));
  metadata.push([
    'Nota de status',
    'Status operacional é derivado sem sobrescrever o status bruto. Encerramento informa estado e data de detecção; execução humana não é inferida. Ausência sem prova permanece “Outros · Sem confirmação”.',
  ]);
  return metadata;
}

function configureExcelWidths(sheet: XLSX.WorkSheet): void {
  const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
  const widths: XLSX.ColInfo[] = [];
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    let max = 12;
    for (let row = range.s.r; row <= Math.min(range.e.r, 80); row += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ c: column, r: row })];
      const value = cell?.v === null || cell?.v === undefined ? '' : String(cell.v);
      max = Math.max(max, Math.min(42, value.length + 2));
    }
    widths.push({ wch: max });
  }
  sheet['!cols'] = widths;
}

export async function exportApoioPDF(options: ApoioReportOptions): Promise<void> {
  const doc = await buildPdf(options);
  await doc.save(reportFilename('pdf', options), { returnPromise: true });
}

export async function exportApoioExcel(options: ApoioReportOptions): Promise<void> {
  const rows = Array.isArray(options.rows) ? options.rows : [];
  const equipmentImages = await preloadEquipmentImages(rows);
  assertEquipmentReportImagesLoaded(rows, equipmentImages);
  const now = new Date();
  const workbook = XLSX.utils.book_new();
  const details = rows.map((row) => excelDetailRow(row, now));
  const detailSheet = XLSX.utils.json_to_sheet(details);
  configureExcelWidths(detailSheet);
  if (detailSheet['!ref']) {
    detailSheet['!autofilter'] = { ref: detailSheet['!ref'] };
  }
  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Ordens filtradas');

  const metaSheet = XLSX.utils.aoa_to_sheet([
    ['Campo', 'Valor'],
    ...excelMetaRows(options, rows, now),
  ]);
  metaSheet['!cols'] = [{ wch: 30 }, { wch: 105 }];
  XLSX.utils.book_append_sheet(workbook, metaSheet, 'Filtros e metadados');

  await downloadIllustratedExcel(workbook, rows, reportFilename('xlsx', options, now));
}
