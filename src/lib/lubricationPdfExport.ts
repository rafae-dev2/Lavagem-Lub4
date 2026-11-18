import { format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Programacao, StatusType } from '../types';
import { type PCMReportFilters } from './pcmReportFilters';
import { resolveEquipmentImage, preloadEquipmentImages } from './equipmentImages';
import { assertEquipmentReportImagesLoaded } from './equipmentReportImages';
import { createLogoWatermarkDataUrl } from './reportWatermark';

export type PdfExportLayout = 'simplificado' | 'detalhado';

export const EXPORT_PDF_LAYOUT_STORAGE_KEY = 'branco-peres-export-pdf-layout';

export interface PdfLayoutOption {
  id: PdfExportLayout;
  label: string;
  description: string;
}

export const PDF_LAYOUT_OPTIONS: readonly PdfLayoutOption[] = [
  {
    id: 'simplificado',
    label: 'Simplificado',
    description: 'Tabela enxuta (7 colunas operacionais) para leitura rápida em campo.',
  },
  {
    id: 'detalhado',
    label: 'Detalhado',
    description: 'Resumo por grupo + OS, origem, previsão, status PCM e narrativa completa.',
  },
];

export interface PdfThemePalette {
  id: string;
  name: string;
  emoji: string;
  accentLight: string;
  pdfHeaderRgb: [number, number, number];
  pdfHeaderRgb2: [number, number, number];
  pdfTableHeaderRgb: [number, number, number];
  pdfTableHeaderTextRgb: [number, number, number];
  pdfAltRowRgb: [number, number, number];
  pdfTextRgb: [number, number, number];
  pdfSubTextRgb: [number, number, number];
  pdfFooterRgb: [number, number, number];
  pdfAccentRgb: [number, number, number];
}

export interface PdfExportStats {
  atrasado: number;
  pendente: number;
  programado: number;
  encerrado: number;
  andamento: number;
  total: number;
}

export interface PdfFilterDescriptorInput {
  statusFilter?: StatusType | '';
  pcmFilters?: Partial<PCMReportFilters>;
  apoioLabels?: Record<string, string>;
}

export interface PdfSummaryGroup {
  grupo: string;
  total: number;
  atrasado: number;
  andamento: number;
  programado: number;
  pendente: number;
  encerrado: number;
}

export interface SimplifiedPdfRow {
  frota: string;
  servico: string;
  local: string;
  programacao: string;
  horario: string;
  status: StatusType;
  statusLabel: string;
  observacao: string;
}

export interface DetailedPdfRow {
  frotaBloco: string;
  osOrigemBloco: string;
  servicoLocalBloco: string;
  datasBloco: string;
  status: StatusType;
  statusBloco: string;
  observacaoNarrativaBloco: string;
}

const PDF_STATUS_STYLE: Record<
  StatusType,
  { label: string; rgb: [number, number, number]; textRgb: [number, number, number] }
> = {
  ATRASADO: { label: 'ATRASADO', rgb: [254, 226, 226], textRgb: [185, 28, 28] },
  PENDENTE: { label: 'PENDENTE', rgb: [254, 249, 195], textRgb: [161, 98, 7] },
  PROGRAMADO: { label: 'PROGRAMADO', rgb: [219, 234, 254], textRgb: [29, 78, 216] },
  ANDAMENTO: { label: 'ANDAMENTO', rgb: [243, 232, 255], textRgb: [124, 58, 237] },
  ENCERRADO: { label: 'ENCERRADO', rgb: [220, 252, 231], textRgb: [21, 128, 61] },
};

export function normalizePdfExportLayout(value: unknown): PdfExportLayout {
  const normalized = String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
  if (normalized === 'detalhado' || normalized === 'completo' || normalized === 'detalhada') {
    return 'detalhado';
  }
  return 'simplificado';
}

export function readStoredPdfLayout(): PdfExportLayout {
  if (typeof window === 'undefined') return 'simplificado';
  try {
    return normalizePdfExportLayout(window.localStorage.getItem(EXPORT_PDF_LAYOUT_STORAGE_KEY));
  } catch {
    return 'simplificado';
  }
}

export function saveStoredPdfLayout(layout: PdfExportLayout): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EXPORT_PDF_LAYOUT_STORAGE_KEY, normalizePdfExportLayout(layout));
  } catch {
    /* armazenamento opcional */
  }
}

