import { buildApoioWhatsAppPages, generateApoioWhatsAppSingleImage } from '../src/lib/apoioWhatsAppReport';
import { generateApoioWhatsAppPDF } from '../src/lib/apoioWhatsAppPDF';
import type { ApoioReportOptions } from '../src/types/apoio';
const target = window as typeof window & Record<string, any>;
const dataURL = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
});
target.inspectSingle = async (options: ApoioReportOptions) => {
  const old = await buildApoioWhatsAppPages(options);
  const previousPages = old.pages.length; old.destroy();
  const single = await buildApoioWhatsAppPages(options, new Date(), 'unica');
  try {
    if (single.pages.length !== 1) throw new Error('A imagem única foi dividida');
    const cards = Array.from(single.root.querySelectorAll<HTMLElement>('article[data-order-key]'));
    if (cards.length !== options.rows.length) throw new Error('Quantidade incompleta');
    for (const row of options.rows) {
      const card = cards.find(card => card.dataset.orderKey === row.chave)!;
      if (card.querySelector('[data-narrative]')?.textContent !== (row.narrativa?.trim() || 'Descrição não informada. Solicitar detalhamento.')) throw new Error(`Narrativa incompleta ${row.chave}`);
      if (row.prestador && !card.innerText.includes(row.prestador)) throw new Error(`Prestador omitido ${row.chave}`);
    }
    if (single.root.innerText.includes('FILTER_CANARY')) throw new Error('Filtro exposto');
    return { previousPages, singlePages: single.pages.length, height: single.pages[0].getBoundingClientRect().height, cards: cards.length, text: single.root.innerText };
  } finally { single.destroy(); }
};
target.generateSingle = async (options: ApoioReportOptions) => {
  const result = await generateApoioWhatsAppSingleImage(options, 'alta');
  return Promise.all(result.map(async image => ({ filename: image.filename, width: image.width, height: image.height, dataUrl: await dataURL(image.blob) })));
};
target.generateSinglePDF = async (options: ApoioReportOptions) => {
  const result = await generateApoioWhatsAppPDF(options, 'alta');
  return { filename: result.filename, pages: result.pages, dataUrl: await dataURL(result.blob) };
};
target.checkSingleLimit = async (options: ApoioReportOptions) => {
  try { await generateApoioWhatsAppSingleImage(options, 'ultra'); throw new Error('Deveria limitar imagem extensa'); }
  catch (error) {
    const message = (error as Error).message;
    if (!message.includes('limite seguro') || !message.includes('Nenhuma ordem foi cortada')) throw error;
    return message;
  }
};
