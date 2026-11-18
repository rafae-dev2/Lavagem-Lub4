import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { ChevronLeft, ChevronRight, Download, MessageSquare, Share2, Smartphone } from 'lucide-react';
import type { ApoioReportOptions } from '../types/apoio';
import {
  generateApoioWhatsAppImages,
  generateApoioWhatsAppSingleImage,
  type WhatsAppImage,
  type WhatsAppProgress,
} from '../lib/apoioWhatsAppReport';
import { generateApoioWhatsAppPDF } from '../lib/apoioWhatsAppPDF';

interface Props {
  options: ApoioReportOptions;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}

type Quality = 'alta' | 'ultra';
type GenerationMode = 'paginas' | 'unica';

const SINGLE_IMAGE_TALL_WARNING_HEIGHT = 6000;

const panelStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-primary)',
  borderRadius: 12,
};
const fieldStyle: React.CSSProperties = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 10,
  color: 'var(--text-primary)',
  padding: '9px 12px',
  width: '100%',
};
const buttonClass = 'apoio-button inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-80';
const mutedStyle: React.CSSProperties = { color: 'var(--text-secondary)' };
const greenStyle: React.CSSProperties = { background: 'var(--brand-green)', color: 'var(--apoio-surface)' };
const neutralStyle: React.CSSProperties = { background: 'var(--bg-hover)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' };