function formatPdfDate(iso?: string | null): string {
  const clean = String(iso ?? '').trim();
  if (!clean) return '—';
  try {
    const parsed = parseISO(clean);
    return isValid(parsed) ? format(parsed, 'dd/MM/yy', { locale: ptBR }) : clean;
  } catch {
    return clean;
  }
}

function formatPdfDateTime(iso?: string | null): string {
  const clean = String(iso ?? '').trim();
  if (!clean) return '';
  try {
    const parsed = parseISO(clean);
    if (!isValid(parsed)) return clean;
    if (clean.includes('T') || clean.includes(':')) {
      return format(parsed, 'dd/MM/yy HH:mm', { locale: ptBR });
    }
    return format(parsed, 'dd/MM/yy', { locale: ptBR });
  } catch {
    return clean;
  }
}

function cleanText(value?: string | null, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function describeActivePdfFilters(input: PdfFilterDescriptorInput = {}): string[] {
  const filters: string[] = [];
  if (input.statusFilter) {
    filters.push(`Situação: ${PDF_STATUS_STYLE[input.statusFilter]?.label ?? input.statusFilter}`);
  }
  const tipo = cleanText(input.pcmFilters?.tipo);
  if (tipo) {
    filters.push(`Serviço: ${tipo}`);
  }
  const origem = cleanText(input.pcmFilters?.origem);
  if (origem) {
    filters.push(`Origem: ${origem === 'PCM' ? 'Automáticas · PCM' : origem === 'MANUAL' ? 'Manuais' : origem}`);
  } else {
    filters.push('Origem: Todas');
  }
  const apoio = cleanText(input.pcmFilters?.apoio);
  if (apoio) {
    filters.push(`Grupo Apoio: ${input.apoioLabels?.[apoio] ?? apoio}`);
  }
  return filters.length ? filters : ['Filtros: Todos os registros da janela'];
}

export function buildPdfSummaryGroups(rows: readonly Programacao[]): PdfSummaryGroup[] {
  const groups = new Map<string, PdfSummaryGroup>();

  for (const row of rows) {
    const label = cleanText(row.apoioNome) || cleanText(row.apoioId) || cleanText(row.tipoPreventiva) || 'Geral';
    const current = groups.get(label) ?? {
      grupo: label,
      total: 0,
      atrasado: 0,
      andamento: 0,
      programado: 0,
      pendente: 0,
      encerrado: 0,
    };

    current.total += 1;
    if (row.situacao === 'ATRASADO') current.atrasado += 1;
    else if (row.situacao === 'ANDAMENTO') current.andamento += 1;
    else if (row.situacao === 'PROGRAMADO') current.programado += 1;
    else if (row.situacao === 'PENDENTE') current.pendente += 1;
    else if (row.situacao === 'ENCERRADO') current.encerrado += 1;

    groups.set(label, current);
  }

  return Array.from(groups.values()).sort(
    (a, b) => b.total - a.total || a.grupo.localeCompare(b.grupo, 'pt-BR'),
  );
}

export function buildSimplifiedPdfRows(rows: readonly Programacao[]): SimplifiedPdfRow[] {
  return rows.map((row) => ({
    frota: cleanText(row.frota, '—'),
    servico: cleanText(row.tipoPreventiva, '—'),
    local: cleanText(row.descricaoPonto, '—'),
    programacao: formatPdfDate(row.dataProgramada),
    horario: cleanText(row.horarioAgendado, '—'),
    status: row.situacao,
    statusLabel: PDF_STATUS_STYLE[row.situacao]?.label ?? row.situacao,
    observacao: cleanText(row.observacao, '—'),
  }));
}

export function buildDetailedPdfRows(rows: readonly Programacao[]): DetailedPdfRow[] {
  return rows.map((row) => {
    const frota = cleanText(row.frota, '—');
    const grupo = cleanText(row.apoioNome) || cleanText(row.apoioId) || 'Grupo não vinculado';
    const os = cleanText(row.numeroOS, 'Sem OS');
    const origem = row.origemRegistro === 'PCM' ? 'PCM Automática' : 'Manual';
    const servico = cleanText(row.tipoPreventiva, '—');
    const local = cleanText(row.descricaoPonto, '—');

    const progData = formatPdfDate(row.dataProgramada);
    const horario = cleanText(row.horarioAgendado);
    const prevData = formatPdfDate(row.previsaoPCM);
    const realData = formatPdfDate(row.dataRealizada);
    const datasLinhas = [
      `Prog.: ${progData}${horario ? ` às ${horario}` : ''}`,
      prevData !== '—' ? `Prev.: ${prevData}` : '',
      realData !== '—' ? `Real.: ${realData}` : '',
    ].filter(Boolean);

    const statusLabel = PDF_STATUS_STYLE[row.situacao]?.label ?? row.situacao;
    const statusLinhas = [statusLabel];
    const statusPcm = cleanText(row.statusPCM);
    if (statusPcm && statusPcm.toLocaleUpperCase('pt-BR') !== statusLabel) {
      statusLinhas.push(`PCM: ${statusPcm}`);
    }
    const encerradoEm = formatPdfDateTime(row.encerradoDetectadoEm);
    if (row.situacao === 'ENCERRADO' && encerradoEm) {
      statusLinhas.push(`Detec.: ${encerradoEm}`);
    }

    const obs = cleanText(row.observacao);
    const narrativa = cleanText(row.narrativaPCM);
    const textoLinhas: string[] = [];
    if (obs) textoLinhas.push(obs);
    if (narrativa && narrativa !== obs) textoLinhas.push(`Narrativa: ${narrativa}`);
    if (!textoLinhas.length) textoLinhas.push('Sem observações registradas');

    return {
      frotaBloco: `${frota}\n${grupo}`,
      osOrigemBloco: `OS: ${os}\n${origem}`,
      servicoLocalBloco: `${servico}\nLocal: ${local}`,
      datasBloco: datasLinhas.join('\n'),
      status: row.situacao,
      statusBloco: statusLinhas.join('\n'),
      observacaoNarrativaBloco: textoLinhas.join('\n'),
    };
  });
}

function isDarkPdfPalette(theme: PdfThemePalette): boolean {
  const [r, g, b] = theme.pdfAltRowRgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.45;
}

async function loadLogoPngDataUrl(): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof Image === 'undefined') {
    return null;
  }
  return new Promise<string | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx || !canvas.width || !canvas.height) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = '/logo.png';
  });
}

