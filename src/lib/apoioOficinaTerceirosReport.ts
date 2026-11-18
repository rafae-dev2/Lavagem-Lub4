import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import type { ApoioReportRow } from '../types/apoio';
import { downloadIllustratedExcel } from './equipmentExcel';
import {
  isEquipmentStorageImage,
  refreshEquipmentImageOverrides,
  resolveCustomEquipmentImage,
} from './equipmentImageRegistry';
import { preloadEquipmentImages, resolveEquipmentImage } from './equipmentImages';
import { reportDate } from './apoioReportData';
import { createLogoWatermarkDataUrl } from './reportWatermark';
import {
  buildOficinaTerceirosExcelData,
  OFICINA_REPORT_FORMATS,
  OFICINA_TERCEIROS_IMAGE,
  normalizeOficinaFormat,
  normalizeOficinaQuality,
  oficinaReportFilenameBase,
  oficinaReportTitle,
  oficinaTerceirosSummary,
  resolveOficinaRenderDimensions,
  type OficinaReportFormat,
  type OficinaReportQuality,
  type OficinaTerceirosEntry,
  type OficinaTerceirosScope,
} from './apoioOficinaTerceirosData';

/**
 * Relatório em imagem "Equipamentos em Oficina de Terceiros" (e variações
 * com emergenciais em Oficina Interna / Campo, separado ou junto).
 *
 * Suporta modos Celular (921 px), Tablet (1240 px) e Computador (1680 px)
 * com controle de qualidade de renderização (Padrão 1×, Alta 2×, Ultra).
 * Quando nenhuma opção é informada, preserva o padrão 921 × 1600 px (1×).
 */
export interface OficinaTerceirosOptions {
  /** Cores dos grupos Apoio (nome → cor) usadas como identificação da linha. */
  groupColors?: Record<string, string>;
  generatedAt?: Date;
  scope?: OficinaTerceirosScope;
  format?: OficinaReportFormat;
  quality?: OficinaReportQuality;
}
export interface OficinaTerceirosProgress { phase: string; current: number; total: number; }

const PAGE_W = OFICINA_TERCEIROS_IMAGE.width;
const PAGE_H = OFICINA_TERCEIROS_IMAGE.height;
/** Limite de altura da imagem única (~70 linhas) para não travar o navegador. */
export const OFICINA_TERCEIROS_MAX_HEIGHT = 12000;
const PADDING = 32;
const GREEN = '#1F6B45';
const DARK = '#14482F';
const EMERALD_ACCENT = '#34D399';
const AMBER = '#B45309';
const BORDER = '#C8E1D2';
const INK = '#15241C';
const MUTED = '#50675B';
const FONT = 'Arial, Helvetica, sans-serif';

// Fundo vetorial executivo para o cabeçalho (preserva o verde profundo nos cantos do logotipo).
const BACKGROUND = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="360" viewBox="0 0 1280 360">` +
  `<defs>` +
  `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0E3723"/><stop offset=".48" stop-color="#1A5C3B"/><stop offset="1" stop-color="#277A50"/></linearGradient>` +
  `<filter id="b"><feGaussianBlur stdDeviation="46"/></filter>` +
  `<pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.045)" stroke-width="1"/></pattern>` +
  `</defs>` +
  `<rect width="1280" height="360" fill="url(#g)"/>` +
  `<rect width="1280" height="360" fill="url(#grid)"/>` +
  `<g filter="url(#b)" opacity=".36"><ellipse cx="1060" cy="40" rx="250" ry="155" fill="#A7F3D0"/><ellipse cx="420" cy="310" rx="260" ry="155" fill="#2E8B57"/></g>` +
  `<circle cx="1160" cy="70" r="175" fill="none" stroke="rgba(167,243,208,0.14)" stroke-width="2"/>` +
  `<circle cx="1160" cy="70" r="128" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" stroke-dasharray="8 6"/>` +
  `</svg>`,
);

