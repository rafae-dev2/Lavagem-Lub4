import { buildApoioImagePages, exportApoioImages, APOIO_IMAGE_FORMATS, type ApoioImageFormat } from '../src/lib/apoioImageReport';
import type { ApoioReportOptions } from '../src/types/apoio';

declare global { interface Window { testImages: (options: ApoioReportOptions, format: ApoioImageFormat) => Promise<unknown>; downloadImages: typeof exportApoioImages; } }

window.testImages = async (options, format) => {
  const layout = await buildApoioImagePages(options, format);
  try {
    const chunks = new Map<string, string[]>();
    layout.root.querySelectorAll<HTMLElement>('article[data-order-key]').forEach(card => {
      const key = card.dataset.orderKey!;
      const items = chunks.get(key) || [];
      items.push(card.querySelector<HTMLElement>('[data-narrative]')!.textContent || '');
      chunks.set(key, items);
    });
    for (const row of options.rows) {
      if (!chunks.has(row.chave)) throw new Error(`OS ${row.os} não foi exportada`);
      if (chunks.get(row.chave)!.join('') !== (row.narrativa || 'Serviço não informado.')) throw new Error(`Narrativa incompleta para ${row.os}`);
    }
    const overflows = layout.bodies.map(body => body.scrollHeight - body.clientHeight);
    if (overflows.some(value => value > 1)) throw new Error(`Conteúdo cortado: ${overflows}`);
    const renderedText = layout.root.textContent || '';
    if (/Atualização da fonte|Última sincronização|Presente na fonte/i.test(renderedText)) throw new Error('Metadados de Fonte não foram ocultados');
    if (/filterCanary|VIEW_CANARY/i.test(renderedText)) throw new Error('Metadados de filtros/view foram renderizados');
    if (options.sourceError && !renderedText.includes('Atualização pendente: consulte o aplicativo antes de tomar decisões.')) throw new Error('Aviso de fonte não foi preservado');
    return { format, pages: layout.pages.length, orders: chunks.size, maxOverflow: Math.max(...overflows), width: APOIO_IMAGE_FORMATS[format].width, height: APOIO_IMAGE_FORMATS[format].height };
  } finally { layout.destroy(); }
};
window.downloadImages = exportApoioImages;