export interface ExportStructuredPdfParams {
  rows: Programacao[];
  stats: PdfExportStats;
  theme: PdfThemePalette;
  layout: PdfExportLayout;
  now: Date;
  filterDescriptor?: PdfFilterDescriptorInput;
  reportMode?: string;
}

export async function exportLubricationStructuredPdf({
  rows,
  stats,
  theme,
  layout,
  now,
  filterDescriptor,
  reportMode = 'operacional',
}: ExportStructuredPdfParams): Promise<{ pageCount: number; filename: string }> {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const equipmentMedia = await preloadEquipmentImages(rows);
  assertEquipmentReportImagesLoaded(rows, equipmentMedia);

  const [logoDataUrl, watermarkAsset] = await Promise.all([
    loadLogoPngDataUrl(),
    createLogoWatermarkDataUrl('/logo.png', { alpha: 0.05, size: 520, withFrameRings: false }),
  ]);

  const filterList = describeActivePdfFilters(filterDescriptor);
  const layoutTitle = layout === 'detalhado' ? 'DETALHADO' : 'SIMPLIFICADO';
  const darkTheme = isDarkPdfPalette(theme);
  const tableNeutralBg: [number, number, number] = darkTheme ? [17, 24, 39] : [255, 255, 255];

  const drawWatermarkOnPage = () => {
    if (!watermarkAsset.dataUrl) return;
    const wmSize = 104;
    const wmX = (pageW - wmSize) / 2;
    const wmY = (pageH - wmSize) / 2 + 8;
    doc.addImage(watermarkAsset.dataUrl, 'PNG', wmX, wmY, wmSize, wmSize);
  };

  const drawHeader = () => {
    doc.setFillColor(...theme.pdfHeaderRgb);
    doc.rect(0, 0, pageW, 24, 'F');
    doc.setFillColor(...theme.pdfHeaderRgb2);
    doc.rect(pageW * 0.56, 0, pageW * 0.44, 24, 'F');
    doc.setFillColor(...theme.pdfAccentRgb);
    doc.rect(0, 0, 3.2, 24, 'F');
    doc.rect(0, 23.4, pageW, 0.7, 'F');

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', 5.5, 3, 18, 18);
    }

    const leftX = logoDataUrl ? 26.5 : 8;
    doc.setTextColor(...theme.pdfTableHeaderTextRgb);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('BRANCO PERES AGRO', leftX, 10.8);
    doc.setFontSize(8.2);
    doc.setFont('helvetica', 'normal');
    doc.text(`Controle de Lavagem e Lubrificação  ·  Relatório PDF ${layoutTitle}`, leftX, 17.8);

    doc.setFontSize(7.5);
    doc.text(
      `Gerado: ${format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}  ·  Total: ${stats.total} reg.`,
      pageW - 7,
      10.5,
      { align: 'right' },
    );
    doc.text(`Tema: ${theme.name}  ·  Modo: ${layoutTitle}`, pageW - 7, 17.8, { align: 'right' });
  };

  const drawFooter = (page: number, total: number) => {
    doc.setFillColor(...theme.pdfFooterRgb);
    doc.rect(0, pageH - 8.5, pageW, 8.5, 'F');
    doc.setFillColor(...theme.pdfAccentRgb);
    doc.rect(0, pageH - 8.5, 3.2, 8.5, 'F');

    doc.setFontSize(7.1);
    doc.setTextColor(...theme.pdfTableHeaderTextRgb);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `BRANCO PERES AGRO  ·  Controle de Lavagem e Lubrificação (${layoutTitle})  ·  ${format(now, 'yyyy')}  |  Pág. ${page}/${total}  |  ${stats.total} registros`,
      pageW / 2,
      pageH - 3.1,
      { align: 'center' },
    );
  };

  const drawFilterStripAndStats = (): number => {
    // Barra de filtros ativos
    const filterText = filterList.join('   •   ');
    doc.setFillColor(...theme.pdfAltRowRgb);
    doc.setDrawColor(...theme.pdfAccentRgb);
    doc.setLineWidth(0.25);
    doc.roundedRect(8, 26.5, pageW - 16, 7.5, 1.5, 1.5, 'FD');
    doc.setFontSize(7.2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...theme.pdfTextRgb);
    doc.text(doc.splitTextToSize(filterText, pageW - 22)[0] ?? filterText, 11, 31.3);

    const items = [
      { label: 'Atrasado', value: stats.atrasado, rgb: [185, 28, 28] as [number, number, number], bgRgb: [254, 226, 226] as [number, number, number] },
      { label: 'Pendente', value: stats.pendente, rgb: [161, 98, 7] as [number, number, number], bgRgb: [254, 249, 195] as [number, number, number] },
      { label: 'Programado', value: stats.programado, rgb: [29, 78, 216] as [number, number, number], bgRgb: [219, 234, 254] as [number, number, number] },
      { label: 'Andamento', value: stats.andamento, rgb: [124, 58, 237] as [number, number, number], bgRgb: [243, 232, 255] as [number, number, number] },
      { label: 'Encerrado', value: stats.encerrado, rgb: [21, 128, 61] as [number, number, number], bgRgb: [220, 252, 231] as [number, number, number] },
    ];
    const boxY = 36.2;
    const boxH = 16.8;
    const gap = 3;
    const itemW = (pageW - 16 - gap * 4) / 5;

    items.forEach((item, index) => {
      const x = 8 + index * (itemW + gap);
      const cx = x + itemW / 2;
      doc.setFillColor(...item.bgRgb);
      doc.roundedRect(x, boxY, itemW, boxH, 1.8, 1.8, 'F');
      doc.setFillColor(...item.rgb);
      doc.rect(x, boxY, itemW, 1.8, 'F');
      doc.setTextColor(...item.rgb);
      doc.setFontSize(12.5);
      doc.setFont('helvetica', 'bold');
      doc.text(String(item.value), cx, boxY + 8.6, { align: 'center' });
      doc.setFontSize(6.4);
      doc.text(item.label.toUpperCase(), cx, boxY + 14.1, { align: 'center' });
    });

    return boxY + boxH + 4.5;
  };

  if (darkTheme) {
    doc.setFillColor(...tableNeutralBg);
    doc.rect(0, 0, pageW, pageH, 'F');
  }
  drawWatermarkOnPage();
  drawHeader();
  let startY = drawFilterStripAndStats();

  // No modo detalhado, inclui quadro resumo executivo por Grupo Apoio / Serviço
  if (layout === 'detalhado' && rows.length > 0) {
    const summaryGroups = buildPdfSummaryGroups(rows).slice(0, 8);
    doc.setFontSize(8.2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...theme.pdfTextRgb);
    doc.text('RESUMO EXECUTIVO POR GRUPO / SERVIÇO', 8, startY + 2.5);
    startY += 4;

    autoTable(doc, {
      startY,
      margin: { left: 8, right: 8, top: 28, bottom: 12 },
      head: [['Grupo Apoio / Serviço', 'Total', 'Atrasado', 'Andamento', 'Programado', 'Encerrado']],
      body: summaryGroups.map((g) => [
        g.grupo,
        String(g.total),
        String(g.atrasado),
        String(g.andamento),
        String(g.programado),
        String(g.encerrado),
      ]),
      styles: {
        fontSize: 7.4,
        cellPadding: 1.8,
        textColor: theme.pdfTextRgb,
        fillColor: darkTheme ? tableNeutralBg : [255, 255, 255],
        lineColor: theme.pdfAccentRgb,
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: theme.pdfTableHeaderRgb,
        textColor: theme.pdfTableHeaderTextRgb,
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: { fillColor: theme.pdfAltRowRgb },
      columnStyles: {
        0: { cellWidth: 'auto', fontStyle: 'bold' },
        1: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 26, halign: 'center' },
        4: { cellWidth: 28, halign: 'center' },
        5: { cellWidth: 26, halign: 'center' },
      },
      willDrawPage: () => {
        if (doc.getCurrentPageInfo().pageNumber > 1) {
          if (darkTheme) {
            doc.setFillColor(...tableNeutralBg);
            doc.rect(0, 0, pageW, pageH, 'F');
          }
          drawWatermarkOnPage();
          drawHeader();
        }
      },
    });

    const lastSummaryY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
    startY = typeof lastSummaryY === 'number' ? lastSummaryY + 6 : startY + 24;
    if (startY > pageH - 42) {
      doc.addPage();
      if (darkTheme) {
        doc.setFillColor(...tableNeutralBg);
        doc.rect(0, 0, pageW, pageH, 'F');
      }
      drawWatermarkOnPage();
      drawHeader();
      startY = 30;
    }

    doc.setFontSize(8.2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...theme.pdfTextRgb);
    doc.text('LISTAGEM DETALHADA DE ORDENS E PROGRAMAÇÕES', 8, startY);
    startY += 2.5;
  }

  const equipmentDrawnRows = new Set<number>();

  if (layout === 'simplificado') {
    const simplified = buildSimplifiedPdfRows(rows);
    autoTable(doc, {
      startY,
      margin: { left: 8, right: 8, top: 28, bottom: 12 },
      head: [['Frota', 'Serviço', 'Local', 'Programação', 'Horário', 'Status', 'Observação']],
      body: simplified.map((r) => [
        r.frota,
        r.servico,
        r.local,
        r.programacao,
        r.horario,
        r.statusLabel,
        r.observacao,
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        valign: 'middle',
        overflow: 'linebreak',
        textColor: theme.pdfTextRgb,
        fillColor: darkTheme ? tableNeutralBg : [255, 255, 255],
      },
      headStyles: {
        fillColor: theme.pdfTableHeaderRgb,
        textColor: theme.pdfTableHeaderTextRgb,
        fontStyle: 'bold',
        halign: 'left',
        fontSize: 8.3,
      },
      alternateRowStyles: { fillColor: theme.pdfAltRowRgb },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 33, halign: 'left' },
        1: { cellWidth: 48 },
        2: { cellWidth: 26 },
        3: { cellWidth: 24, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 28, halign: 'center' },
        6: { cellWidth: 'auto' },
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const row = rows[data.row.index];
        if (data.column.index === 0) {
          data.cell.styles.fillColor = [22, 163, 74];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.halign = 'left';
          const type = row ? resolveEquipmentImage(row) : null;
          if (type && equipmentMedia.has(type.key)) {
            data.cell.styles.cellPadding = { top: 2.8, right: 2, bottom: 2.8, left: 17 };
            data.cell.styles.minCellHeight = 14.5;
          }
        }
        if (data.column.index === 5 && row) {
          const st = PDF_STATUS_STYLE[row.situacao];
          if (st) {
            data.cell.styles.fillColor = st.rgb;
            data.cell.styles.textColor = st.textRgb;
            data.cell.styles.fontStyle = 'bold';
          }
        }
        if (data.column.index === 6) {
          const obs = data.cell.text[0];
          if (obs && obs !== '—') {
            data.cell.styles.fillColor = [254, 243, 199];
            data.cell.styles.textColor = [146, 64, 14];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 0 || equipmentDrawnRows.has(data.row.index)) return;
        const row = rows[data.row.index];
        const type = row ? resolveEquipmentImage(row) : null;
        const media = type ? equipmentMedia.get(type.key) : undefined;
        if (!media || data.cell.height < 8) return;
        const ratio = Math.min(13 / media.width, Math.min(10, data.cell.height - 2) / media.height);
        doc.addImage(
          media.dataUrl,
          'PNG',
          data.cell.x + 2,
          data.cell.y + (data.cell.height - media.height * ratio) / 2,
          media.width * ratio,
          media.height * ratio,
        );
        equipmentDrawnRows.add(data.row.index);
      },
      willDrawPage: () => {
        if (doc.getCurrentPageInfo().pageNumber > 1) {
          if (darkTheme) {
            doc.setFillColor(...tableNeutralBg);
            doc.rect(0, 0, pageW, pageH, 'F');
          }
          drawWatermarkOnPage();
          drawHeader();
        }
      },
    });
  } else {
    const detailed = buildDetailedPdfRows(rows);
    autoTable(doc, {
      startY,
      margin: { left: 8, right: 8, top: 28, bottom: 12 },
      head: [[
        'Frota / Grupo Apoio',
        'OS / Origem',
        'Serviço / Local',
        'Agenda / Execução',
        'Status / PCM',
        'Observação e Narrativa PCM',
      ]],
      body: detailed.map((r) => [
        r.frotaBloco,
        r.osOrigemBloco,
        r.servicoLocalBloco,
        r.datasBloco,
        r.statusBloco,
        r.observacaoNarrativaBloco,
      ]),
      styles: {
        fontSize: 7.6,
        cellPadding: 2.4,
        valign: 'top',
        overflow: 'linebreak',
        textColor: theme.pdfTextRgb,
        fillColor: darkTheme ? tableNeutralBg : [255, 255, 255],
      },
      headStyles: {
        fillColor: theme.pdfTableHeaderRgb,
        textColor: theme.pdfTableHeaderTextRgb,
        fontStyle: 'bold',
        halign: 'left',
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: theme.pdfAltRowRgb },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 44, halign: 'left' },
        1: { cellWidth: 32 },
        2: { cellWidth: 48 },
        3: { cellWidth: 42 },
        4: { cellWidth: 34, halign: 'center' },
        5: { cellWidth: 'auto' },
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const row = rows[data.row.index];
        if (data.column.index === 0) {
          data.cell.styles.fillColor = [22, 163, 74];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.halign = 'left';
          const type = row ? resolveEquipmentImage(row) : null;
          if (type && equipmentMedia.has(type.key)) {
            data.cell.styles.cellPadding = { top: 2.5, right: 2, bottom: 2.5, left: 17 };
            data.cell.styles.minCellHeight = 15;
          }
        }
        if (data.column.index === 4 && row) {
          const st = PDF_STATUS_STYLE[row.situacao];
          if (st) {
            data.cell.styles.fillColor = st.rgb;
            data.cell.styles.textColor = st.textRgb;
            data.cell.styles.fontStyle = 'bold';
          }
        }
        if (data.column.index === 5) {
          const textVal = String(data.cell.raw ?? '');
          if (textVal && !textVal.startsWith('Sem observações')) {
            data.cell.styles.fillColor = darkTheme ? [45, 36, 16] : [254, 249, 232];
            data.cell.styles.textColor = darkTheme ? [253, 230, 138] : [120, 53, 15];
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 0 || equipmentDrawnRows.has(data.row.index)) return;
        const row = rows[data.row.index];
        const type = row ? resolveEquipmentImage(row) : null;
        const media = type ? equipmentMedia.get(type.key) : undefined;
        if (!media || data.cell.height < 8) return;
        const ratio = Math.min(13 / media.width, Math.min(10, data.cell.height - 2) / media.height);
        doc.addImage(
          media.dataUrl,
          'PNG',
          data.cell.x + 2,
          data.cell.y + (data.cell.height - media.height * ratio) / 2,
          media.width * ratio,
          media.height * ratio,
        );
        equipmentDrawnRows.add(data.row.index);
      },
      willDrawPage: () => {
        if (doc.getCurrentPageInfo().pageNumber > 1) {
          if (darkTheme) {
            doc.setFillColor(...tableNeutralBg);
            doc.rect(0, 0, pageW, pageH, 'F');
          }
          drawWatermarkOnPage();
          drawHeader();
        }
      },
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }

  const filename = `branco-peres-${reportMode}-${layout}-${theme.id}-${format(now, 'dd-MM-yyyy')}.pdf`;
  await doc.save(filename, { returnPromise: true });
  return { pageCount: totalPages, filename };
}
