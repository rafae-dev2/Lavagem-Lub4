import { assertEquipmentReportImagesLoaded } from '../lib/equipmentReportImages';
import { preloadEquipmentImages, resolveEquipmentImage } from '../lib/equipmentImages';
import React, { useEffect, useMemo, useState } from 'react';
import { Programacao, StatusType } from '../types';
import { Download, Image, Filter, Share2, FileText, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Palette, Smartphone, Monitor, Instagram } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTheme } from '../contexts/ThemeContext';
import { type PCMReportFilters } from '../lib/pcmReportFilters';
import { getDailyExportWindow, getDailyExportWindowKey, getDailyExportStats } from '../lib/dailyExport';
import { getLubricationClosedWindowStart, selectLubricationExportSchedules } from '../lib/lubricationExport';
import {
  PDF_LAYOUT_OPTIONS,
  exportLubricationStructuredPdf,
  readStoredPdfLayout,
  saveStoredPdfLayout,
  type PdfExportLayout,
} from '../lib/lubricationPdfExport';
interface Props {
  schedules: Programacao[];
}

// ─── Paleta de status ─────────────────────────────────────────────────────────
const STATUS_STYLE: Record<StatusType, {
  bg: string; color: string; border: string; label: string;
  rgb: [number,number,number]; textRgb: [number,number,number];
}> = {
  ATRASADO:   { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', label: 'ATRASADO',   rgb: [254,226,226], textRgb: [185,28,28]  },
  PENDENTE:   { bg: '#fef9c3', color: '#a16207', border: '#fde047', label: 'PENDENTE',   rgb: [254,249,195], textRgb: [161,98,7]   },
  PROGRAMADO: { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd', label: 'PROGRAMADO', rgb: [219,234,254], textRgb: [29,78,216]  },
  ENCERRADO:  { bg: '#dcfce7', color: '#15803d', border: '#86efac', label: 'ENCERRADO',  rgb: [220,252,231], textRgb: [21,128,61]  },
  ANDAMENTO:  { bg: '#f3e8ff', color: '#7c3aed', border: '#c4b5fd', label: 'ANDAMENTO',  rgb: [243,232,255], textRgb: [124,58,237] },
};

// ─── Modos de tamanho de exportação ──────────────────────────────────────────
export type ExportSize = 'original' | 'instagram' | 'whatsapp';

interface SizeConfig {
  id: ExportSize;
  label: string;
  emoji: string;
  description: string;
  width: number;
  maxRowsPerPage: number;
  scale: number;
  fontScale: number;
}

const SIZE_CONFIGS: SizeConfig[] = [
  { id: 'original',  label: 'Original',  emoji: '🖥️', description: 'Tamanho padrão (1200px)',       width: 1200, maxRowsPerPage: 300, scale: 2, fontScale: 1 },
  { id: 'instagram', label: 'Instagram', emoji: '📸', description: 'Post 1080×1350 (4:5)',          width: 1080, maxRowsPerPage: 28,  scale: 2, fontScale: 0.95 },
  { id: 'whatsapp',  label: 'WhatsApp',  emoji: '📱', description: 'Status/Tela celular 1080×1920', width: 1080, maxRowsPerPage: 42,  scale: 2, fontScale: 0.92 },
];

// ─── Temas de exportação (10 temas robustos) ─────────────────────────────────
export type ExportTheme = 'light' | 'dark' | 'ocean' | 'sunset' | 'forest' | 'midnight' | 'rose' | 'arctic' | 'copper' | 'lavender' | 'glass';

interface ThemeConfig {
  id: ExportTheme;
  name: string;
  emoji: string;
  bg: string; bgAlt: string;
  headerBg1: string; headerBg2: string;
  headerText: string; titleText: string; subtitleText: string; metaText: string;
  tableBg: string; tableAlt: string; tableHeader: string; tableHeaderText: string;
  tableText: string; tableSubText: string; separatorColor: string;
  footerBg1: string; footerBg2: string; footerText: string;
  accentColor: string; accentLight: string;
  statBgs: string[]; statColors: string[];
  pdfHeaderRgb: [number,number,number]; pdfHeaderRgb2: [number,number,number];
  pdfTableHeaderRgb: [number,number,number]; pdfTableHeaderTextRgb: [number,number,number];
  pdfAltRowRgb: [number,number,number]; pdfTextRgb: [number,number,number];
  pdfSubTextRgb: [number,number,number]; pdfFooterRgb: [number,number,number];
  pdfAccentRgb: [number,number,number];
}

const THEMES: Record<ExportTheme, ThemeConfig> = {
  light: {
    id: 'light', name: 'Claro', emoji: '☀️',
    bg: '#ffffff', bgAlt: '#f8fafc',
    headerBg1: '#1a7a2e', headerBg2: '#0f5a1e',
    headerText: '#ffffff', titleText: '#1a7a2e', subtitleText: '#ffffff', metaText: '#ffffff',
    tableBg: '#ffffff', tableAlt: '#f0fdf4', tableHeader: '#1a7a2e', tableHeaderText: '#ffffff',
    tableText: '#111827', tableSubText: '#374151', separatorColor: '#e5e7eb',
    footerBg1: '#1a7a2e', footerBg2: '#0f5a1e', footerText: '#ffffff',
    accentColor: '#16a34a', accentLight: '#dcfce7',
    statBgs: ['#fee2e2','#fef9c3','#dbeafe','#f3e8ff','#dcfce7'],
    statColors: ['#b91c1c','#a16207','#1d4ed8','#7c3aed','#15803d'],
    pdfHeaderRgb: [26,122,46], pdfHeaderRgb2: [15,90,30],
    pdfTableHeaderRgb: [26,122,46], pdfTableHeaderTextRgb: [255,255,255],
    pdfAltRowRgb: [240,253,244], pdfTextRgb: [17,24,39], pdfSubTextRgb: [107,114,128],
    pdfFooterRgb: [26,122,46], pdfAccentRgb: [22,163,74],
  },
  dark: {
    id: 'dark', name: 'Dark', emoji: '🌙',
    bg: '#1a2332', bgAlt: '#141414',
    headerBg1: '#000000', headerBg2: '#1a1a1a',
    headerText: '#00ff88', titleText: '#00ff88', subtitleText: '#d0d0d0', metaText: '#a0a0a0',
    tableBg: '#1a2332', tableAlt: '#141414',
    tableHeader: '#1a1a1a', tableHeaderText: '#00ff88',
    tableText: '#f0f0f0', tableSubText: '#d0d0d0', separatorColor: '#262626',
    footerBg1: '#000000', footerBg2: '#1a1a1a', footerText: '#00ff88',
    accentColor: '#00ff88', accentLight: '#0a2a14',
    statBgs: ['#2a0a0a','#2a1800','#0a1a2a','#1a0a2a','#0a2a14'],
    statColors: ['#ff6b6b','#ffd700','#60a5fa','#c084fc','#00ff88'],
    pdfHeaderRgb: [0,0,0], pdfHeaderRgb2: [26,26,26],
    pdfTableHeaderRgb: [26,26,26], pdfTableHeaderTextRgb: [0,255,136],
    pdfAltRowRgb: [20,20,20], pdfTextRgb: [240,240,240], pdfSubTextRgb: [208,208,208],
    pdfFooterRgb: [0,0,0], pdfAccentRgb: [0,255,136],
  },
  ocean: {
    id: 'ocean', name: 'Ocean', emoji: '🌊',
    bg: '#0c1a2e', bgAlt: '#0f2340',
    headerBg1: '#1e3a5f', headerBg2: '#0f2744',
    headerText: '#e2e8f0', titleText: '#22d3ee', subtitleText: '#94a3b8', metaText: '#64748b',
    tableBg: '#0c1a2e', tableAlt: '#0f2340',
    tableHeader: '#1e3a5f', tableHeaderText: '#e2e8f0',
    tableText: '#e2e8f0', tableSubText: '#94a3b8', separatorColor: '#1e293b',
    footerBg1: '#1e3a5f', footerBg2: '#0f2744', footerText: '#e2e8f0',
    accentColor: '#22d3ee', accentLight: '#0c4a6e',
    statBgs: ['#1c0a0a','#1c1500','#0c2a4a','#1a1140','#0a1c0f'],
    statColors: ['#f87171','#fbbf24','#22d3ee','#a5b4fc','#4ade80'],
    pdfHeaderRgb: [30,58,95], pdfHeaderRgb2: [15,39,68],
    pdfTableHeaderRgb: [30,58,95], pdfTableHeaderTextRgb: [226,232,240],
    pdfAltRowRgb: [15,35,64], pdfTextRgb: [226,232,240], pdfSubTextRgb: [148,163,184],
    pdfFooterRgb: [30,58,95], pdfAccentRgb: [34,211,238],
  },
  sunset: {
    id: 'sunset', name: 'Sunset', emoji: '🌅',
    bg: '#1a0a00', bgAlt: '#2a1200',
    headerBg1: '#7c2d12', headerBg2: '#431407',
    headerText: '#fff7ed', titleText: '#f97316', subtitleText: '#fed7aa', metaText: '#fdba74',
    tableBg: '#1a0a00', tableAlt: '#2a1200',
    tableHeader: '#7c2d12', tableHeaderText: '#fff7ed',
    tableText: '#fff7ed', tableSubText: '#fed7aa', separatorColor: '#3a1a00',
    footerBg1: '#7c2d12', footerBg2: '#431407', footerText: '#fff7ed',
    accentColor: '#f97316', accentLight: '#431407',
    statBgs: ['#2a0a0a','#2a1800','#1a1000','#1a0a1f','#0a1c0f'],
    statColors: ['#f87171','#fbbf24','#fb923c','#d8b4fe','#4ade80'],
    pdfHeaderRgb: [124,45,18], pdfHeaderRgb2: [67,20,7],
    pdfTableHeaderRgb: [124,45,18], pdfTableHeaderTextRgb: [255,247,237],
    pdfAltRowRgb: [42,18,0], pdfTextRgb: [255,247,237], pdfSubTextRgb: [254,215,170],
    pdfFooterRgb: [124,45,18], pdfAccentRgb: [249,115,22],
  },
  forest: {
    id: 'forest', name: 'Forest', emoji: '🌲',
    bg: '#071a0e', bgAlt: '#0d2618',
    headerBg1: '#14532d', headerBg2: '#052e16',
    headerText: '#f0fdf4', titleText: '#4ade80', subtitleText: '#bbf7d0', metaText: '#86efac',
    tableBg: '#071a0e', tableAlt: '#0d2618',
    tableHeader: '#14532d', tableHeaderText: '#f0fdf4',
    tableText: '#f0fdf4', tableSubText: '#bbf7d0', separatorColor: '#133220',
    footerBg1: '#14532d', footerBg2: '#052e16', footerText: '#f0fdf4',
    accentColor: '#4ade80', accentLight: '#052e16',
    statBgs: ['#1c0a0a','#1c1500','#0a1c0f','#1c0f2a','#0a2a12'],
    statColors: ['#f87171','#fbbf24','#4ade80','#c4b5fd','#22c55e'],
    pdfHeaderRgb: [20,83,45], pdfHeaderRgb2: [5,46,22],
    pdfTableHeaderRgb: [20,83,45], pdfTableHeaderTextRgb: [240,253,244],
    pdfAltRowRgb: [13,38,24], pdfTextRgb: [240,253,244], pdfSubTextRgb: [187,247,208],
    pdfFooterRgb: [20,83,45], pdfAccentRgb: [74,222,128],
  },
  midnight: {
    id: 'midnight', name: 'Midnight', emoji: '🌌',
    bg: '#0f0f23', bgAlt: '#161633',
    headerBg1: '#312e81', headerBg2: '#1e1b4b',
    headerText: '#e0e7ff', titleText: '#818cf8', subtitleText: '#c7d2fe', metaText: '#a5b4fc',
    tableBg: '#0f0f23', tableAlt: '#161633',
    tableHeader: '#312e81', tableHeaderText: '#e0e7ff',
    tableText: '#e0e7ff', tableSubText: '#c7d2fe', separatorColor: '#1e1e42',
    footerBg1: '#312e81', footerBg2: '#1e1b4b', footerText: '#e0e7ff',
    accentColor: '#818cf8', accentLight: '#1e1b4b',
    statBgs: ['#1c0a0a','#1c1500','#0f0f30','#1d1145','#0a1c0f'],
    statColors: ['#f87171','#fbbf24','#818cf8','#c084fc','#4ade80'],
    pdfHeaderRgb: [49,46,129], pdfHeaderRgb2: [30,27,75],
    pdfTableHeaderRgb: [49,46,129], pdfTableHeaderTextRgb: [224,231,255],
    pdfAltRowRgb: [22,22,51], pdfTextRgb: [224,231,255], pdfSubTextRgb: [199,210,254],
    pdfFooterRgb: [49,46,129], pdfAccentRgb: [129,140,248],
  },
  rose: {
    id: 'rose', name: 'Rosé', emoji: '🌸',
    bg: '#ffffff', bgAlt: '#fdf2f8',
    headerBg1: '#be185d', headerBg2: '#831843',
    headerText: '#ffffff', titleText: '#be185d', subtitleText: '#fce7f3', metaText: '#fce7f3',
    tableBg: '#ffffff', tableAlt: '#fdf2f8',
    tableHeader: '#be185d', tableHeaderText: '#ffffff',
    tableText: '#1f2937', tableSubText: '#6b7280', separatorColor: '#fce7f3',
    footerBg1: '#be185d', footerBg2: '#831843', footerText: '#ffffff',
    accentColor: '#f472b6', accentLight: '#fce7f3',
    statBgs: ['#fee2e2','#fef9c3','#fce7f3','#f3e8ff','#dcfce7'],
    statColors: ['#b91c1c','#a16207','#be185d','#7c3aed','#15803d'],
    pdfHeaderRgb: [190,24,93], pdfHeaderRgb2: [131,24,67],
    pdfTableHeaderRgb: [190,24,93], pdfTableHeaderTextRgb: [255,255,255],
    pdfAltRowRgb: [253,242,248], pdfTextRgb: [31,41,55], pdfSubTextRgb: [107,114,128],
    pdfFooterRgb: [190,24,93], pdfAccentRgb: [244,114,182],
  },
  arctic: {
    id: 'arctic', name: 'Arctic', emoji: '❄️',
    bg: '#ffffff', bgAlt: '#f0f9ff',
    headerBg1: '#0e7490', headerBg2: '#164e63',
    headerText: '#ffffff', titleText: '#0e7490', subtitleText: '#e0f2fe', metaText: '#e0f2fe',
    tableBg: '#ffffff', tableAlt: '#f0f9ff',
    tableHeader: '#0e7490', tableHeaderText: '#ffffff',
    tableText: '#0c4a6e', tableSubText: '#155e75', separatorColor: '#bae6fd',
    footerBg1: '#0e7490', footerBg2: '#164e63', footerText: '#ffffff',
    accentColor: '#06b6d4', accentLight: '#e0f2fe',
    statBgs: ['#fee2e2','#fef9c3','#ecfeff','#f3e8ff','#dcfce7'],
    statColors: ['#b91c1c','#a16207','#0e7490','#7c3aed','#15803d'],
    pdfHeaderRgb: [14,116,144], pdfHeaderRgb2: [22,78,99],
    pdfTableHeaderRgb: [14,116,144], pdfTableHeaderTextRgb: [255,255,255],
    pdfAltRowRgb: [240,249,255], pdfTextRgb: [12,74,110], pdfSubTextRgb: [21,94,117],
    pdfFooterRgb: [14,116,144], pdfAccentRgb: [6,182,212],
  },
  copper: {
    id: 'copper', name: 'Copper', emoji: '🔥',
    bg: '#1c1209', bgAlt: '#2a1c0e',
    headerBg1: '#92400e', headerBg2: '#78350f',
    headerText: '#fef3c7', titleText: '#d97706', subtitleText: '#fde68a', metaText: '#fcd34d',
    tableBg: '#1c1209', tableAlt: '#2a1c0e',
    tableHeader: '#92400e', tableHeaderText: '#fef3c7',
    tableText: '#fef3c7', tableSubText: '#fde68a', separatorColor: '#382614',
    footerBg1: '#92400e', footerBg2: '#78350f', footerText: '#fef3c7',
    accentColor: '#d97706', accentLight: '#78350f',
    statBgs: ['#2a0a0a','#2a1800','#1c1209','#1c0a2a','#0a1c0f'],
    statColors: ['#f87171','#fbbf24','#d97706','#c4b5fd','#4ade80'],
    pdfHeaderRgb: [146,64,14], pdfHeaderRgb2: [120,53,15],
    pdfTableHeaderRgb: [146,64,14], pdfTableHeaderTextRgb: [254,243,199],
    pdfAltRowRgb: [42,28,14], pdfTextRgb: [254,243,199], pdfSubTextRgb: [253,230,138],
    pdfFooterRgb: [146,64,14], pdfAccentRgb: [217,119,6],
  },
  // ─── Tema Glass (Vidro Fosco / Glassmorphism) ─────────────────────
  // Estilo translucido inspirado no glassmorphism: fundo claro, headers com
  // semi-transparencia (alpha), acento ciano-azulado e cards com brilho suave.
  glass: {
    id: 'glass', name: 'Glass', emoji: '🧊',
    bg: '#eef2ff', bgAlt: '#f5f3ff',
    headerBg1: '#312e81', headerBg2: '#1e1b4b',
    headerText: '#ffffff', titleText: '#1e1b4b', subtitleText: '#e0e7ff', metaText: '#c7d2fe',
    tableBg: '#ffffff', tableAlt: '#f5f3ff',
    tableHeader: '#3730a3', tableHeaderText: '#ffffff',
    tableText: '#1f2937', tableSubText: '#4b5563', separatorColor: '#e0e7ff',
    footerBg1: '#312e81', footerBg2: '#1e1b4b', footerText: '#ffffff',
    accentColor: '#6366f1', accentLight: '#e0e7ff',
    statBgs: ['#fee2e2','#fef3c7','#dbeafe','#ede9fe','#dcfce7'],
    statColors: ['#dc2626','#d97706','#2563eb','#7c3aed','#16a34a'],
    pdfHeaderRgb: [49,46,129], pdfHeaderRgb2: [30,27,75],
    pdfTableHeaderRgb: [55,48,163], pdfTableHeaderTextRgb: [255,255,255],
    pdfAltRowRgb: [245,243,255], pdfTextRgb: [31,41,55], pdfSubTextRgb: [75,85,99],
    pdfFooterRgb: [49,46,129], pdfAccentRgb: [99,102,241],
  },
  lavender: {
    id: 'lavender', name: 'Lavender', emoji: '💜',
    bg: '#ffffff', bgAlt: '#faf5ff',
    headerBg1: '#6d28d9', headerBg2: '#4c1d95',
    headerText: '#ffffff', titleText: '#6d28d9', subtitleText: '#f3e8ff', metaText: '#f3e8ff',
    tableBg: '#ffffff', tableAlt: '#faf5ff',
    tableHeader: '#6d28d9', tableHeaderText: '#ffffff',
    tableText: '#1e1b4b', tableSubText: '#4338ca', separatorColor: '#e9d5ff',
    footerBg1: '#6d28d9', footerBg2: '#4c1d95', footerText: '#ffffff',
    accentColor: '#a78bfa', accentLight: '#f3e8ff',
    statBgs: ['#fee2e2','#fef9c3','#ede9fe','#fdf2f8','#dcfce7'],
    statColors: ['#b91c1c','#a16207','#6d28d9','#9d174d','#15803d'],
    pdfHeaderRgb: [109,40,217], pdfHeaderRgb2: [76,29,149],
    pdfTableHeaderRgb: [109,40,217], pdfTableHeaderTextRgb: [255,255,255],
    pdfAltRowRgb: [250,245,255], pdfTextRgb: [30,27,75], pdfSubTextRgb: [67,56,202],
    pdfFooterRgb: [109,40,217], pdfAccentRgb: [167,139,250],
  },
};

// ─── Layout constants ────────────────────────────────────────────────────────
const PAD = 32;
const ROW_H = 30;
const HEADER_H = 38;
const LOGO_SECTION = 100;
const STATS_SECTION = 90;
const FOOTER_H = 44;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  if (!iso) return '—';
  try { const d = parseISO(iso); return isValid(d) ? format(d, 'dd/MM/yy', { locale: ptBR }) : iso; } catch { return iso; }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

async function loadLogo(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
}

function getCols(totalW: number) {
  const fixed = [110, 175, 95, 68, 68, 72, 115];
  const lastW = totalW - PAD * 2 - fixed.reduce((a, b) => a + b, 0);
  return [
    { label: 'Frota',      w: 110,    align: 'center' as const },
    { label: 'Tipo',       w: 175,   align: 'left'   as const },
    { label: 'Local',      w: 95,    align: 'left'   as const },
    { label: 'Data',       w: 68,    align: 'center' as const },
    { label: 'Horário',    w: 68,    align: 'center' as const },
    { label: 'Realizada',  w: 72,    align: 'center' as const },
    { label: 'Status',     w: 115,   align: 'center' as const },
    { label: 'Observação', w: Math.max(lastW, 80), align: 'left' as const },
  ];
}

// Colunas compactas para Instagram/WhatsApp
function getCompactCols(totalW: number) {
  const fixed = [95, 130, 70, 60, 55, 90];
  const lastW = totalW - PAD * 2 - fixed.reduce((a, b) => a + b, 0);
  return [
    { label: 'Frota',      w: 95,    align: 'center' as const },
    { label: 'Tipo',       w: 130,   align: 'left'   as const },
    { label: 'Local',      w: 70,    align: 'left'   as const },
    { label: 'Data',       w: 60,    align: 'center' as const },
    { label: 'Horário',    w: 55,    align: 'center' as const },
    { label: 'Status',     w: 90,    align: 'center' as const },
    { label: 'Obs.',       w: Math.max(lastW, 50), align: 'left' as const },
  ];
}

// ─── Gerar uma página do PNG ─────────────────────────────────────────────────
async function generatePage(
  rows: Programacao[],
  stats: { atrasado: number; pendente: number; programado: number; encerrado: number; andamento: number; total: number },
  logoImg: HTMLImageElement | null,
  pageNum: number,
  totalPages: number,
  now: Date,
  theme: ThemeConfig,
  sizeConfig: SizeConfig
): Promise<string> {
  const typeMedia = await preloadEquipmentImages(rows);
  assertEquipmentReportImagesLoaded(rows,typeMedia);
  const typeImages = new Map<string, HTMLImageElement>();
  await Promise.all([...typeMedia].map(async ([key, item]) => { const img = await loadLogo(item.dataUrl); if(img) typeImages.set(key,img); }));
  const CANVAS_W = sizeConfig.width;
  const SCALE = sizeConfig.scale;
  const fs = sizeConfig.fontScale;
  const isCompact = sizeConfig.id !== 'original';
  const isFirstPage = pageNum === 1;
  const topSection = isFirstPage ? (LOGO_SECTION + STATS_SECTION) : 64;
  const rowH = isCompact ? 26 : ROW_H;
  const headerH = isCompact ? 32 : HEADER_H;
  const rowsH = rows.length * rowH;
  const naturalH = PAD + topSection + headerH + rowsH + FOOTER_H + PAD;

  // Para Instagram/WhatsApp, forçar altura fixa
  let totalH = naturalH;
  if (sizeConfig.id === 'instagram') totalH = Math.max(naturalH, 1350);
  if (sizeConfig.id === 'whatsapp') totalH = Math.max(naturalH, 1920);

  const canvas = document.createElement('canvas');
  canvas.width  = CANVAS_W * SCALE;
  canvas.height = totalH  * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  // Fundo
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, CANVAS_W, totalH);

  // Barra lateral accent
  const accentGrad = ctx.createLinearGradient(0, 0, 0, totalH);
  accentGrad.addColorStop(0, theme.accentColor);
  accentGrad.addColorStop(1, theme.headerBg2);
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, 6, totalH);

  let y = PAD;
  const cols = isCompact ? getCompactCols(CANVAS_W) : getCols(CANVAS_W);

  if (isFirstPage) {
    // Header gradiente
    const hGrad = ctx.createLinearGradient(0, 0, CANVAS_W, 0);
    hGrad.addColorStop(0, theme.headerBg1);
    hGrad.addColorStop(1, theme.headerBg2);
    ctx.fillStyle = hGrad;
    roundRect(ctx, PAD, y, CANVAS_W - PAD * 2, LOGO_SECTION - 10, 16);
    ctx.fill();

    // Accent bar no header
    ctx.fillStyle = theme.accentColor;
    roundRect(ctx, PAD, y, 6, LOGO_SECTION - 10, 3);
    ctx.fill();

    // Logo
    if (logoImg) {
      const logoSize = 50;
      const lx = PAD + 20;
      const ly = y + (LOGO_SECTION - 10) / 2 - logoSize / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(lx + logoSize / 2, ly + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(logoImg, lx, ly, logoSize, logoSize);
      ctx.restore();
      ctx.strokeStyle = theme.accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lx + logoSize / 2, ly + logoSize / 2, logoSize / 2 + 1, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Título
    const textX = PAD + (logoImg ? 85 : 20);
    ctx.fillStyle = theme.headerText;
    ctx.font = `bold ${Math.round(22 * fs)}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('BRANCO PERES', textX, y + 38);
    ctx.fillStyle = theme.subtitleText;
    ctx.font = `${Math.round(11 * fs)}px Arial, Helvetica, sans-serif`;
    ctx.fillText('Controle de Lavagem e Lubrificação', textX, y + 56);

    // Info direita
    ctx.textAlign = 'right';
    ctx.fillStyle = theme.metaText;
    ctx.font = `${Math.round(10 * fs)}px Arial, Helvetica, sans-serif`;
    ctx.fillText(`Gerado: ${format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, CANVAS_W - PAD - 16, y + 32);
    ctx.fillText(`Total: ${stats.total} registros`, CANVAS_W - PAD - 16, y + 48);
    ctx.fillText(`Tema: ${theme.emoji} ${theme.name}`, CANVAS_W - PAD - 16, y + 64);

    y += LOGO_SECTION;

    // Stats cards — inclui ANDAMENTO (5º card)
    const statItems = [
      { label: 'ATRASADO',   value: stats.atrasado },
      { label: 'PENDENTE',   value: stats.pendente },
      { label: 'PROGRAMADO', value: stats.programado },
      { label: 'ANDAMENTO',  value: stats.andamento },
      { label: 'ENCERRADO',  value: stats.encerrado },
    ];
    const gap = 10;
    const cardW = (CANVAS_W - PAD * 2 - gap * 4) / 5;
    const cardH = isCompact ? 55 : 65;

    statItems.forEach((item, i) => {
      const cx = PAD + i * (cardW + gap);
      ctx.fillStyle = theme.statBgs[i];
      roundRect(ctx, cx, y, cardW, cardH, 12);
      ctx.fill();
      ctx.strokeStyle = theme.statColors[i] + '40';
      ctx.lineWidth = 1;
      roundRect(ctx, cx, y, cardW, cardH, 12);
      ctx.stroke();

      // Accent top bar
      ctx.fillStyle = theme.statColors[i];
      roundRect(ctx, cx, y, cardW, 4, 2);
      ctx.fill();

      ctx.fillStyle = theme.statColors[i];
      ctx.font = `bold ${Math.round(22 * fs)}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(String(item.value), cx + cardW / 2, y + (isCompact ? 28 : 33));
      ctx.font = `bold ${Math.round(9 * fs)}px Arial, Helvetica, sans-serif`;
      ctx.fillText(item.label, cx + cardW / 2, y + (isCompact ? 45 : 52));
    });

    y += cardH + 16;
  } else {
    // Continuation header
    ctx.fillStyle = theme.headerBg1;
    roundRect(ctx, PAD, y, CANVAS_W - PAD * 2, 40, 10);
    ctx.fill();
    ctx.fillStyle = theme.headerText;
    ctx.font = `bold ${Math.round(12 * fs)}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`BRANCO PERES — Página ${pageNum} de ${totalPages}`, PAD + 16, y + 26);
    y += 52;
  }

  // Table header
  ctx.fillStyle = theme.tableHeader;
  roundRect(ctx, PAD, y, CANVAS_W - PAD * 2, headerH, 8);
  ctx.fill();

  let xCol = PAD;
  cols.forEach(col => {
    ctx.fillStyle = theme.tableHeaderText;
    ctx.font = `bold ${Math.round(10 * fs)}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = col.align;
    const xText = col.align === 'center' ? xCol + col.w / 2 : xCol + 6;
    ctx.fillText(col.label, xText, y + headerH / 2 + 4);
    xCol += col.w;
  });
  y += headerH;

  // Table rows
  rows.forEach((row, idx) => {
    // Alternating bg
    if (idx % 2 === 1) {
      ctx.fillStyle = theme.tableAlt;
      ctx.fillRect(PAD, y, CANVAS_W - PAD * 2, rowH);
    }

    // Separator
    ctx.strokeStyle = theme.separatorColor;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(PAD, y + rowH);
    ctx.lineTo(CANVAS_W - PAD, y + rowH);
    ctx.stroke();

    const data = isCompact
      ? [row.frota, row.tipoPreventiva, row.descricaoPonto, formatDate(row.dataProgramada), row.horarioAgendado || '—', STATUS_STYLE[row.situacao]?.label || row.situacao, row.observacao || '']
      : [row.frota, row.tipoPreventiva, row.descricaoPonto, formatDate(row.dataProgramada), row.horarioAgendado || '—', formatDate(row.dataRealizada), STATUS_STYLE[row.situacao]?.label || row.situacao, row.observacao || ''];

    xCol = PAD;
    cols.forEach((col, colIdx) => {
      const xText = col.align === 'center' ? xCol + col.w / 2 : xCol + 6;
      ctx.textAlign = col.align;

      // Frota badge
      if (colIdx === 0) {
        const bw = Math.min(col.w - 10, 48);
        const bh = rowH - 10;
        const type = resolveEquipmentImage(row); const picture = type ? typeImages.get(type.key) : undefined;
        const bx = picture ? xCol + col.w - bw - 5 : xCol + (col.w - bw) / 2;
        if(picture) { const r=Math.min(Math.max(20,col.w-bw-12)/picture.width,(rowH-6)/picture.height); ctx.save();ctx.beginPath();ctx.rect(xCol,y,col.w,rowH);ctx.clip();ctx.drawImage(picture,xCol+4,y+(rowH-picture.height*r)/2,picture.width*r,picture.height*r);ctx.restore(); }
        const by = y + 5;
        ctx.fillStyle = '#16a34a';
        roundRect(ctx, bx, by, bw, bh, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(10 * fs)}px Arial, Helvetica, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(truncateText(ctx, String(data[0]), bw - 6), bx + bw / 2, y + rowH / 2 + 4);
      }
      // Status badge
      else if ((isCompact && colIdx === 5) || (!isCompact && colIdx === 6)) {
        const statusKey = row.situacao as StatusType;
        const st = STATUS_STYLE[statusKey];
        if (st) {
          const bw = Math.min(col.w - 8, 90);
          const bh = rowH - 10;
          const bx = xCol + (col.w - bw) / 2;
          const by = y + 5;
          ctx.fillStyle = st.bg;
          roundRect(ctx, bx, by, bw, bh, 6);
          ctx.fill();
          ctx.strokeStyle = st.border;
          ctx.lineWidth = 0.8;
          roundRect(ctx, bx, by, bw, bh, 6);
          ctx.stroke();
          ctx.fillStyle = st.color;
          ctx.font = `bold ${Math.round(9 * fs)}px Arial, Helvetica, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(st.label, bx + bw / 2, y + rowH / 2 + 3);
        }
      }
      // Observação
      else if ((isCompact && colIdx === 6) || (!isCompact && colIdx === 7)) {
        const obsIdx = isCompact ? 6 : 7;
        const obs = String(data[obsIdx] || '');
        if (obs) {
          const bx = xCol + 3;
          const bw = col.w - 6;
          const bh = rowH - 10;
          const by = y + 5;
          ctx.fillStyle = '#fef3c7';
          roundRect(ctx, bx, by, bw, bh, 5);
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 0.8;
          roundRect(ctx, bx, by, bw, bh, 5);
          ctx.stroke();
          ctx.fillStyle = '#92400e';
          ctx.font = `bold ${Math.round(8 * fs)}px Arial, Helvetica, sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText(truncateText(ctx, obs, bw - 10), bx + 5, y + rowH / 2 + 3);
        } else {
          ctx.fillStyle = theme.tableSubText;
          ctx.font = `${Math.round(9 * fs)}px Arial, Helvetica, sans-serif`;
          ctx.fillText('—', xText, y + rowH / 2 + 3);
        }
      } else {
        const text = truncateText(ctx, String(data[colIdx] || ''), col.w - 8);
        ctx.fillStyle = colIdx === 1 ? theme.tableText : theme.tableSubText;
        ctx.font = `${Math.round(10 * fs)}px Arial, Helvetica, sans-serif`;
        ctx.fillText(text, xText, y + rowH / 2 + 4);
      }

      xCol += col.w;
    });

    y += rowH;
  });

  // Footer
  const footerY = Math.max(y + 4, totalH - FOOTER_H - PAD);
  const fGrad = ctx.createLinearGradient(PAD, footerY, CANVAS_W - PAD, footerY);
  fGrad.addColorStop(0, theme.footerBg1);
  fGrad.addColorStop(1, theme.footerBg2);
  ctx.fillStyle = fGrad;
  roundRect(ctx, PAD, footerY, CANVAS_W - PAD * 2, FOOTER_H - 8, 10);
  ctx.fill();

  ctx.fillStyle = theme.footerText;
  ctx.font = `${Math.round(9 * fs)}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(
    `BRANCO PERES Agro  ·  Controle de Lavagem e Lubrificação  ·  ${format(now, 'yyyy')}   |   Pág. ${pageNum}/${totalPages}   |   ${stats.total} reg.`,
    CANVAS_W / 2, footerY + 24
  );

  // Accent dots
  ctx.fillStyle = theme.accentColor;
  ctx.beginPath(); ctx.arc(PAD + 20, footerY + 24, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(CANVAS_W - PAD - 20, footerY + 24, 3, 0, Math.PI * 2); ctx.fill();

  return canvas.toDataURL('image/png');
}

async function generatePagePremium(
  rows: Programacao[],
  stats: { atrasado: number; pendente: number; programado: number; encerrado: number; andamento: number; total: number },
  logoImg: HTMLImageElement | null,
  pageNum: number,
  totalPages: number,
  now: Date,
  theme: ThemeConfig,
  sizeConfig: SizeConfig
): Promise<string> {
  const typeMedia = await preloadEquipmentImages(rows);
  assertEquipmentReportImagesLoaded(rows,typeMedia);
  const typeImages = new Map<string, HTMLImageElement>();
  await Promise.all([...typeMedia].map(async ([key, item]) => { const img = await loadLogo(item.dataUrl); if(img) typeImages.set(key,img); }));
  const CANVAS_W = sizeConfig.width;
  const SCALE = sizeConfig.scale;
  const fs = sizeConfig.fontScale;
  const isCompact = sizeConfig.id !== 'original';
  const isFirstPage = pageNum === 1;
  const contentW = CANVAS_W - PAD * 2;
  const rowGap = isCompact ? 4 : 6;
  const rowH = isCompact ? 30 : 36;
  const headerH = isCompact ? 38 : 44;
  const heroH = isFirstPage ? (isCompact ? 108 : 124) : 64;
  const statsH = isFirstPage ? (isCompact ? 72 : 84) : 0;
  const topSectionH = isFirstPage ? heroH + statsH + 18 : 76;
  const rowsH = rows.length > 0 ? (rows.length * rowH) + ((rows.length - 1) * rowGap) : 0;
  const footerBoxH = 46;

  let totalH = PAD + topSectionH + headerH + rowsH + footerBoxH + PAD + 16;
  if (sizeConfig.id === 'instagram') totalH = Math.max(totalH, 1350);
  if (sizeConfig.id === 'whatsapp') totalH = Math.max(totalH, 1920);

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W * SCALE;
  canvas.height = totalH * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  const bgGrad = ctx.createLinearGradient(0, 0, CANVAS_W, totalH);
  bgGrad.addColorStop(0, theme.bg);
  bgGrad.addColorStop(0.52, theme.bgAlt);
  bgGrad.addColorStop(1, withAlpha(theme.headerBg2, 0.98));
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CANVAS_W, totalH);

  const glowLeft = ctx.createRadialGradient(PAD * 2, PAD * 1.6, 0, PAD * 2, PAD * 1.6, CANVAS_W * 0.7);
  glowLeft.addColorStop(0, withAlpha(theme.accentColor, 0.20));
  glowLeft.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowLeft;
  ctx.fillRect(0, 0, CANVAS_W, totalH);

  const glowRight = ctx.createRadialGradient(CANVAS_W - PAD, PAD, 0, CANVAS_W - PAD, PAD, CANVAS_W * 0.55);
  glowRight.addColorStop(0, withAlpha(theme.headerText, 0.10));
  glowRight.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowRight;
  ctx.fillRect(0, 0, CANVAS_W, totalH);

  ctx.strokeStyle = withAlpha(theme.headerText, 0.06);
  ctx.lineWidth = 1;
  roundRect(ctx, PAD - 10, PAD - 10, contentW + 20, totalH - (PAD * 2) + 20, 30);
  ctx.stroke();

  let y = PAD;
  const cols = isCompact ? getCompactCols(CANVAS_W) : getCols(CANVAS_W);

  if (isFirstPage) {
    const headerX = PAD;
    const headerY = y;
    const headerW = contentW;

    const headerGrad = ctx.createLinearGradient(headerX, headerY, headerX + headerW, headerY + heroH);
    headerGrad.addColorStop(0, theme.headerBg1);
    headerGrad.addColorStop(0.5, theme.accentColor);
    headerGrad.addColorStop(1, theme.headerBg2);

    ctx.save();
    ctx.shadowColor = withAlpha(theme.headerBg2, 0.45);
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = headerGrad;
    roundRect(ctx, headerX, headerY, headerW, heroH, 24);
    ctx.fill();
    ctx.restore();

    const headerShine = ctx.createLinearGradient(headerX, headerY, headerX, headerY + heroH);
    headerShine.addColorStop(0, withAlpha('#ffffff', 0.16));
    headerShine.addColorStop(0.22, withAlpha('#ffffff', 0.04));
    headerShine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = headerShine;
    roundRect(ctx, headerX, headerY, headerW, heroH, 24);
    ctx.fill();

    ctx.fillStyle = withAlpha('#ffffff', 0.10);
    roundRect(ctx, headerX + 24, headerY + 16, headerW * 0.38, 16, 8);
    ctx.fill();

    const logoOrbSize = isCompact ? 68 : 78;
    const logoCenterX = headerX + 28 + logoOrbSize / 2;
    const logoCenterY = headerY + heroH / 2;

    const logoOrbGrad = ctx.createLinearGradient(
      logoCenterX - logoOrbSize / 2,
      logoCenterY - logoOrbSize / 2,
      logoCenterX + logoOrbSize / 2,
      logoCenterY + logoOrbSize / 2
    );
    logoOrbGrad.addColorStop(0, withAlpha('#ffffff', 0.24));
    logoOrbGrad.addColorStop(1, withAlpha(theme.bg, 0.22));

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = logoOrbGrad;
    drawCircle(ctx, logoCenterX, logoCenterY, logoOrbSize / 2);
    ctx.fill();
    ctx.restore();

    ctx.lineWidth = 2;
    ctx.strokeStyle = withAlpha('#ffffff', 0.22);
    drawCircle(ctx, logoCenterX, logoCenterY, logoOrbSize / 2);
    ctx.stroke();

    ctx.lineWidth = 3;
    ctx.strokeStyle = withAlpha(theme.accentColor, 0.65);
    drawCircle(ctx, logoCenterX, logoCenterY, logoOrbSize / 2 - 5);
    ctx.stroke();

    if (logoImg) {
      const logoSize = logoOrbSize - 20;
      const lx = logoCenterX - logoSize / 2;
      const ly = logoCenterY - logoSize / 2;
      ctx.save();
      drawCircle(ctx, logoCenterX, logoCenterY, logoSize / 2);
      ctx.clip();
      ctx.drawImage(logoImg, lx, ly, logoSize, logoSize);
      ctx.restore();
    } else {
      ctx.fillStyle = theme.headerText;
      ctx.font = `bold ${Math.round(22 * fs)}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('BP', logoCenterX, logoCenterY + 7);
    }

    const titleX = headerX + 28 + logoOrbSize + 26;
    ctx.textAlign = 'left';
    ctx.fillStyle = theme.headerText;
    ctx.font = `bold ${Math.round((isCompact ? 24 : 30) * fs)}px Arial, Helvetica, sans-serif`;
    ctx.fillText('BRANCO PERES', titleX, headerY + (isCompact ? 42 : 50));

    ctx.fillStyle = theme.subtitleText;
    ctx.font = `${Math.round((isCompact ? 11 : 13) * fs)}px Arial, Helvetica, sans-serif`;
    ctx.fillText('Controle de Lavagem e Lubrificação', titleX, headerY + (isCompact ? 62 : 70));

    const metaW = isCompact ? 246 : 286;
    const metaH = isCompact ? 72 : 82;
    const metaX = headerX + headerW - metaW - 20;
    const metaY = headerY + (heroH - metaH) / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = withAlpha(theme.bg, 0.16);
    roundRect(ctx, metaX, metaY, metaW, metaH, 18);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = withAlpha('#ffffff', 0.16);
    ctx.lineWidth = 1;
    roundRect(ctx, metaX, metaY, metaW, metaH, 18);
    ctx.stroke();

    const metaRows: Array<[string, string]> = [
      ['Gerado em', format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })],
      ['Registros', `${stats.total} totais`],
      ['Tema', theme.name],
    ];

    metaRows.forEach(([label, value], index) => {
      const rowY = metaY + 18 + (index * 21);
      ctx.fillStyle = withAlpha(theme.headerText, 0.70);
      ctx.font = `${Math.round(8 * fs)}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(label.toUpperCase(), metaX + 16, rowY);
      ctx.fillStyle = theme.headerText;
      ctx.font = `bold ${Math.round(9 * fs)}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(value, metaX + metaW - 16, rowY);

      if (index < metaRows.length - 1) {
        ctx.strokeStyle = withAlpha('#ffffff', 0.10);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(metaX + 14, rowY + 8);
        ctx.lineTo(metaX + metaW - 14, rowY + 8);
        ctx.stroke();
      }
    });

    y += heroH + 18;

    const statItems = [
      { label: 'ATRASADO',   value: stats.atrasado,   color: theme.statColors[0], bg: theme.statBgs[0] },
      { label: 'PENDENTE',   value: stats.pendente,   color: theme.statColors[1], bg: theme.statBgs[1] },
      { label: 'PROGRAMADO', value: stats.programado, color: theme.statColors[2], bg: theme.statBgs[2] },
      { label: 'ANDAMENTO',  value: stats.andamento,  color: theme.statColors[3], bg: theme.statBgs[3] },
      { label: 'ENCERRADO',  value: stats.encerrado,  color: theme.statColors[4], bg: theme.statBgs[4] },
    ];

    const gap = 12;
    const cardW = (contentW - gap * 4) / 5;
    const cardH = statsH;

    statItems.forEach((item, index) => {
      const cardX = PAD + index * (cardW + gap);
      const cardGrad = ctx.createLinearGradient(cardX, y, cardX, y + cardH);
      cardGrad.addColorStop(0, item.bg);
      cardGrad.addColorStop(1, withAlpha(theme.bgAlt, 0.96));

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.14)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = cardGrad;
      roundRect(ctx, cardX, y, cardW, cardH, 20);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = withAlpha(item.color, 0.30);
      ctx.lineWidth = 1.2;
      roundRect(ctx, cardX, y, cardW, cardH, 20);
      ctx.stroke();

      const band = ctx.createLinearGradient(cardX, y, cardX + cardW, y);
      band.addColorStop(0, item.color);
      band.addColorStop(1, theme.accentColor);
      ctx.fillStyle = band;
      roundRect(ctx, cardX, y, cardW, 6, 3);
      ctx.fill();

      ctx.fillStyle = withAlpha(item.color, 0.16);
      drawCircle(ctx, cardX + 18, y + 22, 7);
      ctx.fill();

      ctx.fillStyle = item.color;
      ctx.textAlign = 'left';
      ctx.font = `bold ${Math.round(9 * fs)}px Arial, Helvetica, sans-serif`;
      ctx.fillText(item.label, cardX + 32, y + 26);

      ctx.font = `bold ${Math.round((isCompact ? 24 : 28) * fs)}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(String(item.value), cardX + 18, y + (isCompact ? 52 : 58));

      const percentage = stats.total > 0 ? `${Math.round((item.value / stats.total) * 100)}% do total` : '0% do total';
      ctx.fillStyle = withAlpha(item.color, 0.80);
      ctx.font = `${Math.round(8 * fs)}px Arial, Helvetica, sans-serif`;
      ctx.fillText(percentage, cardX + 18, y + cardH - 14);
    });

    y += cardH + 22;
  } else {
    const continuationGrad = ctx.createLinearGradient(PAD, y, CANVAS_W - PAD, y + heroH);
    continuationGrad.addColorStop(0, theme.headerBg1);
    continuationGrad.addColorStop(1, theme.headerBg2);

    ctx.save();
    ctx.shadowColor = withAlpha(theme.headerBg2, 0.30);
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = continuationGrad;
    roundRect(ctx, PAD, y, contentW, heroH, 18);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = theme.headerText;
    ctx.font = `bold ${Math.round(14 * fs)}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('BRANCO PERES · Continuação do relatório', PAD + 18, y + 28);
    ctx.fillStyle = theme.subtitleText;
    ctx.font = `${Math.round(9 * fs)}px Arial, Helvetica, sans-serif`;
    ctx.fillText(`Página ${pageNum} de ${totalPages}`, PAD + 18, y + 46);

    ctx.textAlign = 'right';
    ctx.fillStyle = theme.headerText;
    ctx.font = `bold ${Math.round(9 * fs)}px Arial, Helvetica, sans-serif`;
    ctx.fillText(format(now, 'dd/MM/yyyy', { locale: ptBR }), CANVAS_W - PAD - 18, y + 28);
    ctx.fillStyle = theme.subtitleText;
    ctx.font = `${Math.round(8 * fs)}px Arial, Helvetica, sans-serif`;
    ctx.fillText(`${stats.total} registros`, CANVAS_W - PAD - 18, y + 46);

    y += heroH + 12;
  }

  const tableX = PAD;
  const tableW = contentW;
  const tableHeadGrad = ctx.createLinearGradient(tableX, y, tableX + tableW, y + headerH);
  tableHeadGrad.addColorStop(0, theme.tableHeader);
  tableHeadGrad.addColorStop(1, theme.headerBg2);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = tableHeadGrad;
  roundRect(ctx, tableX, y, tableW, headerH, 14);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = withAlpha(theme.headerText, 0.10);
  ctx.lineWidth = 1;
  roundRect(ctx, tableX, y, tableW, headerH, 14);
  ctx.stroke();

  let xCol = tableX;
  cols.forEach(col => {
    ctx.fillStyle = theme.tableHeaderText;
    ctx.font = `bold ${Math.round(10 * fs)}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = col.align;
    const xText = col.align === 'center' ? xCol + col.w / 2 : xCol + 10;
    ctx.fillText(col.label, xText, y + headerH / 2 + 4);
    xCol += col.w;
  });
  y += headerH + 8;

  rows.forEach((row, idx) => {
    const rowY = y;
    const statusTheme = STATUS_STYLE[row.situacao as StatusType];
    const rowFill = idx % 2 === 0 ? withAlpha(theme.tableBg, 0.88) : withAlpha(theme.tableAlt, 0.94);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = rowFill;
    roundRect(ctx, tableX, rowY, tableW, rowH, 12);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = withAlpha(theme.separatorColor, 0.60);
    ctx.lineWidth = 1;
    roundRect(ctx, tableX, rowY, tableW, rowH, 12);
    ctx.stroke();

    const data = isCompact
      ? [row.frota, row.tipoPreventiva, row.descricaoPonto, formatDate(row.dataProgramada), row.horarioAgendado || '—', STATUS_STYLE[row.situacao]?.label || row.situacao, row.observacao || '']
      : [row.frota, row.tipoPreventiva, row.descricaoPonto, formatDate(row.dataProgramada), row.horarioAgendado || '—', formatDate(row.dataRealizada), STATUS_STYLE[row.situacao]?.label || row.situacao, row.observacao || ''];

    xCol = tableX;
    cols.forEach((col, colIdx) => {
      const xText = col.align === 'center' ? xCol + col.w / 2 : xCol + 10;
      ctx.textAlign = col.align;

      if (colIdx === 0) {
        const badgeW = Math.min(col.w - 16, 58);
        const badgeH = rowH - 12;
        const type = resolveEquipmentImage(row); const picture = type ? typeImages.get(type.key) : undefined;
        const badgeX = picture ? xCol + col.w - badgeW - 5 : xCol + (col.w - badgeW) / 2;
        if(picture) { const r=Math.min(Math.max(20,col.w-badgeW-12)/picture.width,(rowH-6)/picture.height); ctx.save();roundRect(ctx,xCol,rowY,col.w,rowH,8);ctx.clip();ctx.drawImage(picture,xCol+4,rowY+(rowH-picture.height*r)/2,picture.width*r,picture.height*r);ctx.restore(); }
        const badgeY = rowY + 6;
        const fleetGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + badgeH);
        fleetGrad.addColorStop(0, theme.headerBg1);
        fleetGrad.addColorStop(1, theme.accentColor);
        ctx.fillStyle = fleetGrad;
        roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);
        ctx.fill();
        ctx.strokeStyle = withAlpha('#ffffff', 0.12);
        ctx.lineWidth = 1;
        roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(10 * fs)}px Arial, Helvetica, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(truncateText(ctx, String(data[0]), badgeW - 8), badgeX + badgeW / 2, rowY + rowH / 2 + 4);
      } else if ((isCompact && colIdx === 5) || (!isCompact && colIdx === 6)) {
        const statusKey = row.situacao as StatusType;
        const st = STATUS_STYLE[statusKey];
        if (st) {
          const badgeW = Math.min(col.w - 12, 96);
          const badgeH = rowH - 12;
          const badgeX = xCol + (col.w - badgeW) / 2;
          const badgeY = rowY + 6;
          ctx.fillStyle = st.bg;
          roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);
          ctx.fill();
          ctx.strokeStyle = withAlpha(st.border, 0.95);
          ctx.lineWidth = 1;
          roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);
          ctx.stroke();
          ctx.fillStyle = st.color;
          ctx.font = `bold ${Math.round(9 * fs)}px Arial, Helvetica, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(st.label, badgeX + badgeW / 2, rowY + rowH / 2 + 3);
        }
      } else if ((isCompact && colIdx === 6) || (!isCompact && colIdx === 7)) {
        const obsIdx = isCompact ? 6 : 7;
        const obs = String(data[obsIdx] || '');
        if (obs) {
          const noteX = xCol + 5;
          const noteW = col.w - 10;
          const noteH = rowH - 12;
          const noteY = rowY + 6;
          ctx.fillStyle = theme.accentLight;
          roundRect(ctx, noteX, noteY, noteW, noteH, 8);
          ctx.fill();
          ctx.strokeStyle = withAlpha(theme.accentColor, 0.40);
          ctx.lineWidth = 1;
          roundRect(ctx, noteX, noteY, noteW, noteH, 8);
          ctx.stroke();
          ctx.fillStyle = theme.tableText;
          ctx.font = `bold ${Math.round(8 * fs)}px Arial, Helvetica, sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText(truncateText(ctx, obs, noteW - 12), noteX + 7, rowY + rowH / 2 + 3);
        } else {
          ctx.fillStyle = theme.tableSubText;
          ctx.font = `${Math.round(9 * fs)}px Arial, Helvetica, sans-serif`;
          ctx.fillText('—', xText, rowY + rowH / 2 + 3);
        }
      } else {
        const text = truncateText(ctx, String(data[colIdx] || ''), col.w - 12);
        const isMainText = colIdx === 1 || colIdx === 5;
        ctx.fillStyle = isMainText ? theme.tableText : theme.tableSubText;
        ctx.font = `${isMainText ? 'bold' : 'normal'} ${Math.round(10 * fs)}px Arial, Helvetica, sans-serif`;
        ctx.fillText(text, xText, rowY + rowH / 2 + 4);
      }

      xCol += col.w;
    });

    y += rowH + rowGap;
  });

  const footerY = Math.max(y + 10, totalH - footerBoxH - PAD);
  const footerGrad = ctx.createLinearGradient(PAD, footerY, CANVAS_W - PAD, footerY + footerBoxH);
  footerGrad.addColorStop(0, theme.footerBg1);
  footerGrad.addColorStop(1, theme.footerBg2);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.16)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = footerGrad;
  roundRect(ctx, PAD, footerY, contentW, footerBoxH, 16);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = withAlpha('#ffffff', 0.10);
  ctx.lineWidth = 1;
  roundRect(ctx, PAD, footerY, contentW, footerBoxH, 16);
  ctx.stroke();

  ctx.fillStyle = withAlpha(theme.headerText, 0.14);
  roundRect(ctx, PAD + 14, footerY + 11, 124, 22, 11);
  ctx.fill();
  ctx.fillStyle = theme.footerText;
  ctx.font = `bold ${Math.round(9 * fs)}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('BRANCO PERES Agro', PAD + 76, footerY + 25);

  ctx.textAlign = 'center';
  ctx.fillStyle = theme.footerText;
  ctx.font = `${Math.round(9 * fs)}px Arial, Helvetica, sans-serif`;
  ctx.fillText('Controle de Lavagem e Lubrificação', CANVAS_W / 2, footerY + 19);
  ctx.font = `bold ${Math.round(9 * fs)}px Arial, Helvetica, sans-serif`;
  ctx.fillText(`${stats.total} registros · Página ${pageNum}/${totalPages}`, CANVAS_W / 2, footerY + 32);

  ctx.textAlign = 'right';
  ctx.font = `${Math.round(8 * fs)}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = withAlpha(theme.footerText, 0.90);
  ctx.fillText(format(now, 'dd/MM/yyyy', { locale: ptBR }), CANVAS_W - PAD - 16, footerY + 26);

  ctx.fillStyle = theme.accentColor;
  drawCircle(ctx, PAD + 156, footerY + 22, 3);
  ctx.fill();
  drawCircle(ctx, CANVAS_W - PAD - 118, footerY + 22, 3);
  ctx.fill();

  return canvas.toDataURL('image/png');
}

