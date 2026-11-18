import {
  generateApoioWhatsAppImages,
  type WhatsAppImage,
  type WhatsAppProgress,
} from './apoioWhatsAppReport';
import type { ApoioReportOptions } from '../types/apoio';

export type ApoioWhatsAppPDFQuality = 'alta' | 'ultra';

export interface ApoioWhatsAppPDFResult {
  blob: Blob;
  filename: string;
  pages: number;
}

export type { WhatsAppProgress };

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PDF_MARGIN_MM = 10;
const PDF_CONTENT_WIDTH_MM = A4_WIDTH_MM - PDF_MARGIN_MM * 2;
const PDF_CONTENT_HEIGHT_MM = A4_HEIGHT_MM - PDF_MARGIN_MM * 2;

type PdfImageData = Uint8Array | string;

type BlobWithArrayBuffer = Blob & {
  arrayBuffer?: () => Promise<ArrayBuffer>;
};

function brazilDateStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * jsPDF accepts PNG bytes directly. FileReader remains a fallback for browser
 * and test doubles that expose a Blob without arrayBuffer().
 */
async function blobToPdfImage(blob: Blob): Promise<PdfImageData> {
  const arrayBuffer = (blob as BlobWithArrayBuffer).arrayBuffer;
  if (typeof arrayBuffer === 'function') {
    return new Uint8Array(await arrayBuffer.call(blob));
  }

  if (typeof FileReader !== 'undefined') {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('Não foi possível ler a imagem PNG.'));
      reader.readAsDataURL(blob);
    });
  }

  throw new Error('O ambiente não consegue ler a imagem PNG para o PDF.');
}

function fittedImageBox(image: WhatsAppImage): { x: number; y: number; width: number; height: number } {
  const width = Number(image.width);
  const height = Number(image.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('A imagem de uma página do resumo tem dimensões inválidas.');
  }

  const scale = Math.min(PDF_CONTENT_WIDTH_MM / width, PDF_CONTENT_HEIGHT_MM / height);
  const renderedWidth = width * scale;
  const renderedHeight = height * scale;
  return {
    x: PDF_MARGIN_MM + (PDF_CONTENT_WIDTH_MM - renderedWidth) / 2,
    y: PDF_MARGIN_MM + (PDF_CONTENT_HEIGHT_MM - renderedHeight) / 2,
    width: renderedWidth,
    height: renderedHeight,
  };
}

/**
 * Gera um único PDF A4, com uma página PDF para cada PNG paginado do resumo
 * WhatsApp. O download/salvamento fica a cargo da interface consumidora.
 */
export async function generateApoioWhatsAppPDF(
  options: ApoioReportOptions,
  quality: ApoioWhatsAppPDFQuality = 'alta',
  onProgress?: (progress: WhatsAppProgress) => void,
): Promise<ApoioWhatsAppPDFResult> {
  const images = await generateApoioWhatsAppImages(options, quality, onProgress);
  if (!images.length) {
    throw new Error('Não foi possível gerar o PDF: o resumo não possui páginas.');
  }

  const { jsPDF } = await import('jspdf');
  const document = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    // Flate/PNG compression is lossless and avoids oversized mobile documents.
    compress: true,
  });

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    if (index > 0) document.addPage('a4', 'portrait');

    onProgress?.({ phase: 'Montando PDF', current: index + 1, total: images.length });
    const box = fittedImageBox(image);
    const imageData = await blobToPdfImage(image.blob);
    document.addImage(
      imageData,
      'PNG',
      box.x,
      box.y,
      box.width,
      box.height,
      undefined,
      'FAST',
    );
  }

  onProgress?.({ phase: 'PDF pronto', current: images.length, total: images.length });
  return {
    blob: document.output('blob'),
    filename: `apoio-whatsapp-${brazilDateStamp(new Date())}.pdf`,
    pages: images.length,
  };
}
