import html2canvas from 'html2canvas';
import type { ApoioReportOptions, ApoioReportRow } from '../types/apoio';
import {
  isEquipmentStorageImage,
  refreshEquipmentImageOverrides,
  resolveCustomEquipmentImage,
} from './equipmentImageRegistry';
import { preloadEquipmentImages, resolveEquipmentImage } from './equipmentImages';
import { reportFleet, reportLocation } from './apoioReportData';

export const APOIO_WHATSAPP_SIZE = { width: 480, height: 900 } as const;
export interface WhatsAppImage { blob: Blob; filename: string; width: number; height: number; }
export interface WhatsAppProgress { phase: string; current: number; total: number; }
export interface WhatsAppLayout { root: HTMLDivElement; pages: HTMLDivElement[]; bodies: HTMLDivElement[]; destroy: () => void; }
export type WhatsAppComposition = 'paginas' | 'unica';

const COLORS = { green: '#0C6548', deep: '#073F30', ink: '#142E25', muted: '#5A6F66', border: '#D8E7DF', paper: '#F2F7F4', external: '#145D73' };
function el<K extends keyof HTMLElementTagNameMap>(tag: K, styles: Partial<CSSStyleDeclaration>, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  Object.assign(element.style, styles);
  if (text !== undefined) element.textContent = text;
  return element;
}
function generatedDate(now: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(now);
}

