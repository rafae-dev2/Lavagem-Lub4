import { buildOficinaTerceirosPage, renderOficinaTerceirosPng } from '../src/lib/apoioOficinaTerceirosReport';
import { selectOficinaTerceirosEquipment } from '../src/lib/apoioOficinaTerceirosData';
import type { ApoioReportRow } from '../src/types/apoio';

const GENERATED_AT = new Date('2026-11-14T19:42:00.000Z');

async function imageInfo(blob: Blob): Promise<{ width: number; height: number; bytes: number; type: string }> {
  const bitmap = await createImageBitmap(blob);
  const info = { width: bitmap.width, height: bitmap.height, bytes: blob.size, type: blob.type };
  bitmap.close();
  return info;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Lê pixels do PNG para confirmar que o logotipo não tem caixa branca. */
async function samplePixels(blob: Blob, points: [number, number][]): Promise<number[][]> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D indisponível para conferir os pixels.');
  context.drawImage(bitmap, 0, 0);
  const samples = points.map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data));
  bitmap.close();
  canvas.width = 0;
  canvas.height = 0;
  return samples;
}

async function run(rows: ApoioReportRow[], render = true) {
  const entries = selectOficinaTerceirosEquipment(rows);
  const groupColors = Object.fromEntries(rows.map(row => [row.apoio, row.apoio === 'Caminhão Pipa' ? '#4ECDC4' : row.apoio === 'Carretas Canavieiras' ? '#F97316' : '']));
  const layout = await buildOficinaTerceirosPage(entries, { generatedAt: GENERATED_AT, groupColors });
  const page = {
    text: layout.page.textContent || '',
    width: layout.page.offsetWidth,
    height: layout.page.offsetHeight,
    declaredHeight: Number(layout.page.dataset.imageHeight),
    rows: layout.page.querySelectorAll('[data-oficina-terceiros-row]').length,
    overflow: String(Math.max(0, layout.page.scrollHeight - layout.page.offsetHeight)),
  };
  layout.destroy();
  if (!render) return { entries, pages: [page], rendered: null };
  const rendered = await renderOficinaTerceirosPng(entries, { generatedAt: GENERATED_AT, groupColors });
  return {
    entries,
    pages: [page],
    rendered: {
      width: rendered.width,
      height: rendered.height,
      count: 1,
      image: { ...(await imageInfo(rendered.blob)), dataUrl: await blobToDataUrl(rendered.blob) },
      // Cantos da área do logotipo (antiga caixa branca) e centro da tabela.
      pixels: await samplePixels(rendered.blob, [[68, 68], [140, 68], [70, 140], [500, 560]]),
    },
  };
}

(window as unknown as { runOficinaTerceiros: typeof run }).runOficinaTerceiros = run;
