import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import type { ApoioReportOptions, ApoioReportRow } from '../types/apoio';
import { reportDate, reportLocation, reportGroups, reportDays, reportFleet, reportEquipment, reportProvider } from './apoioReportData';
import { getMaintenanceOrderClosure } from './maintenanceTracking';
import { preloadEquipmentImages, resolveEquipmentImage } from './equipmentImages';
import { assertEquipmentReportImagesLoaded } from './equipmentReportImages';

export type ApoioImageFormat = 'celular' | 'desktop' | 'instagram-feed' | 'instagram-story';
export type ApoioImageQuality = 'alta' | 'ultra';
export interface ImageExportProgress { phase: string; current: number; total: number; }
export const APOIO_IMAGE_FORMATS = {
  celular: { label: 'Celular · vertical 9:16', width: 540, height: 960, ultraScale: 4 },
  desktop: { label: 'Desktop · horizontal 16:9', width: 1280, height: 720, ultraScale: 3 },
  'instagram-feed': { label: 'Instagram · feed 4:5', width: 540, height: 675, ultraScale: 4 },
  'instagram-story': { label: 'Instagram · Stories 9:16', width: 540, height: 960, ultraScale: 4 },
} as const;

// Blur vetorial decorativo: textos e dados são sempre compostos em HTML real.
const BACKGROUND = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="320" viewBox="0 0 1280 320"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#14482F"/><stop offset=".55" stop-color="#1F6B45"/><stop offset="1" stop-color="#2E8B57"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="48"/></filter></defs><rect width="1280" height="320" fill="url(#g)"/><g filter="url(#b)" opacity=".38"><ellipse cx="1020" cy="40" rx="235" ry="160" fill="#B1EBC9"/><ellipse cx="380" cy="290" rx="250" ry="160" fill="#2E8B57"/></g></svg>`);
const INK = '#1B2A22';
const GREEN = '#1F6B45';
const BORDER = '#CFE5D7';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, css: Partial<CSSStyleDeclaration>, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  Object.assign(element.style, css);
  if (text !== undefined) element.textContent = text;
  return element;
}

type EquipmentImageMap = Awaited<ReturnType<typeof preloadEquipmentImages>>;
type CachedEquipmentImage = EquipmentImageMap extends Map<string, infer Entry> ? Entry : never;
type EquipmentCanvasSource = Pick<CachedEquipmentImage, 'image' | 'width' | 'height'> & {
  element: HTMLImageElement;
};

const equipmentImageElements = new Map<string, Promise<HTMLImageElement>>();

async function loadEquipmentImageElement(
  loaded: CachedEquipmentImage,
): Promise<HTMLImageElement> {
  if (typeof Image === 'undefined') {
    throw new Error('Não foi possível preparar as imagens dos equipamentos: Image indisponível no navegador.');
  }
  const cached = equipmentImageElements.get(loaded.image.key);
  if (cached) return cached;

  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error(`A imagem do equipamento “${loaded.image.label}” não possui dimensões válidas.`));
        return;
      }
      resolve(image);
    };
    image.onerror = () => reject(new Error(`Não foi possível preparar a imagem do equipamento “${loaded.image.label}”.`));
    image.src = loaded.dataUrl;
  }).catch((error: unknown) => {
    equipmentImageElements.delete(loaded.image.key);
    throw error;
  });
  equipmentImageElements.set(loaded.image.key, pending);
  return pending;
}

async function equipmentCanvasSource(
  row: ApoioReportRow,
  imageMap: EquipmentImageMap,
): Promise<EquipmentCanvasSource | null> {
  const image = resolveEquipmentImage(row);
  if (!image) return null;
  const loaded = imageMap.get(image.key);
  if (!loaded) return null;
  return {
    ...loaded,
    element: await loadEquipmentImageElement(loaded),
  };
}