interface TableColumnSpec {
  key: 'frota' | 'modelo' | 'prestador' | 'categoria';
  label: string;
  width: string;
}

function columnsForLayout(scope: OficinaTerceirosScope, format: OficinaReportFormat): readonly TableColumnSpec[] {
  if (format === 'computador') {
    if (scope !== 'externa') {
      return [
        { key: 'frota', label: 'Equipamento', width: '20%' },
        { key: 'modelo', label: 'Modelo', width: '33%' },
        { key: 'prestador', label: 'Prestador / Local', width: '29%' },
        { key: 'categoria', label: 'Tipo de Atendimento', width: '18%' },
      ];
    }
    return [
      { key: 'frota', label: 'Equipamento', width: '21%' },
      { key: 'modelo', label: 'Modelo', width: '39%' },
      { key: 'prestador', label: 'Prestador', width: '40%' },
    ];
  }
  return [
    { key: 'frota', label: 'Equipamento', width: '22%' },
    { key: 'modelo', label: 'Modelo', width: '40%' },
    { key: 'prestador', label: scope === 'externa' ? 'Prestador' : 'Prestador / Local', width: '38%' },
  ];
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  css: Partial<CSSStyleDeclaration>,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  Object.assign(element.style, css);
  if (text !== undefined) element.textContent = text;
  return element;
}

