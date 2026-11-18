import { buildApoioWhatsAppPages, generateApoioWhatsAppImages } from '../src/lib/apoioWhatsAppReport';
import type { ApoioReportOptions } from '../src/types/apoio';
const target = window as typeof window & Record<string, any>;
target.inspectWhatsApp = async (options: ApoioReportOptions) => {
  const layout = await buildApoioWhatsAppPages(options, new Date('2026-11-05T08:40:00-03:00'));
  try {
    const recovered: Record<string, string> = {};
    for (const article of Array.from(layout.root.querySelectorAll<HTMLElement>('article[data-order-key]'))) {
      const key = article.dataset.orderKey!;
      recovered[key] = (recovered[key] || '') + article.querySelector('[data-narrative]')!.textContent;
    }
    for (const row of options.rows) {
      const expected = row.narrativa?.trim() || 'Descrição não informada. Solicitar detalhamento.';
      if (recovered[row.chave] !== expected) throw new Error(`Texto perdido: ${row.chave}`);
    }
    if (layout.bodies.some(body => body.scrollHeight > body.clientHeight + 1)) throw new Error('Texto cortado no corpo da imagem');
    const text = layout.root.innerText;
    if (text.includes('FILTER_CANARY') || text.includes('Filtros ativos')) throw new Error('Metadados de filtros expostos');
    return { pages: layout.pages.length, text, recovered, widths: layout.pages.map(page => page.clientWidth) };
  } finally { layout.destroy(); }
};
target.generateWhatsApp = async (options: ApoioReportOptions, quality: 'alta' | 'ultra') => {
  const result = await generateApoioWhatsAppImages(options, quality);
  return Promise.all(result.map(async image => ({ filename: image.filename, width: image.width, height: image.height, bytes: image.blob.size, dataUrl: await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(image.blob);
  }) })));
};