function optionsSignature(options: ApoioReportOptions): string {
  const rows = options.rows.map(row => [
    row.chave,
    row.os,
    row.frota,
    row.origem,
    row.prestador,
    row.narrativa,
    row.ativo,
  ]);
  return JSON.stringify({
    filters: options.filters,
    rows,
    sourceError: options.sourceError || null,
    view: options.view,
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function fileForImage(image: WhatsAppImage): File {
  return new File([image.blob], image.filename, { type: image.blob.type || 'image/png' });
}

function canShareFiles(images: WhatsAppImage[]): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function' || !images.length) return false;
  try {
    return navigator.canShare({ files: images.map(fileForImage) });
  } catch {
    return false;
  }
}

export default function ApoioWhatsAppPanel({ options, disabled = false, onBusyChange }: Props) {
  const signature = useMemo(() => optionsSignature(options), [options]);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const onBusyChangeRef = useRef(onBusyChange);
  const objectUrlsRef = useRef<string[]>([]);
  const imagesRef = useRef<WhatsAppImage[]>([]);
  const [images, setImages] = useState<WhatsAppImage[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [quality, setQuality] = useState<Quality>('alta');
  const [currentPage, setCurrentPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<WhatsAppProgress | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [previewMode, setPreviewMode] = useState<GenerationMode>('paginas');
  const [singleImageTallWarning, setSingleImageTallWarning] = useState(false);

  onBusyChangeRef.current = onBusyChange;

  const setPanelBusy = useCallback((value: boolean) => {
    if (busyRef.current === value) return;
    busyRef.current = value;
    if (mountedRef.current) setBusy(value);
    onBusyChangeRef.current?.(value);
  }, []);

  const revokePreviewUrls = useCallback(() => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      revokePreviewUrls();
      imagesRef.current = [];
      if (busyRef.current) {
        busyRef.current = false;
        onBusyChangeRef.current?.(false);
      }
    };
  }, [revokePreviewUrls]);

  useEffect(() => {
    generationRef.current += 1;
    revokePreviewUrls();
    imagesRef.current = [];
    if (busyRef.current) setPanelBusy(false);
    setImages([]);
    setPreviewUrls([]);
    setCurrentPage(0);
    setProgress(null);
    setNotice('');
    setError('');
    setPreviewMode('paginas');
    setSingleImageTallWarning(false);
  }, [signature, revokePreviewUrls, setPanelBusy]);

  const generate = useCallback(async (mode: GenerationMode = 'paginas') => {
    if (disabled || busyRef.current || !options.rows.length) return;
    const token = ++generationRef.current;
    const startedSignature = signature;
    setError('');
    setNotice('');
    setProgress({ phase: 'Preparando resumo', current: 0, total: 0 });
    setPanelBusy(true);
    try {
      const result = await (mode === 'unica' ? generateApoioWhatsAppSingleImage(options, quality, next => {
        if (mountedRef.current && token === generationRef.current && startedSignature === signature) setProgress(next);
      }) : generateApoioWhatsAppImages(options, quality, next => {
        if (mountedRef.current && token === generationRef.current && startedSignature === signature) setProgress(next);
      }));
      if (!mountedRef.current || token !== generationRef.current || startedSignature !== signature) return;
      revokePreviewUrls();
      const urls = result.map(image => URL.createObjectURL(image.blob));
      objectUrlsRef.current = urls;
      imagesRef.current = result;
      setImages(result);
      setPreviewUrls(urls);
      setCurrentPage(0);
      setPreviewMode(mode);
      setSingleImageTallWarning(mode === 'unica' && result[0]?.height > SINGLE_IMAGE_TALL_WARNING_HEIGHT);
      setNotice(mode === 'unica'
        ? `Uma imagem com todas ${options.rows.length} ordens está pronta para revisar e compartilhar.`
        : `${result.length} ${result.length === 1 ? 'imagem pronta' : 'imagens prontas'} para revisar e compartilhar.`);
    } catch (caught) {
      if (!mountedRef.current || token !== generationRef.current || startedSignature !== signature) return;
      if (!isAbortError(caught)) {
        const message = caught instanceof Error ? caught.message : String(caught);
        const fallbackHint = 'Para listas muito longas, use o PDF único ou Gerar páginas; a imagem única não é truncada nem paginada silenciosamente.';
        setError(mode === 'unica' && !/PDF único|modo em páginas/i.test(message) ? `${message} ${fallbackHint}` : message);
      }
    } finally {
      if (mountedRef.current && token === generationRef.current && startedSignature === signature) {
        setProgress(null);
        setPanelBusy(false);
      }
    }
  }, [disabled, options, quality, revokePreviewUrls, setPanelBusy, signature]);

  const generatePdf = useCallback(async () => {
    if (disabled || busyRef.current || !options.rows.length) return;
    const token = ++generationRef.current;
    const startedSignature = signature;
    setError('');
    setNotice('');
    setProgress({ phase: 'Preparando PDF', current: 0, total: 0 });
    setPanelBusy(true);
    try {
      const result = await generateApoioWhatsAppPDF(options, quality, next => {
        if (mountedRef.current && token === generationRef.current && startedSignature === signature) setProgress(next);
      });
      if (!mountedRef.current || token !== generationRef.current || startedSignature !== signature) return;
      downloadBlob(result.blob, result.filename);
      setNotice(`PDF único baixado com ${result.pages} ${result.pages === 1 ? 'página' : 'páginas'} para todas as ${options.rows.length} ordens.`);
    } catch (caught) {
      if (!mountedRef.current || token !== generationRef.current || startedSignature !== signature) return;
      if (!isAbortError(caught)) setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (mountedRef.current && token === generationRef.current && startedSignature === signature) {
        setProgress(null);
        setPanelBusy(false);
      }
    }
  }, [disabled, options, quality, setPanelBusy, signature]);

  const currentImage = images[currentPage];
  const nativeCurrentShareAvailable = useMemo(() => canShareFiles(currentImage ? [currentImage] : []), [currentImage]);
  const nativeAllShareAvailable = useMemo(() => canShareFiles(images), [images]);

  const shareImages = useCallback(async (selected: WhatsAppImage[], all: boolean) => {
    if (!selected.length || typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
      setNotice('Compartilhamento nativo indisponível. Baixe a imagem e envie manualmente pelo WhatsApp.');
      return;
    }
    const files = selected.map(fileForImage);
    try {
      if (!navigator.canShare({ files })) {
        setNotice('Este aparelho não aceita esse compartilhamento. Baixe a imagem e envie manualmente pelo WhatsApp.');
        return;
      }
      await navigator.share({
        files,
        title: all ? 'Resumo Apoio · todas as páginas' : 'Resumo Apoio · cobrar retorno',
      });
      setNotice('Compartilhamento aberto. Escolha o contato ou aplicativo no menu do aparelho.');
    } catch (caught) {
      if (isAbortError(caught)) {
        setNotice('Compartilhamento cancelado.');
        return;
      }
      setNotice('Compartilhamento indisponível. Baixe a imagem e envie manualmente pelo WhatsApp.');
    }
  }, []);

  const downloadCurrent = useCallback(() => {
    if (!currentImage) return;
    downloadBlob(currentImage.blob, currentImage.filename);
    setNotice('Imagem baixada. Anexe-a manualmente à conversa do WhatsApp.');
  }, [currentImage]);

  const downloadAll = useCallback(async () => {
    if (!images.length) return;
    try {
      const zip = new JSZip();
      images.forEach(image => zip.file(image.filename, image.blob));
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      downloadBlob(blob, `controle-apoio-whatsapp-${quality}.zip`);
      setNotice('ZIP baixado. Extraia as páginas e envie-as manualmente pelo WhatsApp.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível preparar o ZIP.');
    }
  }, [images, quality]);

  return (
    <section className="p-5 space-y-4" style={{ ...panelStyle, background: 'linear-gradient(120deg, rgba(31,107,69,.18), var(--bg-card))' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2"><MessageSquare size={19} />WhatsApp · Cobrar retorno</h3>
          <p className="text-sm mt-1" style={mutedStyle}>Frota · Oficina · Problema. Prévia adaptada ao celular; imagens não mudam dados.</p>
        </div>
        <Smartphone size={22} style={mutedStyle} aria-hidden="true" />
      </div>

      <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <label className="text-sm font-semibold">Qualidade
          <select value={quality} disabled={busy || disabled} onChange={event => setQuality(event.target.value as Quality)} className="mt-1" style={fieldStyle}>
            <option value="alta">Alta · recomendada para celular</option>
            <option value="ultra">Ultra · 3×, arquivo maior</option>
          </select>
        </label>
        <div className="text-xs self-end" style={mutedStyle}>
          <strong className="block" style={{ color: 'var(--text-primary)' }}>{currentImage ? `${currentImage.width} × ${currentImage.height} px` : `${quality === 'alta' ? 960 : 1440} px de largura · altura natural`}</strong>
          Página CSS 480 px de largura · altura final acompanha o conteúdo · todas as {options.rows.length} ordens filtradas, sem paginação da tela.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass} style={greenStyle} disabled={disabled || busy || !options.rows.length} onClick={() => void generate()}>
          <Smartphone size={16} />{busy ? `${progress?.phase || 'Gerando'}${progress?.total ? ` · ${progress.current}/${progress.total}` : '…'}` : 'Gerar páginas'}
        </button>
        <button type="button" className={buttonClass} style={neutralStyle} disabled={disabled || busy || !options.rows.length} onClick={() => void generate('unica')}>
          <Smartphone size={16} />Imagem única · Todas as ordens
        </button>
        <button type="button" className={buttonClass} style={neutralStyle} disabled={disabled || busy || !options.rows.length} onClick={() => void generatePdf()}>
          <Download size={16} />PDF único · Todas as ordens
        </button>
        {images.length > 0 && <span className="text-xs" role="status" style={mutedStyle}>{previewMode === 'unica' ? `Imagem única · todas as ${options.rows.length} ordens` : `${currentPage + 1} de ${images.length} página(s)`}</span>}
      </div>

      {error && <p role="alert" className="text-sm p-3 rounded-xl" style={{ background: 'var(--apoio-danger-bg)', color: 'var(--apoio-danger)', border: '1px solid var(--apoio-danger)' }}>{error}</p>}
      {notice && <p role="status" className="text-sm p-3 rounded-xl apoio-notice">{notice}</p>}
      {singleImageTallWarning && <p role="status" className="text-sm p-3 rounded-xl" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)' }}>
        A imagem única ficou muito alta e pode sofrer compressão em alguns celulares. Se a leitura ficar ruim, prefira o PDF único ou Gerar páginas.
      </p>}

      {currentImage && previewUrls[currentPage] && <div className="space-y-3">
        <div className="mx-auto max-h-[600px] w-full max-w-[480px] overflow-auto rounded-2xl border shadow-sm" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}>
          <img src={previewUrls[currentPage]} alt={previewMode === 'unica' ? `Prévia WhatsApp, uma imagem com todas as ${options.rows.length} ordens` : `Prévia WhatsApp, página ${currentPage + 1} de ${images.length}`} className="block h-auto w-full" />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" className={buttonClass} style={neutralStyle} disabled={disabled || busy || currentPage <= 0} onClick={() => setCurrentPage(page => page - 1)}><ChevronLeft size={16} />Anterior</button>
          <button type="button" className={buttonClass} style={neutralStyle} disabled={disabled || busy || currentPage >= images.length - 1} onClick={() => setCurrentPage(page => page + 1)}>Próxima<ChevronRight size={16} /></button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} style={greenStyle} disabled={disabled || busy} onClick={() => void shareImages([currentImage], false)}><Share2 size={16} />Compartilhar página</button>
          {nativeAllShareAvailable && <button type="button" className={buttonClass} style={greenStyle} disabled={disabled || busy} onClick={() => void shareImages(images, true)}><Share2 size={16} />Compartilhar todas</button>}
          <button type="button" className={buttonClass} style={neutralStyle} disabled={disabled || busy} onClick={downloadCurrent}><Download size={16} />Baixar atual</button>
          <button type="button" className={buttonClass} style={neutralStyle} disabled={disabled || busy} onClick={() => void downloadAll()}><Download size={16} />Baixar ZIP ({images.length})</button>
        </div>
        {!nativeCurrentShareAvailable && <p className="text-xs" style={mutedStyle}>O compartilhamento nativo não está disponível neste navegador. Baixe a imagem e anexe-a manualmente no WhatsApp.</p>}
      </div>}

      <p className="text-xs" style={mutedStyle}>O aplicativo não envia para grupos automaticamente. Revise a prévia e escolha explicitamente o contato no menu nativo ou baixe os arquivos para enviar manualmente.</p>
    </section>
  );
}