/** Os filtros definem options.rows, mas seus rótulos nunca aparecem na imagem. */
export async function buildApoioWhatsAppPages(options: ApoioReportOptions, now = new Date(), composition: WhatsAppComposition = 'paginas'): Promise<WhatsAppLayout> {
  if (!options.rows.length) throw new Error('Não há ordens selecionadas para o resumo WhatsApp.');
  await refreshEquipmentImageOverrides().catch(() => undefined);
  const equipmentImages = await preloadEquipmentImages(options.rows).catch(() => new Map());
  const root = el('div', { position: 'fixed', left: '-20000px', top: '0', width: `${APOIO_WHATSAPP_SIZE.width}px`, pointerEvents: 'none', zIndex: '-1' });
  const pages: HTMLDivElement[] = [], bodies: HTMLDivElement[] = [], footerNumbers: HTMLElement[] = [];
  document.body.append(root);
  const destroy = () => root.remove();
  let body!: HTMLDivElement;
  const createPage = () => {
    const page = el('div', { width: '480px', height: composition === 'unica' ? 'auto' : '900px', boxSizing: 'border-box', padding: '22px', background: COLORS.paper, color: COLORS.ink, display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: 'Arial, Helvetica, sans-serif', overflow: 'hidden' });
    page.dataset.whatsappPage = 'true';
    const header = el('header', { flexShrink: '0', padding: '19px 20px', borderRadius: '22px', background: `linear-gradient(125deg, ${COLORS.deep}, ${COLORS.green})`, color: '#FFFFFF' });
    const brand = el('div', { display: 'flex', gap: '11px', alignItems: 'center', marginBottom: '15px' });
    const logo = el('img', { width: '43px', height: '43px', padding: '4px', boxSizing: 'border-box', background: '#FFFFFF', objectFit: 'contain', borderRadius: '12px', flexShrink: '0' });
    logo.src = new URL('/logo.png', window.location.href).href;
    logo.alt = 'Branco Peres Agro';
    const name = el('div', { flex: '1' });
    name.append(el('div', { fontSize: '12px', fontWeight: '700', letterSpacing: '1px' }, 'BRANCO PERES AGRO'));
    name.append(el('div', { fontSize: '11px', marginTop: '4px', color: '#D0ECDE' }, 'CONTROLE DE EQUIPAMENTOS · APOIO'));
    brand.append(logo, name); header.append(brand);
    header.append(el('h1', { fontSize: '29px', lineHeight: '1.1', letterSpacing: '-.7px', margin: '0 0 8px', fontWeight: '700' }, 'Retorno da manutenção'));
    header.append(el('div', { fontSize: '13px', lineHeight: '1.4', color: '#D0ECDE' }, `${options.rows.length} ${options.rows.length === 1 ? 'ordem' : 'ordens'} · ${generatedDate(now)}`));
    body = el('div', { flex: composition === 'unica' ? '0 0 auto' : '1', minHeight: '0', display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' });
    const footer = el('footer', { flexShrink: '0', borderTop: `1px solid ${COLORS.border}`, paddingTop: '13px' });
    footer.append(el('div', { fontSize: '18px', fontWeight: '700', color: COLORS.green, lineHeight: '1.2' }, 'Por favor, informar andamento e previsão.'));
    const bottom = el('div', { marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', fontSize: '11px', color: COLORS.muted });
    bottom.append(el('span', {}, 'Identifique a frota ou OS ao responder.'));
    const number = el('span', { fontWeight: '700', flexShrink: '0' }); footerNumbers.push(number); bottom.append(number); footer.append(bottom);
    page.append(header, body, footer); root.append(page); pages.push(page); bodies.push(body);
  };
  const fits = () => composition === 'unica' || body.scrollHeight <= body.clientHeight + 1;
  function card(row: ApoioReportRow, fragment: string, continuation: boolean): HTMLElement {
    const location = reportLocation(row);
    const external = location === 'Oficina Externa';
    const color = external ? COLORS.external : COLORS.green;
    const item = el('article', { border: `1px solid ${COLORS.border}`, borderLeft: `5px solid ${color}`, borderRadius: '18px', padding: '17px 18px', background: '#FFFFFF', flexShrink: '0', boxShadow: '0 3px 9px rgba(7,63,48,.04)' });
    item.dataset.orderKey = row.chave;
    const top = el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '11px' });
    const fleet = el('div', { minWidth: '0', flex: '1' });
    fleet.append(el('div', { fontSize: '11px', textTransform: 'uppercase', fontWeight: '700', color: COLORS.muted, letterSpacing: '.8px', marginBottom: '4px' }, 'Frota'));
    fleet.append(el('div', { fontSize: '35px', fontWeight: '700', letterSpacing: '-1px', lineHeight: '1.05', overflowWrap: 'anywhere' }, reportFleet(row)));
    const office = el('div', { maxWidth: '190px', textAlign: 'right', overflowWrap: 'anywhere' });
    office.append(el('div', { display: 'inline-block', padding: '7px 10px', borderRadius: '9px', background: external ? '#E7F2F6' : '#E7F3EC', color, fontSize: '15px', lineHeight: '1.2', fontWeight: '700' }, location));
    if (external && row.prestador?.trim()) office.append(el('div', { fontSize: '14px', color: COLORS.muted, marginTop: '6px', lineHeight: '1.25' }, row.prestador.trim()));
    office.append(el('div', { fontSize: '12px', color: COLORS.muted, marginTop: '6px' }, `OS ${row.os || 'não informada'}${continuation ? ' · continuação' : ''}`));
    top.append(fleet, office); item.append(top);
    if (row.ativo === false) item.append(el('div', { fontSize: '13px', lineHeight: '1.3', color: '#995614', background: '#FFF4DF', padding: '6px 8px', marginBottom: '9px', borderRadius: '7px' }, 'Histórico: confirmar situação atual.'));
    item.append(el('div', { fontSize: '11px', color: COLORS.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: '6px' }, continuation ? 'Problema relatado · continuação' : 'Problema relatado'));
    const resolvedImage = !continuation ? (resolveCustomEquipmentImage(row) ?? resolveEquipmentImage(row)) : null;
    const loadedImage = resolvedImage ? equipmentImages.get(resolvedImage.key) : null;
    const thumbUrl = loadedImage?.dataUrl || resolvedImage?.src || '';
    const narrative = el('div', { fontSize: '21px', lineHeight: '1.4', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: COLORS.ink, minWidth: '0', flex: '1 1 auto' }, fragment);
    narrative.dataset.narrative = 'true';
    if (resolvedImage && thumbUrl) {
      const descRow = el('div', { display: 'flex', alignItems: 'flex-start', gap: '11px' });
      const thumbBox = el('div', {
        width: '54px',
        height: '40px',
        flexShrink: '0',
        borderRadius: '10px',
        background: '#F8FBF9',
        border: `1px solid ${COLORS.border}`,
        boxShadow: '0 2px 6px rgba(7,63,48,.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        marginTop: '3px',
      });
      const thumbImg = el('img', { width: '100%', height: '100%', objectFit: 'contain', display: 'block' });
      if (isEquipmentStorageImage(thumbUrl)) thumbImg.crossOrigin = 'anonymous';
      thumbImg.onerror = () => thumbBox.remove();
      thumbImg.src = thumbUrl;
      thumbImg.alt = resolvedImage.label;
      thumbImg.className = 'whatsapp-equipment-thumb';
      thumbImg.dataset.equipmentKey = resolvedImage.key;
      thumbBox.append(thumbImg);
      descRow.append(thumbBox, narrative);
      item.append(descRow);
    } else {
      item.append(narrative);
    }
    return item;
  }
  try {
    await document.fonts.ready;
    createPage();
    if (options.sourceError) {
      body.append(el('div', { flexShrink: '0', padding: '9px 12px', borderRadius: '10px', fontSize: '14px', lineHeight: '1.35', background: '#FFF4DF', color: '#995614' }, 'Atualização pendente. Confirme os dados no aplicativo.'));
    }
    for (const row of options.rows) {
      let remaining = row.narrativa?.trim() || 'Descrição não informada. Solicitar detalhamento.';
      let continuation = false;
      while (remaining) {
        let item = card(row, remaining, continuation); body.append(item);
        if (fits()) break;
        item.remove();
        // Tente manter a ordem inteira na próxima página antes de subdividir.
        if (body.children.length) {
          createPage(); item = card(row, remaining, continuation); body.append(item);
          if (fits()) break;
          item.remove();
        }
        const chars = Array.from(remaining);
        let low = 0, high = chars.length;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          const probe = card(row, chars.slice(0, mid).join(''), continuation); body.append(probe);
          const okay = fits(); probe.remove();
          if (okay) low = mid; else high = mid - 1;
        }
        if (!low) throw new Error('O cabeçalho de uma ordem é extenso demais para o resumo. Use o relatório detalhado ou PDF.');
        let fragment = chars.slice(0, low).join('');
        const lastSpace = fragment.lastIndexOf(' ');
        if (lastSpace > fragment.length * .65) fragment = fragment.slice(0, lastSpace + 1);
        body.append(card(row, fragment, continuation));
        remaining = remaining.slice(fragment.length); continuation = true;
        if (remaining) createPage();
      }
    }
    footerNumbers.forEach((number, index) => { number.textContent = composition === 'unica' ? 'Imagem única' : `${index + 1} / ${pages.length}`; });
    await Promise.all(Array.from(root.querySelectorAll('img')).map(async image => {
      try { await image.decode(); } catch { image.remove(); }
    }));
    // O limite de 900px organiza as páginas; a imagem final termina no conteúdo.
    // Isso evita áreas vazias extensas sem reduzir o tamanho da tipografia.
    pages.forEach((page, index) => {
      bodies[index].style.flex = '0 0 auto';
      page.style.height = 'auto';
    });
    return { root, pages, bodies, destroy };
  } catch (error) { destroy(); throw error; }
}

/** Retorna arquivos para prévia/compartilhamento explícito; não envia ao WhatsApp. */
export async function generateApoioWhatsAppImages(options: ApoioReportOptions, quality: 'alta' | 'ultra' = 'alta', onProgress?: (progress: WhatsAppProgress) => void, composition: WhatsAppComposition = 'paginas'): Promise<WhatsAppImage[]> {
  onProgress?.({ phase: 'Organizando resumo', current: 0, total: 0 });
  const now = new Date();
  const layout = await buildApoioWhatsAppPages(options, now, composition);
  const scale = quality === 'ultra' ? 3 : 2;
  const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const images: WhatsAppImage[] = [];
  try {
    for (let index = 0; index < layout.pages.length; index++) {
      onProgress?.({ phase: 'Gerando PNG para celular', current: index + 1, total: layout.pages.length });
      layout.root.replaceChildren(layout.pages[index]);
      const height = Math.ceil(layout.pages[index].getBoundingClientRect().height);
      if (composition === 'unica' && (height * scale > 16384 || APOIO_WHATSAPP_SIZE.width * height * scale * scale > 16_000_000)) {
        throw new Error('A seleção excede o limite seguro para uma imagem única nesta qualidade. Use qualidade Alta, PDF único ou o modo em páginas. Nenhuma ordem foi cortada.');
      }
      const canvas = await html2canvas(layout.pages[index], { scale, backgroundColor: COLORS.paper, logging: false, useCORS: true, width: APOIO_WHATSAPP_SIZE.width, height, windowWidth: APOIO_WHATSAPP_SIZE.width, windowHeight: height });
      try {
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Não foi possível gerar a imagem PNG.')), 'image/png'));
        const filename = composition === 'unica' ? `apoio-whatsapp-${stamp}-imagem-unica.png` : `apoio-whatsapp-${stamp}-pag${String(index + 1).padStart(2, '0')}de${String(layout.pages.length).padStart(2, '0')}.png`;
        images.push({ blob, filename, width: canvas.width, height: canvas.height });
      } finally { canvas.width = 0; canvas.height = 0; }
      await new Promise(resolve => window.setTimeout(resolve, 0));
    }
    return images;
  } finally { layout.destroy(); }
}

/** Novo modo aditivo: exatamente um PNG com todo o conteúdo selecionado. */
export function generateApoioWhatsAppSingleImage(options: ApoioReportOptions, quality: 'alta' | 'ultra' = 'alta', onProgress?: (progress: WhatsAppProgress) => void): Promise<WhatsAppImage[]> {
  return generateApoioWhatsAppImages(options, quality, onProgress, 'unica');
}