function drawEquipmentCanvas(source: EquipmentCanvasSource, wide: boolean): HTMLCanvasElement {
  const width = wide ? 96 : 76;
  const height = wide ? 62 : 52;
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.setAttribute('aria-label', source.image.label);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar o canvas das imagens dos equipamentos.');
  const scale = Math.min(canvas.width / source.width, canvas.height / source.height);
  const drawWidth = source.width * scale;
  const drawHeight = source.height * scale;
  context.drawImage(
    source.element,
    (canvas.width - drawWidth) / 2,
    (canvas.height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  return canvas;
}
function metadata(label: string, value: string): HTMLElement {
  const item = node('div', { minWidth: '0', overflowWrap: 'anywhere' });
  item.append(node('div', { fontSize: '10px', fontWeight: '700', color: '#5F7268', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '4px' }, label));
  item.append(node('div', { fontSize: '13px', lineHeight: '1.4', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }, value));
  return item;
}

function imageOperationalStatus(row: ApoioReportRow): string {
  const closure = getMaintenanceOrderClosure(row);
  const raw = row.status?.trim() || 'Não informado';
  if (closure.status === 'encerrado') {
    const origin = closure.origin === 'ausencia' ? 'ausência validada' : 'status da fonte';
    const detected = closure.detectedAt ? reportDate(closure.detectedAt, false) : 'não informada';
    return `Encerrada · ${origin}\nDetecção: ${detected}\nExecução: não inferida`;
  }
  if (closure.status === 'ausente') return `Outros · Sem confirmação\nStatus bruto: ${raw}`;
  const label = closure.status === 'programado' ? 'Programada' : closure.status === 'andamento' ? 'Em andamento' : 'Outros';
  return `${label}\nStatus bruto: ${raw}`;
}

function imageReportKpis(rows: ApoioReportRow[]): { label: string; value: number }[] {
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
interface Layout { root: HTMLDivElement; pages: HTMLDivElement[]; bodies: HTMLDivElement[]; footers: HTMLElement[]; destroy: () => void; }

/** Composição determinística. Páginas extensas continuam, sem recortar narrativas. */
export async function buildApoioImagePages(options: ApoioReportOptions, format: ApoioImageFormat): Promise<Layout> {
  if (!options.rows.length) throw new Error('Não há ordens selecionadas para exportar.');
  const preset = APOIO_IMAGE_FORMATS[format];
  const wide = format === 'desktop';
  const equipmentImages = await preloadEquipmentImages(options.rows);
  assertEquipmentReportImagesLoaded(options.rows, equipmentImages);
  const root = node('div', { position: 'fixed', left: '-20000px', top: '0', width: `${preset.width}px`, pointerEvents: 'none', zIndex: '-1' });
  const pages: HTMLDivElement[] = [], bodies: HTMLDivElement[] = [];
  const footers: HTMLElement[] = [];
  document.body.append(root);
  const destroy = () => root.remove();
  const generated = reportDate(new Date().toISOString(), true);
  let body: HTMLDivElement;

  const createPage = () => {
    const page = node('div', { width: `${preset.width}px`, height: `${preset.height}px`, boxSizing: 'border-box', padding: wide ? '26px' : '22px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#F5F9F6', color: INK, fontFamily: 'Arial, Helvetica, sans-serif', overflow: 'hidden' });
    const header = node('header', { flexShrink: '0', padding: wide ? '22px 26px' : '20px', borderRadius: '20px', backgroundImage: `url("${BACKGROUND}")`, backgroundSize: 'cover', backgroundColor: GREEN, color: '#FFFFFF', boxShadow: '0 8px 24px rgba(20,72,47,.16)', border: '1px solid rgba(255,255,255,.32)' });
    const brand = node('div', { display: 'flex', alignItems: 'center', gap: '14px' });
    const logo = node('img', { width: wide ? '62px' : '54px', height: wide ? '62px' : '54px', padding: '3px', background: '#FFFFFF', borderRadius: '13px', objectFit: 'contain', boxSizing: 'border-box', flexShrink: '0' });
    logo.src = new URL('/logo.png', window.location.href).href;
    logo.alt = 'Branco Peres Agro';
    const heading = node('div', { flex: '1', minWidth: '0' });
    heading.append(node('div', { fontSize: '10px', letterSpacing: '2px', fontWeight: '700', opacity: '.88', marginBottom: '7px' }, 'BRANCO PERES AGRO · APOIO'));
    heading.append(node('h1', { fontSize: wide ? '28px' : '25px', lineHeight: '1.14', fontWeight: '700', margin: '0', letterSpacing: '-.5px' }, 'Controle de Equipamentos'));
    heading.append(node('div', { fontSize: '11px', lineHeight: '1.5', marginTop: '8px', opacity: '.92', overflowWrap: 'anywhere' }, `${options.rows.length} ${options.rows.length === 1 ? 'ordem selecionada' : 'ordens selecionadas'} · ${generated}`));
    brand.append(logo, heading); header.append(brand);
    body = node('div', { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' });
    const footer = node('footer', { flexShrink: '0', height: '24px', boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '10px', fontWeight: '700', color: '#5F7268', paddingTop: '10px', borderTop: `1px solid ${BORDER}` });
    page.append(header, body, footer); root.append(page);
    pages.push(page); bodies.push(body); footers.push(footer);
  };
  const fits = () => body.scrollHeight <= body.clientHeight + 1;
  const place = (item: HTMLElement) => {
    body.append(item);
    if (!fits()) { item.remove(); createPage(); body.append(item); }
    if (!fits()) throw new Error('Um bloco de informação é grande demais para este formato. Use Desktop ou PDF.');
  };
  try {
    createPage();
    const kpis = node('div', { display: 'grid', gridTemplateColumns: `repeat(${wide ? 7 : 4}, minmax(0, 1fr))`, gap: '8px', flexShrink: '0' });
    imageReportKpis(options.rows).forEach(kpi => {
      const card = node('div', { padding: wide ? '13px 10px' : '12px 8px', borderRadius: '13px', backgroundImage: `url("${BACKGROUND}")`, backgroundSize: 'cover', color: '#FFFFFF', border: '1px solid rgba(255,255,255,.5)', boxShadow: '0 4px 12px rgba(20,72,47,.09)' });
      card.append(node('div', { fontSize: wide ? '28px' : '24px', fontWeight: '700', lineHeight: '1', marginBottom: '7px' }, String(kpi.value)));
      card.append(node('div', { fontSize: '9px', fontWeight: '700', opacity: '.9', lineHeight: '1.3' }, kpi.label));
      kpis.append(card);
    });
    place(kpis);

    const appendLongText = (text: string, makeBlock: (fragment: string, continuation: boolean) => HTMLElement) => {
      let remaining = text || 'Não informado';
      let continuation = false;
      while (remaining) {
        const build = (fragment: string) => makeBlock(fragment, continuation);
        let item = build(remaining); body.append(item);
        if (fits()) break;
        item.remove();
        // Começar outra página antes de subdividir um registro, sempre que possível.
        if (body.children.length) {
          createPage(); item = build(remaining); body.append(item);
          if (fits()) break;
          item.remove();
        }
        let low = 0, high = remaining.length;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          const probe = build(remaining.slice(0, mid)); body.append(probe);
          const ok = fits(); probe.remove();
          if (ok) low = mid; else high = mid - 1;
        }
        if (!low) {
          if (!body.children.length) throw new Error('O cabeçalho deste registro não cabe no formato. Exporte em Desktop ou PDF.');
          createPage(); continue;
        }
        let split = low;
        // Nunca separar os dois elementos UTF-16 de um caractere, como emoji.
        const lastCode = remaining.charCodeAt(split - 1);
        const nextCode = remaining.charCodeAt(split);
        if (lastCode >= 0xD800 && lastCode <= 0xDBFF && nextCode >= 0xDC00 && nextCode <= 0xDFFF) split--;
        if (!split) {
          if (!body.children.length) throw new Error('O texto não cabe neste formato. Exporte em Desktop ou PDF.');
          createPage(); continue;
        }
        const lastSpace = remaining.lastIndexOf(' ', split - 1);
        if (lastSpace > split * .6) split = lastSpace + 1;
        item = build(remaining.slice(0, split)); body.append(item);
        remaining = remaining.slice(split); continuation = true;
        if (remaining) createPage();
      }
    };
    if (options.sourceError) place(node('div', { padding: '10px 13px', color: '#8A5A00', background: '#FDF3DC', borderRadius: '12px', fontSize: '11px', flexShrink: '0' }, 'Atualização pendente: consulte o aplicativo antes de tomar decisões.'));

    for (const row of reportGroups(options.rows, options.preserveRowOrder).flatMap(group => group.rows)) {
      const equipmentVisual = await equipmentCanvasSource(row, equipmentImages);
      const makeCard = (fragment: string, continuation: boolean) => {
        const card = node('article', { padding: wide ? '15px 18px' : '15px', border: `1px solid ${BORDER}`, borderLeft: '5px solid #2E8B57', borderRadius: '15px', background: '#FFFFFF', boxShadow: '0 4px 14px rgba(20,72,47,.04)', flexShrink: '0' });
        card.dataset.orderKey = row.chave;
        const top = node('div', { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' });
        if (equipmentVisual && !continuation) {
          const visual = node('div', { width: wide ? '96px' : '76px', flexShrink: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '1px' });
          visual.append(drawEquipmentCanvas(equipmentVisual, wide));
          top.append(visual);
        }
        const title = node('div', { minWidth: '0', flex: '1', overflowWrap: 'anywhere' });
        title.append(node('div', { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: GREEN, marginBottom: '5px' }, `${row.apoio} · ${reportLocation(row)}`));
        title.append(node('div', { fontSize: wide ? '19px' : '17px', fontWeight: '700', color: '#14482F', lineHeight: '1.2' }, `Frota ${reportFleet(row)} · OS ${row.os}${continuation ? ' · continuação' : ''}`));
        title.append(node('div', { fontSize: '12px', lineHeight: '1.35', color: '#5F7268', marginTop: '5px' }, reportEquipment(row)));
        const days = node('div', { flexShrink: '0', textAlign: 'center', padding: '7px 10px', borderRadius: '10px', color: '#14482F', background: '#E8F4EC', fontSize: '13px', fontWeight: '700', maxWidth: '90px', lineHeight: '1.3' }, reportDays(row));
        days.append(node('div', { fontSize: '9px', fontWeight: '400', marginTop: '3px' }, 'dias observados'));
        top.append(title, days); card.append(top);
        const details = node('div', { display: 'grid', gridTemplateColumns: wide ? '1fr 1fr 2fr' : '1fr 1fr', gap: '8px 14px' });
        details.append(metadata('Status operacional', imageOperationalStatus(row)), metadata('Status bruto', row.status?.trim() || 'Não informado'), metadata('Entrada', reportDate(row.entrada, false)), metadata('Oficina / local', reportProvider(row)));
        if (!wide) (details.lastElementChild as HTMLElement).style.gridColumn = '1 / -1';
        card.append(details);
        const narrative = node('div', { marginTop: '11px', paddingTop: '10px', borderTop: '1px dashed #E2EBE5', whiteSpace: 'pre-wrap', fontSize: wide ? '12px' : '13px', lineHeight: '1.5', overflowWrap: 'anywhere' }, fragment);
        narrative.dataset.narrative = 'true'; card.append(narrative);
        return card;
      };
      appendLongText(row.narrativa || 'Serviço não informado.', makeCard);
    }
    const hasClosedRows = options.rows.some(row => getMaintenanceOrderClosure(row).status === 'encerrado');
    const hasUnconfirmedRows = options.rows.some(row => getMaintenanceOrderClosure(row).status === 'ausente');
    if (hasClosedRows || hasUnconfirmedRows) place(node('div', { fontSize: '11px', lineHeight: '1.4', color: '#5F7268', flexShrink: '0' }, `${hasClosedRows ? 'Encerradas: estado confirmado; data de detecção, não execução.' : ''}${hasClosedRows && hasUnconfirmedRows ? ' ' : ''}${hasUnconfirmedRows ? 'Ausências sem prova: Outros · Sem confirmação.' : ''}`));
    footers.forEach((footer, index) => {
      footer.append(node('span', {}, 'BRANCO PERES AGRO · MANUTENÇÃO'), node('span', {}, `${index + 1} / ${pages.length}`));
    });
    await document.fonts.ready;
    await Promise.all(Array.from(root.querySelectorAll('img')).map(image => image.decode()));
    return { root, pages, bodies, footers, destroy };
  } catch (error) { destroy(); throw error; }
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export async function exportApoioImages(options: ApoioReportOptions, format: ApoioImageFormat, quality: ApoioImageQuality = 'ultra', onProgress?: (progress: ImageExportProgress) => void): Promise<number> {
  onProgress?.({ phase: 'Organizando páginas', current: 0, total: 0 });
  const layout = await buildApoioImagePages(options, format);
  const preset = APOIO_IMAGE_FORMATS[format];
  const scale = quality === 'ultra' ? preset.ultraScale : 2;
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `relatorio-apoio-${format}-${quality}-${stamp}`;
  const zip = new JSZip();
  try {
    for (let index = 0; index < layout.pages.length; index++) {
      onProgress?.({ phase: 'Renderizando imagem', current: index + 1, total: layout.pages.length });
      // O renderer clona somente a página atual, não o relatório inteiro.
      layout.root.replaceChildren(layout.pages[index]);
      const canvas = await html2canvas(layout.pages[index], { scale, backgroundColor: '#F5F9F6', logging: false, useCORS: true, width: preset.width, height: preset.height, windowWidth: preset.width, windowHeight: preset.height });
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Não foi possível gerar o PNG.')), 'image/png'));
      canvas.width = 0; canvas.height = 0;
      layout.pages[index].replaceChildren();
      if (layout.pages.length === 1) download(blob, `${base}.png`);
      else zip.file(`${base}-${String(index + 1).padStart(3, '0')}.png`, blob);
      await new Promise(resolve => window.setTimeout(resolve, 0));
    }
    if (layout.pages.length > 1) {
      onProgress?.({ phase: 'Preparando arquivo ZIP', current: layout.pages.length, total: layout.pages.length });
      download(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), `${base}.zip`);
    }
    return layout.pages.length;
  } finally { layout.destroy(); }
}