// ─── Gerar todas as páginas ──────────────────────────────────────────────────
async function generateAllPages(
  rows: Programacao[],
  stats: { atrasado: number; pendente: number; programado: number; encerrado: number; andamento: number; total: number },
  now: Date,
  theme: ThemeConfig,
  sizeConfig: SizeConfig
): Promise<string[]> {
  const logoImg = await loadLogo('/logo.png');
  const totalPages = Math.max(1, Math.ceil(rows.length / sizeConfig.maxRowsPerPage));
  const pages: string[] = [];

  for (let p = 1; p <= totalPages; p++) {
    const start = (p - 1) * sizeConfig.maxRowsPerPage;
    const end   = Math.min(start + sizeConfig.maxRowsPerPage, rows.length);
    const pageRows = rows.slice(start, end);
      const pageUrl  = await generatePagePremium(pageRows, stats, logoImg, p, totalPages, now, theme, sizeConfig);

    pages.push(pageUrl);
  }

  return pages;
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function Exportar({ schedules }: Props) {
  const { isDark } = useTheme();
  const reportMode = 'operacional';
  const [statusFilter, setStatusFilter] = useState<StatusType | ''>('');
  const [pcmFilters, setPCMFilters] = useState<PCMReportFilters>({ tipo: '', origem: 'PCM', apoio: '', semana: '' });
  const apoioOptions = useMemo(() => Array.from(new Map(schedules.filter(row => row.apoioId).map(row => [row.apoioId!, row.apoioNome || row.apoioId!])).entries()).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')), [schedules]);
  const serviceOptions = useMemo(() => [...new Set(schedules.map(row => row.tipoPreventiva))].sort(), [schedules]);
  const [generating, setGenerating] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const [pagesDate, setPagesDate] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const [genSuccess, setGenSuccess] = useState<string | null>(null);
  const [exportTheme, setExportTheme] = useState<ExportTheme>('light');
  const [exportSize, setExportSize] = useState<ExportSize>('original');
  const [pdfLayout, setPdfLayout] = useState<PdfExportLayout>(() => readStoredPdfLayout());

  const [clock, setClock] = useState(() => Date.now());
  const now = useMemo(() => new Date(clock), [clock]);
  const dailyWindow = useMemo(() => getDailyExportWindow(now), [now]);
  const closedWindowStart = useMemo(() => getLubricationClosedWindowStart(now), [now]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const selectRowsForExport = (exportTime: Date) => selectLubricationExportSchedules(schedules, exportTime, {
    status: statusFilter, filters: pcmFilters,
  });
  const filtered = useMemo(() => selectRowsForExport(now), [schedules, pcmFilters, reportMode, statusFilter, now]);
  const stats = useMemo(() => getDailyExportStats(filtered), [filtered]);
  const reportSignature = JSON.stringify([reportMode, statusFilter, pcmFilters, getDailyExportWindowKey(now), filtered.map(row => [row.id, row.frota, row.descricaoPonto, row.tipoPreventiva, row.dataProgramada, row.horarioAgendado, row.situacao, row.dataRealizada, row.observacao])]);
  useEffect(() => { setPages([]); setPagesDate(''); setGenSuccess(null); }, [reportSignature]);

  const currentSizeConfig = SIZE_CONFIGS.find(s => s.id === exportSize) || SIZE_CONFIGS[0];
  const totalPngPages = Math.max(1, Math.ceil(filtered.length / currentSizeConfig.maxRowsPerPage));

  // ─── Gerar PNG ─────────────────────────────────────────────────────────────
  const handleGenerateImage = async () => {
    setGenerating(true); setGenError(null); setPages([]); setGenSuccess(null); setCurrentPage(0);
    try {
      const now = new Date();
      const filtered = selectRowsForExport(now);
      const stats = getDailyExportStats(filtered);
      setClock(now.getTime());
      const theme = THEMES[exportTheme];
      const result = await generateAllPages(filtered, stats, now, theme, currentSizeConfig);
      if (getDailyExportWindowKey(new Date()) !== getDailyExportWindowKey(now)) {
        setClock(Date.now());
        throw new Error('A janela operacional mudou durante a geração. Gere novamente para aplicar o corte das 07:10.');
      }
      setPages(result);
      setPagesDate(getDailyExportWindowKey(now));
      const filterInfo = filtered.length < schedules.length ? ` (filtrados de ${schedules.length})` : '';
      const sizeLabel = currentSizeConfig.label;
      setGenSuccess(`${result.length > 1 ? `${result.length} páginas geradas` : 'Imagem gerada'} — ${sizeLabel} — ${filtered.length} registros${filterInfo}`);
    } catch (err: any) {
      setGenError(`Erro ao gerar imagem: ${err.message}`);
    } finally { setGenerating(false); }
  };

  // ─── Baixar todas as páginas ───────────────────────────────────────────────
  const downloadAll = () => {
    const now = new Date();
    if (pagesDate !== getDailyExportWindowKey(now)) {
      setClock(now.getTime()); setPages([]); setPagesDate('');
      setGenError('A janela operacional mudou. Gere novamente para aplicar a virada das 07:10 e o corte atualizado.');
      return;
    }
    const dateStr = format(now, 'dd-MM-yyyy');
    pages.forEach((dataUrl, i) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = pages.length === 1
        ? `branco-peres-${reportMode}-${exportTheme}-${exportSize}-${dateStr}.png`
        : `branco-peres-${reportMode}-${exportTheme}-${exportSize}-${dateStr}-pag${i + 1}de${pages.length}.png`;
      a.click();
    });
  };

  // ─── Gerar PDF Estruturado ─────────────────────────────────────────────────
  const handleGeneratePdf = async () => {
    setGeneratingPdf(true); setGenError(null); setGenSuccess(null);
    try {
      const now = new Date();
      const filtered = selectRowsForExport(now);
      const stats = getDailyExportStats(filtered);
      setClock(now.getTime());

      if (getDailyExportWindowKey(new Date()) !== getDailyExportWindowKey(now)) {
        setClock(Date.now());
        throw new Error('A janela operacional mudou durante a geração. Gere o PDF novamente.');
      }

      const apoioLabels = Object.fromEntries(apoioOptions);
      const { pageCount } = await exportLubricationStructuredPdf({
        rows: filtered,
        stats,
        theme: THEMES[exportTheme],
        layout: pdfLayout,
        now,
        reportMode,
        filterDescriptor: {
          statusFilter,
          pcmFilters,
          apoioLabels,
        },
      });

      const layoutLabel = pdfLayout === 'detalhado' ? 'Detalhado' : 'Simplificado';
      const filterInfo = filtered.length < schedules.length ? ` (filtrados de ${schedules.length})` : '';
      setGenSuccess(`PDF ${layoutLabel} gerado com ${filtered.length} registros${filterInfo} em ${pageCount} página(s)`);
    } catch (err: any) {
      setGenError(`Erro ao gerar PDF: ${err.message}`);
    } finally { setGeneratingPdf(false); }
  };

  const shareWhatsApp = () => {
    const stats = getDailyExportStats(selectRowsForExport(new Date()));
    const text = encodeURIComponent(
      `🏭 *BRANCO PERES — Lavagem e Lubrificação*\n` +
      `📅 ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}\n\n` +
      `🔴 Atrasado: ${stats.atrasado}\n🟡 Pendente: ${stats.pendente}\n` +
      `🔵 Programado: ${stats.programado}\n🟣 Em Andamento: ${stats.andamento}\n` +
      `✅ Encerrado: ${stats.encerrado}\n\nTotal: ${stats.total} registros`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const th = THEMES[exportTheme];

  return (
    <div className={`space-y-5 fade-in max-w-5xl ${isDark ? 'text-white' : ''}`}>

      {/* Cabeçalho */}
      <div>
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Exportar Relatório</h2>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Gere imagem PNG ou PDF com <strong>{filtered.length} registros</strong>
          {filtered.length < schedules.length && <span className={isDark ? ' text-amber-400' : ' text-amber-600'}> (filtrados de {schedules.length})</span>}
          {totalPngPages > 1 && <span className={isDark ? ' text-blue-400' : ' text-blue-600'}> — PNG dividido em {totalPngPages} páginas</span>}
        </p>
      </div>

      <div className={`px-4 py-3 rounded-xl text-sm border ${isDark ? 'bg-green-950/30 border-green-800 text-green-200' : 'bg-green-50 border-green-200 text-green-900'}`}>
        <strong>Relatório operacional + encerradas da janela das 07:00</strong>
        <p className="mt-1">Atrasadas de datas anteriores, serviços em andamento e programações de <strong>{formatDate(dailyWindow.today)}</strong> até <strong>{formatDate(dailyWindow.nextDay)} às {dailyWindow.hideClosed ? '07:00' : '07:10'}</strong>, inclusive. Horário de Brasília.</p>
        <p className="mt-1 text-xs"><strong>Encerradas também entram:</strong> ordens encerradas desde as 07:00 de <strong>{closedWindowStart ? formatDate(closedWindowStart.toISOString().slice(0,10)) : formatDate(dailyWindow.today)}</strong> (início desta janela operacional atual) até o horário da geração, em Brasília, respeitando os filtros abaixo. Se o relatório for gerado antes das 07:00, a janela começou às 07:00 do dia anterior e continua após a meia-noite. A ocultação na tela e o corte das 07:10 não removem encerradas do relatório. Escolha Situação: Encerrado para exportar somente elas. PCM usa o horário de detecção de encerramento; registros manuais legados usam a data realizada e o horário registrado na programação.</p>
        <p className="mt-1 text-xs">Ordens abertas de datas posteriores ao limite e pendentes não entram. Encerradas anteriores ao início desta janela operacional não entram. Antes das 07:00, o início é às 07:00 do dia anterior; às 07:00 a janela reinicia. A tela de controle continua mostrando as programações dos demais dias. Programados antigos aparecem como atrasados somente no arquivo; o banco não é alterado. Para incluir lançamentos manuais, escolha Origem: Todas.</p>
      </div>

      {/* Painel de controles */}
      <div className={`rounded-2xl border p-5 shadow-sm space-y-5 ${isDark ? 'glass-card' : 'bg-white border-gray-200'}`}>

        {/* Filtros */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <Filter size={15} /> Filtros
            </h3>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-xs">Situação<select aria-label="Situação do relatório" value={statusFilter} onChange={event => { setStatusFilter(event.target.value as StatusType | ''); setPages([]); setGenSuccess(null); }} className={`block mt-1 border rounded-lg px-3 py-2 text-sm ${isDark ? 'glass-input' : 'bg-white border-gray-300 text-gray-900'}`}><option value="">Todas</option>{(Object.keys(STATUS_STYLE) as StatusType[]).filter(status => status !== 'PENDENTE').map(status => <option key={status} value={status}>{status === 'ANDAMENTO' ? 'Em andamento' : STATUS_STYLE[status].label}</option>)}</select></label>
            <label className="text-xs">Serviço<select value={pcmFilters.tipo} onChange={event => { setPCMFilters(current => ({ ...current, tipo: event.target.value })); setPages([]); setGenSuccess(null); }} className={`block mt-1 border rounded-lg px-3 py-2 text-sm ${isDark ? 'glass-input' : 'bg-white border-gray-300 text-gray-900'}`}><option value="">Todos</option>{serviceOptions.map(tipo => <option key={tipo}>{tipo}</option>)}</select></label>
            <label className="text-xs">Origem<select value={pcmFilters.origem} onChange={event => { setPCMFilters(current => ({ ...current, origem: event.target.value })); setPages([]); setGenSuccess(null); }} className={`block mt-1 border rounded-lg px-3 py-2 text-sm ${isDark ? 'glass-input' : 'bg-white border-gray-300 text-gray-900'}`}><option value="">Todas</option><option value="PCM">Automáticas · PCM</option><option value="MANUAL">Manuais</option></select></label>
            <label className="text-xs">Grupo Apoio<select value={pcmFilters.apoio} onChange={event => { setPCMFilters(current => ({ ...current, apoio: event.target.value })); setPages([]); setGenSuccess(null); }} className={`block mt-1 border rounded-lg px-3 py-2 text-sm ${isDark ? 'glass-input' : 'bg-white border-gray-300 text-gray-900'}`}><option value="">Todos</option>{apoioOptions.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></label>
            {(pcmFilters.tipo || pcmFilters.origem !== 'PCM' || pcmFilters.apoio || statusFilter) && <button className="text-xs underline py-2" onClick={() => { setPCMFilters({ tipo: '', origem: 'PCM', apoio: '', semana: '' }); setStatusFilter(''); setPages([]); setGenSuccess(null); }}>Restaurar filtros · PCM</button>}
          </div>
        </div>

        {/* Seletor de Tamanho */}
        <div>
          <label className={`text-xs font-semibold flex items-center gap-1.5 mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <Smartphone size={13} /> Tamanho da Imagem
          </label>
          <div className="flex gap-2 flex-wrap">
            {SIZE_CONFIGS.map(s => (
              <button
                key={s.id}
                onClick={() => { setExportSize(s.id); setPages([]); setGenSuccess(null); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                  exportSize === s.id
                    ? isDark
                      ? 'border-[var(--brand-green)] shadow-lg scale-105 bg-[var(--bg-tertiary)]'
                      : 'border-green-500 shadow-lg scale-105 bg-green-50'
                    : isDark
                      ? 'border-white/10 hover:border-white/30 bg-[var(--bg-tertiary)]'
                      : 'border-gray-200 hover:border-gray-400 bg-white'
                }`}
              >
                {s.id === 'original' && <Monitor size={16} className={isDark ? 'text-gray-400' : 'text-gray-500'} />}
                {s.id === 'instagram' && <Instagram size={16} className="text-pink-500" />}
                {s.id === 'whatsapp' && <Smartphone size={16} className="text-green-500" />}
                <div className="text-left">
                  <div className={isDark ? 'text-[var(--text-primary)]' : 'text-gray-900'}>{s.label}</div>
                  <div className={`text-[10px] font-normal ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-400'}`}>{s.description}</div>
                </div>
                {exportSize === s.id && <span className="text-green-500 ml-1">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Seletor de Tema */}
        <div>
          <label className={`text-xs font-semibold flex items-center gap-1.5 mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <Palette size={13} /> Tema do Relatório
          </label>
          <div className="flex gap-2 flex-wrap">
            {(Object.values(THEMES) as ThemeConfig[]).map(t => (
              <button
                key={t.id}
                onClick={() => { setExportTheme(t.id); setPages([]); setGenSuccess(null); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                  exportTheme === t.id
                    ? 'border-green-500 shadow-lg scale-105'
                    : isDark ? 'border-white/10 hover:border-white/30' : 'border-gray-200 hover:border-gray-400'
                }`}
                style={{
                  background: t.bg,
                  color: t.titleText,
                  boxShadow: exportTheme === t.id ? `0 4px 16px ${t.accentColor}44` : undefined,
                }}
              >
                <span>{t.emoji}</span>
                <span style={{ color: t.titleText }}>{t.name}</span>
                {exportTheme === t.id && <span style={{ color: t.accentColor }}>✓</span>}
              </button>
            ))}
          </div>
          {exportTheme !== 'light' && (
            <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Tema <strong>{th.emoji} {th.name}</strong> selecionado
            </p>
          )}
        </div>

        {/* Layout do PDF */}
        <div>
          <label className={`text-xs font-semibold flex items-center gap-1.5 mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <FileText size={13} /> Layout do PDF Estruturado
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PDF_LAYOUT_OPTIONS.map((option) => {
              const selected = pdfLayout === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setPdfLayout(option.id);
                    saveStoredPdfLayout(option.id);
                    setGenSuccess(null);
                  }}
                  className={`flex items-start justify-between gap-3 px-4 py-3 rounded-xl text-left border-2 transition-all ${
                    selected
                      ? isDark
                        ? 'border-[var(--brand-green)] bg-[var(--bg-tertiary)] shadow-lg'
                        : 'border-emerald-600 bg-emerald-50 shadow-sm'
                      : isDark
                        ? 'border-white/10 hover:border-white/25 bg-[var(--bg-tertiary)]/60'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {option.label}
                    </div>
                    <div className={`text-[11px] mt-0.5 leading-snug ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {option.description}
                    </div>
                  </div>
                  {selected && (
                    <span className={`text-xs font-bold shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleGenerateImage}
            disabled={generating || filtered.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-all shadow-md hover:shadow-green-500/30"
          >
            <Image size={15} className={generating ? 'animate-pulse' : ''} />
            {generating ? `Gerando… (${filtered.length} reg.)` : `Gerar PNG${totalPngPages > 1 ? ` (${totalPngPages} pág.)` : ''}`}
          </button>
          <button
            onClick={handleGeneratePdf}
            disabled={generatingPdf || filtered.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-all shadow-md hover:shadow-red-500/30"
          >
            <FileText size={15} className={generatingPdf ? 'animate-pulse' : ''} />
            {generatingPdf ? 'Gerando…' : `Gerar PDF (${pdfLayout === 'detalhado' ? 'Detalhado' : 'Simplificado'})`}
          </button>
          <button
            onClick={shareWhatsApp}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-all shadow-md"
            title="Compartilhar no WhatsApp"
          >
            <Share2 size={15} /> WhatsApp
          </button>
        </div>
      </div>

      {/* Mensagens */}
      {genError && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-red-950/30 border border-red-800/40 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          <AlertTriangle size={16} />
          {genError}
        </div>
      )}
      {genSuccess && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${isDark ? 'bg-green-950/30 border border-green-800/40 text-green-400' : 'bg-green-50 border border-green-200 text-green-700'}`}>
          <CheckCircle size={16} />
          {genSuccess}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 tabular-nums">
        {[
          { label: 'Atrasado',   value: stats.atrasado,   bg: isDark ? 'bg-red-950/30' : 'bg-red-50',   border: isDark ? 'border-red-800/30' : 'border-red-200',   text: isDark ? 'text-red-400' : 'text-red-700',   num: isDark ? 'text-red-300' : 'text-red-800' },
          { label: 'Pendente',   value: stats.pendente,   bg: isDark ? 'bg-amber-950/30' : 'bg-amber-50', border: isDark ? 'border-amber-800/30' : 'border-amber-200', text: isDark ? 'text-amber-400' : 'text-amber-700', num: isDark ? 'text-amber-300' : 'text-amber-800' },
          { label: 'Programado', value: stats.programado, bg: isDark ? 'bg-blue-950/30' : 'bg-blue-50',  border: isDark ? 'border-blue-800/30' : 'border-blue-200',  text: isDark ? 'text-blue-400' : 'text-blue-700',  num: isDark ? 'text-blue-300' : 'text-blue-800' },
          { label: 'Andamento',  value: stats.andamento ?? 0, bg: isDark ? 'bg-purple-950/30' : 'bg-purple-50', border: isDark ? 'border-purple-800/30' : 'border-purple-200', text: isDark ? 'text-purple-400' : 'text-purple-700', num: isDark ? 'text-purple-300' : 'text-purple-800' },
          { label: 'Encerrado',  value: stats.encerrado,  bg: isDark ? 'bg-green-950/30' : 'bg-green-50', border: isDark ? 'border-green-800/30' : 'border-green-200', text: isDark ? 'text-green-400' : 'text-green-700', num: isDark ? 'text-green-300' : 'text-green-800' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 text-center border ${s.bg} ${s.border}`}>
            <div className={`text-3xl font-black ${s.num}`}>{s.value}</div>
            <div className={`text-xs font-semibold mt-1 ${s.text}`}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Preview */}
      {pages.length > 0 && (
        <div className={`rounded-2xl border p-4 ${isDark ? 'glass-card' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Preview — Página {currentPage + 1} de {pages.length}
              <span className={`text-xs font-normal ml-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                ({currentSizeConfig.label})
              </span>
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className={`p-1.5 border rounded-lg disabled:opacity-50 ${isDark ? 'border-white/10 text-gray-400' : 'border-gray-300'}`}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))}
                disabled={currentPage === pages.length - 1}
                className={`p-1.5 border rounded-lg disabled:opacity-50 ${isDark ? 'border-white/10 text-gray-400' : 'border-gray-300'}`}
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={downloadAll}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors shadow-md"
              >
                <Download size={14} /> Baixar {pages.length > 1 ? `${pages.length} arquivos` : 'arquivo'}
              </button>
            </div>
          </div>
          <div className={`max-h-[600px] overflow-y-auto rounded-xl border ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
            <img src={pages[currentPage]} alt={`Página ${currentPage + 1}`} className="w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