function tint(color: string | undefined, alpha: number): string | null {
  const value = String(color ?? '').trim();
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (!match) return null;
  const hex = match[1].length === 3
    ? match[1].split('').map(char => char + char).join('')
    : match[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function solidColor(color: string | undefined, fallback: string): string {
  const value = String(color ?? '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : fallback;
}

function logoElement(size: number): HTMLImageElement {
  // Logotipo transparente direto sobre o gradiente esmeralda (sem caixa branca).
  const logo = node('img', {
    width: `${size}px`,
    height: `${size}px`,
    objectFit: 'contain',
    flexShrink: '0',
    filter: 'drop-shadow(0 8px 18px rgba(0,0,0,.32))',
  });
  logo.src = new URL('/logo.png', window.location.href).href;
  logo.alt = 'Branco Peres Agro';
  return logo;
}

function buildKpiCards(entries: readonly OficinaTerceirosEntry[], scope: OficinaTerceirosScope) {
  if (scope === 'emergencia') {
    const interna = entries.filter(e => e.categoria === 'emergencial_interna').length;
    const campo = entries.filter(e => e.categoria === 'emergencial_campo').length;
    return [
      { label: 'Total Emergencial', value: String(entries.length), accent: AMBER, tint: 'rgba(255, 251, 235, 0.88)' },
      { label: 'Oficina Interna', value: String(interna), accent: GREEN, tint: 'rgba(255, 255, 255, 0.86)' },
      { label: 'Atendimento Campo', value: String(campo), accent: '#0F766E', tint: 'rgba(255, 255, 255, 0.86)' },
    ];
  }
  if (scope === 'juntos') {
    const terceiros = entries.filter(e => e.categoria !== 'emergencial_interna' && e.categoria !== 'emergencial_campo').length;
    const emergenciais = entries.length - terceiros;
    return [
      { label: 'Total Consolidado', value: String(entries.length), accent: DARK, tint: 'rgba(240, 253, 244, 0.88)' },
      { label: 'Oficina de Terceiros', value: String(terceiros), accent: GREEN, tint: 'rgba(255, 255, 255, 0.86)' },
      { label: 'Emergenciais (Int. / Campo)', value: String(emergenciais), accent: AMBER, tint: 'rgba(255, 251, 235, 0.88)' },
    ];
  }
  // Para 'externa', nunca mencionar "Oficina Interna" ou "Campo" nos rótulos.
  const oficinas = new Set(entries.map(e => e.prestador.toLocaleLowerCase('pt-BR'))).size;
  const grupos = new Set(entries.map(e => e.grupo).filter(Boolean)).size;
  return [
    { label: 'Equipamentos Parados', value: String(entries.length), accent: DARK, tint: 'rgba(240, 253, 244, 0.88)' },
    { label: 'Oficinas Terceiras', value: String(oficinas), accent: GREEN, tint: 'rgba(255, 255, 255, 0.86)' },
    { label: 'Grupos de Frota', value: String(grupos || 1), accent: '#047857', tint: 'rgba(255, 255, 255, 0.86)' },
  ];
}

function scopeBadgeText(scope: OficinaTerceirosScope): string {
  if (scope === 'emergencia') return 'ATENDIMENTO EMERGENCIAL';
  if (scope === 'juntos') return 'VISÃO CONSOLIDADA';
  return 'MANUTENÇÃO EXTERNA';
}

function entryCategoryTag(entry: OficinaTerceirosEntry): string {
  if (entry.categoria === 'emergencial_interna') return 'Emergencial · Oficina Interna';
  if (entry.categoria === 'emergencial_campo') return 'Emergencial · Campo';
  return 'Oficina Externa';
}

export interface OficinaTerceirosLayout {
  root: HTMLDivElement;
  page: HTMLDivElement;
  width: number;
  /** Altura final da imagem em CSS px. */
  height: number;
  format: OficinaReportFormat;
  destroy: () => void;
}

/**
 * Monta a imagem única com acabamento executivo e marca d'água transparente do
 * logotipo da empresa atrás do relatório nos formatos Celular, Tablet ou Computador.
 */
export async function buildOficinaTerceirosPage(
  entries: readonly OficinaTerceirosEntry[],
  options: OficinaTerceirosOptions = {},
): Promise<OficinaTerceirosLayout> {
  if (!entries.length) throw new Error('Nenhum equipamento marcado para o relatório.');
  const scope: OficinaTerceirosScope = options.scope ?? 'externa';
  const format: OficinaReportFormat = normalizeOficinaFormat(options.format);
  const spec = OFICINA_REPORT_FORMATS[format];
  const pageWidth = spec.width ?? PAGE_W;
  const pageMinHeight = spec.minHeight ?? PAGE_H;
  const paddingX = format === 'computador' ? 42 : format === 'tablet' ? 38 : PADDING;
  const paddingY = format === 'computador' ? 32 : format === 'tablet' ? 36 : PADDING;
  const isWide = format === 'computador';
  const isTablet = format === 'tablet';

  const generated = reportDate((options.generatedAt ?? new Date()).toISOString(), true);
  const columns = columnsForLayout(scope, format);
  const summaryMeta = oficinaTerceirosSummary(entries, scope);
  const entryImageInput = (entry: OficinaTerceirosEntry) => ({
    frota: entry.frota,
    apoio: entry.grupo,
    grupo_id: entry.grupo_id,
    grupo_fonte: entry.grupo_fonte,
    modelo: entry.modelo,
    equipamento: entry.equipamento,
  });
  await refreshEquipmentImageOverrides().catch(() => undefined);
  const [watermarkAsset, equipmentImages] = await Promise.all([
    createLogoWatermarkDataUrl('/logo.png', {
      alpha: 0.135,
      size: isWide ? 620 : isTablet ? 600 : 560,
      withFrameRings: true,
      ringColor: 'rgba(20, 72, 47, 0.15)',
    }),
    preloadEquipmentImages(entries.map(entryImageInput)),
  ]);

  const root = node('div', {
    position: 'fixed',
    left: '-20000px',
    top: '0',
    width: `${pageWidth}px`,
    pointerEvents: 'none',
    zIndex: '-1',
  });
  document.body.append(root);

  const page = node('div', {
    position: 'relative',
    width: `${pageWidth}px`,
    minHeight: `${pageMinHeight}px`,
    boxSizing: 'border-box',
    padding: `${paddingY}px ${paddingX}px`,
    display: 'flex',
    flexDirection: 'column',
    gap: isWide ? '18px' : '18px',
    background: 'linear-gradient(180deg, #F3F8F5 0%, #EAF3ED 52%, #F5FAF7 100%)',
    color: INK,
    fontFamily: FONT,
  });

  // Cabeçalho executivo em camadas
  const header = node('header', {
    position: 'relative',
    zIndex: '2',
    flexShrink: '0',
    borderRadius: '24px',
    overflow: 'hidden',
    backgroundImage: `url("${BACKGROUND}")`,
    backgroundSize: 'cover',
    backgroundColor: GREEN,
    color: '#FFFFFF',
    border: '1px solid rgba(255,255,255,.26)',
    boxShadow: '0 14px 34px rgba(14,55,35,.22)',
    padding: isWide ? '24px 34px 22px' : isTablet ? '28px 34px 26px' : '28px 30px 26px',
    display: 'flex',
    flexDirection: 'column',
    gap: isWide ? '14px' : '18px',
  });

  // Filete superior metálico-esmeralda
  header.append(node('div', {
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    height: '4px',
    background: 'linear-gradient(90deg, #34D399 0%, #A7F3D0 50%, #10B981 100%)',
  }));

  const topRow = node('div', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  });
  const brand = node('div', { display: 'flex', alignItems: 'center', gap: '18px', minWidth: '0' });
  brand.append(logoElement(isWide ? 82 : isTablet ? 94 : 90));
  const brandText = node('div', { minWidth: '0' });
  brandText.append(node('div', {
    fontSize: '16px',
    letterSpacing: '2.8px',
    fontWeight: '700',
    color: '#FFFFFF',
  }, 'BRANCO PERES AGRO'));
  brandText.append(node('div', {
    fontSize: '15px',
    marginTop: '5px',
    color: 'rgba(236, 253, 245, 0.90)',
  }, 'Controle de Equipamentos — Apoio'));
  brand.append(brandText);

  const scopeBadge = node('div', {
    flexShrink: '0',
    padding: '8px 14px',
    borderRadius: '10px',
    background: 'rgba(10, 40, 25, 0.42)',
    border: '1px solid rgba(167, 243, 208, 0.35)',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '1.6px',
    color: '#BDF6CF',
    textTransform: 'uppercase',
  }, scopeBadgeText(scope));

  topRow.append(brand, scopeBadge);
  header.append(topRow);

  const titleBlock = node('div', { minWidth: '0' });
  titleBlock.append(node('div', {
    fontSize: '11px',
    letterSpacing: '2.6px',
    fontWeight: '700',
    color: '#A7F3D0',
    textTransform: 'uppercase',
  }, 'RELATÓRIO DE MANUTENÇÃO'));
  titleBlock.append(node('h1', {
    fontSize: '32px',
    lineHeight: '1.15',
    fontWeight: '700',
    margin: '8px 0 0',
    letterSpacing: '-.4px',
    textTransform: 'uppercase',
    color: '#FFFFFF',
  }, oficinaReportTitle(scope)));
  header.append(titleBlock);

  const meta = node('div', {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    padding: '11px 16px',
    borderRadius: '12px',
    background: 'rgba(9, 34, 21, 0.36)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    fontSize: '14px',
    color: 'rgba(240, 253, 244, 0.96)',
  });
  meta.append(node('span', { fontWeight: '600' }, `Gerado em ${generated}`));
  meta.append(node('span', { fontWeight: '700', color: '#D1FAE5' }, summaryMeta));
  header.append(meta);

  // Área principal com camada de marca d'água transparente do logotipo atrás dos cards e tabela
  const body = node('div', {
    position: 'relative',
    flex: '1 0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  });

  if (watermarkAsset.dataUrl) {
    const watermarkCount = Math.max(1, Math.min(4, Math.floor(entries.length / 16) + 1));
    const watermarkLayer = node('div', {
      position: 'absolute',
      inset: '0',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: '0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: watermarkCount === 1 ? 'center' : 'space-evenly',
      padding: '32px 0',
    });
    for (let w = 0; w < watermarkCount; w += 1) {
      const wmImg = node('img', {
        width: watermarkCount === 1 ? '540px' : '460px',
        height: watermarkCount === 1 ? '540px' : '460px',
        objectFit: 'contain',
        userSelect: 'none',
        flexShrink: '0',
      });
      wmImg.src = watermarkAsset.dataUrl;
      wmImg.alt = '';
      watermarkLayer.append(wmImg);
    }
    body.append(watermarkLayer);
  }

  // Faixa de KPIs executivos
  const kpiCards = buildKpiCards(entries, scope);
  const kpiStrip = node('div', {
    position: 'relative',
    zIndex: '1',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '12px',
    flexShrink: '0',
  });
  kpiCards.forEach((kpi) => {
    const card = node('div', {
      position: 'relative',
      overflow: 'hidden',
      borderRadius: '14px',
      border: `1px solid ${BORDER}`,
      background: kpi.tint,
      padding: '14px 16px 13px',
      boxShadow: '0 4px 14px rgba(20, 72, 47, 0.05)',
    });
    card.append(node('div', {
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      height: '3px',
      background: kpi.accent,
    }));
    card.append(node('div', {
      fontSize: '28px',
      lineHeight: '1.1',
      fontWeight: '700',
      color: kpi.accent,
      fontVariantNumeric: 'tabular-nums',
    }, kpi.value));
    card.append(node('div', {
      marginTop: '4px',
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '.4px',
      textTransform: 'uppercase',
      color: MUTED,
    }, kpi.label));
    kpiStrip.append(card);
  });
  body.append(kpiStrip);

  // Tabela translúcida para a marca d'água do logotipo permanecer sutilmente visível atrás do relatório
  const table = node('div', {
    position: 'relative',
    zIndex: '1',
    borderRadius: '18px',
    overflow: 'hidden',
    border: `1px solid ${BORDER}`,
    background: 'rgba(255, 255, 255, 0.42)',
    boxShadow: '0 10px 26px rgba(20,72,47,.07)',
    flexShrink: '0',
  });

  const head = node('div', {
    display: 'flex',
    background: `linear-gradient(90deg, ${DARK} 0%, ${GREEN} 60%, #24784E 100%)`,
    color: '#FFFFFF',
    borderBottom: `2px solid ${EMERALD_ACCENT}`,
  });
  columns.forEach(column => {
    head.append(node('div', {
      width: column.width,
      flexShrink: '0',
      boxSizing: 'border-box',
      padding: '15px 14px',
      fontSize: '13px',
      fontWeight: '700',
      letterSpacing: '.6px',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }, column.label));
  });

  const tbody = node('div', { display: 'flex', flexDirection: 'column' });
  entries.forEach((entry, index) => {
    const isEmergencyEntry = entry.categoria === 'emergencial_interna' || entry.categoria === 'emergencial_campo';
    const rawGroupColor = options.groupColors?.[entry.grupo];
    const railColor = isEmergencyEntry ? '#D97706' : solidColor(rawGroupColor, GREEN);
    const background = tint(rawGroupColor, 0.085)
      ?? (isEmergencyEntry
        ? 'rgba(255, 247, 237, 0.62)'
        : index % 2
          ? 'rgba(240, 249, 244, 0.50)'
          : 'rgba(255, 255, 255, 0.48)');

    const row = node('div', {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      background,
      borderTop: index ? `1px solid ${BORDER}` : 'none',
      borderLeft: `5px solid ${railColor}`,
      boxSizing: 'border-box',
      flexShrink: '0',
    });
    row.dataset.oficinaTerceirosRow = 'true';

    const cellPad = isWide ? '13px 16px' : isTablet ? '15px 16px' : '14px 12px';

    // Coluna 1: Frota + sub-rótulo do grupo
    const col1 = node('div', {
      width: columns[0].width,
      flexShrink: '0',
      boxSizing: 'border-box',
      padding: cellPad,
      minWidth: '0',
    });
    col1.append(node('div', {
      fontSize: isWide ? '22px' : isTablet ? '24px' : '22px',
      fontWeight: '700',
      color: DARK,
      lineHeight: '1.18',
      fontVariantNumeric: 'tabular-nums',
      overflowWrap: 'anywhere',
    }, entry.frota));
    if (entry.grupo) {
      col1.append(node('div', {
        marginTop: '3px',
        fontSize: '12px',
        fontWeight: '700',
        color: MUTED,
        lineHeight: '1.25',
        overflowWrap: 'anywhere',
      }, entry.grupo));
    }

    // Coluna 2: Mini-imagem do equipamento (via registry atual) + descrição (Modelo)
    const imageInput = entryImageInput(entry);
    const resolvedImage = resolveCustomEquipmentImage(imageInput) ?? resolveEquipmentImage(imageInput);
    const loadedImage = resolvedImage ? equipmentImages.get(resolvedImage.key) : null;
    const thumbUrl = loadedImage?.dataUrl || resolvedImage?.src || '';

    const col2 = node('div', {
      width: columns[1].width,
      flexShrink: '0',
      boxSizing: 'border-box',
      padding: cellPad,
      display: 'flex',
      alignItems: 'center',
      gap: isWide ? '12px' : '10px',
      minWidth: '0',
    });
    if (resolvedImage && thumbUrl) {
      const thumbBox = node('div', {
        width: isWide ? '64px' : isTablet ? '60px' : '54px',
        height: isWide ? '44px' : isTablet ? '42px' : '38px',
        flexShrink: '0',
        borderRadius: '10px',
        background: 'rgba(255, 255, 255, 0.88)',
        border: `1px solid ${tint(rawGroupColor, 0.35) ?? 'rgba(31, 107, 69, 0.22)'}`,
        boxShadow: '0 4px 10px -4px rgba(15, 23, 42, 0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      });
      const thumbImg = node('img', {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        display: 'block',
      });
      if (isEquipmentStorageImage(thumbUrl)) thumbImg.crossOrigin = 'anonymous';
      thumbImg.onerror = () => thumbBox.remove();
      thumbImg.src = thumbUrl;
      thumbImg.alt = resolvedImage.label;
      thumbImg.className = 'oficina-equipment-thumb';
      thumbImg.dataset.equipmentKey = resolvedImage.key;
      thumbImg.dataset.equipmentSrc = resolvedImage.src;
      thumbBox.append(thumbImg);
      col2.append(thumbBox);
    }
    col2.append(node('div', {
      minWidth: '0',
      flex: '1 1 auto',
      fontSize: isWide ? '19px' : isTablet ? '21px' : '20px',
      fontWeight: '500',
      color: INK,
      lineHeight: '1.3',
      overflowWrap: 'anywhere',
    }, entry.modelo));

    // Coluna 3: Prestador / Local (+ indicação discreta quando não houver 4ª coluna)
    const hasFourthColumn = columns.length === 4;
    const col3 = node('div', {
      width: columns[2].width,
      flexShrink: '0',
      boxSizing: 'border-box',
      padding: cellPad,
    });
    col3.append(node('div', {
      fontSize: isWide ? '18px' : isTablet ? '20px' : '19px',
      fontWeight: isEmergencyEntry ? '700' : '600',
      color: isEmergencyEntry ? '#92400E' : '#1E4631',
      lineHeight: '1.3',
      overflowWrap: 'anywhere',
    }, entry.prestador));
    if (scope !== 'externa' && !hasFourthColumn) {
      col3.append(node('div', {
        marginTop: '3px',
        fontSize: '12px',
        fontWeight: '700',
        color: isEmergencyEntry ? AMBER : GREEN,
        letterSpacing: '.2px',
      }, entryCategoryTag(entry)));
    }

    row.append(col1, col2, col3);
    if (hasFourthColumn && columns[3]) {
      const col4 = node('div', {
        width: columns[3].width,
        flexShrink: '0',
        boxSizing: 'border-box',
        padding: cellPad,
      });
      col4.append(node('span', {
        display: 'inline-block',
        padding: '6px 12px',
        borderRadius: '999px',
        fontSize: '13px',
        fontWeight: '700',
        background: isEmergencyEntry ? 'rgba(217, 119, 6, 0.14)' : 'rgba(31, 107, 69, 0.12)',
        border: isEmergencyEntry ? '1px solid rgba(180, 83, 9, 0.32)' : '1px solid rgba(31, 107, 69, 0.25)',
        color: isEmergencyEntry ? '#92400E' : DARK,
      }, entryCategoryTag(entry)));
      row.append(col4);
    }
    tbody.append(row);
  });
  table.append(head, tbody);
  body.append(table);

  const footer = node('footer', {
    position: 'relative',
    zIndex: '2',
    flexShrink: '0',
    minHeight: '34px',
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    fontSize: '13px',
    fontWeight: '700',
    color: MUTED,
    paddingTop: '12px',
    borderTop: `1px solid ${BORDER}`,
  });
  footer.append(
    node('span', { letterSpacing: '.6px', color: DARK }, 'BRANCO PERES AGRO · MANUTENÇÃO'),
    node('span', { fontVariantNumeric: 'tabular-nums', color: GREEN }, `${entries.length} ${entries.length === 1 ? 'equipamento' : 'equipamentos'}`),
  );

  page.append(header, body, footer);
  root.append(page);

  try {
    const maxAllowedHeight = spec.maxHeight ?? OFICINA_TERCEIROS_MAX_HEIGHT;
    const needed = Math.max(pageMinHeight, Math.ceil(page.scrollHeight));
    if (needed > maxAllowedHeight) {
      throw new Error('A seleção é grande demais para uma única imagem. Desmarque alguns equipamentos para manter o PNG leve.');
    }
    page.style.height = `${needed}px`;
    page.dataset.imageHeight = String(needed);
    page.dataset.imageWidth = String(pageWidth);
    page.dataset.imageFormat = format;
    if (document.fonts?.ready) await document.fonts.ready;
    await Promise.all(Array.from(root.querySelectorAll('img')).map(image => image.decode().catch(() => undefined)));
    return { root, page, width: pageWidth, height: needed, format, destroy: () => root.remove() };
  } catch (error) {
    root.remove();
    throw error;
  }
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function localStamp(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Renderiza a imagem única no formato e qualidade selecionados
 * (Celular 921 px, Tablet 1240 px ou Computador 1680 px; escala 1×, 2× ou Ultra).
 */
export async function renderOficinaTerceirosPng(
  entries: readonly OficinaTerceirosEntry[],
  options: OficinaTerceirosOptions = {},
  onProgress?: (progress: OficinaTerceirosProgress) => void,
): Promise<{ blob: Blob; width: number; height: number; cssWidth: number; cssHeight: number; scale: number; format: OficinaReportFormat; quality: OficinaReportQuality }> {
  const format = normalizeOficinaFormat(options.format);
  const quality = normalizeOficinaQuality(options.quality, 'padrao');
  const layout = await buildOficinaTerceirosPage(entries, { ...options, format, quality });
  const dims = resolveOficinaRenderDimensions(format, quality, layout.height);
  try {
    onProgress?.({ phase: 'Renderizando imagem', current: 1, total: 1 });
    layout.root.replaceChildren(layout.page);
    const canvas = await html2canvas(layout.page, {
      scale: dims.scale,
      backgroundColor: '#F3F8F5',
      logging: false,
      useCORS: true,
      width: layout.width,
      height: layout.height,
      windowWidth: layout.width,
      windowHeight: layout.height,
    });
    const actualWidth = canvas.width || dims.pixelWidth;
    const actualHeight = canvas.height || dims.pixelHeight;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => (value ? resolve(value) : reject(new Error('Não foi possível gerar o PNG.'))), 'image/png');
    });
    canvas.width = 0;
    canvas.height = 0;
    layout.page.replaceChildren();
    return {
      blob,
      width: actualWidth,
      height: actualHeight,
      cssWidth: layout.width,
      cssHeight: layout.height,
      scale: dims.scale,
      format,
      quality,
    };
  } finally {
    layout.destroy();
  }
}

/** Baixa uma única imagem PNG, direto, sem ZIP. */
export async function exportOficinaTerceirosImages(
  entries: readonly OficinaTerceirosEntry[],
  options: OficinaTerceirosOptions = {},
  onProgress?: (progress: OficinaTerceirosProgress) => void,
): Promise<{ width: number; height: number; count: number; scale: number; format: OficinaReportFormat; quality: OficinaReportQuality }> {
  onProgress?.({ phase: 'Preparando imagem', current: 0, total: 0 });
  const result = await renderOficinaTerceirosPng(entries, options, onProgress);
  const formatSuffix = result.format === 'celular' ? '' : `-${result.format}`;
  const base = `${oficinaReportFilenameBase(options.scope)}${formatSuffix}-${localStamp(options.generatedAt ?? new Date())}`;
  download(result.blob, `${base}.png`);
  return {
    width: result.width,
    height: result.height,
    count: entries.length,
    scale: result.scale,
    format: result.format,
    quality: result.quality,
  };
}

/** Exporta planilha Excel (.xlsx) do relatório respeitando o filtro separado/junto e a seleção atual. */
export async function exportOficinaTerceirosExcel(
  entries: readonly OficinaTerceirosEntry[],
  scopedRows: ApoioReportRow[],
  options: OficinaTerceirosOptions & { query?: string; prestadores?: readonly string[] } = {},
): Promise<{ count: number; orderCount: number }> {
  if (!entries.length) throw new Error('Nenhum equipamento marcado para exportar em Excel.');
  const scope: OficinaTerceirosScope = options.scope ?? 'externa';
  const generatedAt = options.generatedAt ?? new Date();
  const { equipmentRows, orderRows, metaRows } = buildOficinaTerceirosExcelData(entries, scopedRows, {
    scope,
    query: options.query,
    prestadores: options.prestadores,
    generatedAt,
  });

  const workbook = XLSX.utils.book_new();
  const equipmentSheet = XLSX.utils.json_to_sheet(equipmentRows);
  equipmentSheet['!cols'] = [{ wch: 14 }, { wch: 32 }, { wch: 40 }, { wch: 28 }, { wch: 26 }, { wch: 13 }];
  if (equipmentSheet['!ref']) equipmentSheet['!autofilter'] = { ref: equipmentSheet['!ref'] };
  XLSX.utils.book_append_sheet(workbook, equipmentSheet, 'Equipamentos');

  if (orderRows.length) {
    const ordersSheet = XLSX.utils.json_to_sheet(orderRows);
    ordersSheet['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 24 }, { wch: 16 }, { wch: 34 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 52 }];
    if (ordersSheet['!ref']) ordersSheet['!autofilter'] = { ref: ordersSheet['!ref'] };
    XLSX.utils.book_append_sheet(workbook, ordersSheet, 'Ordens vinculadas');
  }

  const metaSheet = XLSX.utils.aoa_to_sheet([['Campo', 'Valor'], ...metaRows]);
  metaSheet['!cols'] = [{ wch: 30 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, metaSheet, 'Filtros e modo');

  const filename = `${oficinaReportFilenameBase(scope)}-${localStamp(generatedAt)}.xlsx`;
  await downloadIllustratedExcel(workbook, scopedRows, filename);
  return { count: entries.length, orderCount: scopedRows.length };
}
