import { apoioClient } from './apoioService';
import {
  EQUIPMENT_IMAGES_UPDATED as REGISTRY_EQUIPMENT_IMAGES_UPDATED,
  EQUIPMENT_IMAGE_BUCKET as REGISTRY_EQUIPMENT_IMAGE_BUCKET,
  refreshEquipmentImageOverrides,
} from './equipmentImageRegistry';

export const EQUIPMENT_IMAGE_BUCKET = REGISTRY_EQUIPMENT_IMAGE_BUCKET;
export const EQUIPMENT_IMAGE_TABLE = 'equipment_group_images';
export const EQUIPMENT_IMAGES_UPDATED = REGISTRY_EQUIPMENT_IMAGES_UPDATED;
export const MAX_EQUIPMENT_IMAGE_BYTES = 180_000;
export const MAX_EQUIPMENT_IMAGE_INPUT_BYTES = 8 * 1024 * 1024;
export const MAX_EQUIPMENT_IMAGE_PIXELS = 16_000_000;
export const MAX_EQUIPMENT_IMAGE_EDGE = 640;
export const EQUIPMENT_IMAGE_TARGET_BYTES = 120_000;
export const EQUIPMENT_IMAGE_PREVIEW_NOTE =
  'PNG/WebP preservam transparência. Imagens animadas serão achatadas no primeiro quadro; a compressão não remove fundos complexos. Para um recorte limpo, envie a imagem já recortada.';

const SUPPORTED_INPUT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const WEBP_QUALITIES = [0.86, 0.76, 0.66, 0.56] as const;
const REQUEST_TIMEOUT_MS = 15_000;

type EquipmentImageMimeType = 'image/webp' | 'image/png';
type EquipmentImageExtension = 'webp' | 'png';

type SupabaseErrorLike = { message?: string; details?: string; hint?: string; code?: string } | null | undefined;

export interface PreparedEquipmentImage {
  blob: Blob;
  previewUrl?: string;
  width: number;
  height: number;
  originalBytes: number;
  mimeType: EquipmentImageMimeType;
  extension: EquipmentImageExtension;
}

export interface EquipmentGroupImageMetadata {
  group_id: string;
  object_path: string;
  mime_type: EquipmentImageMimeType;
  bytes: number;
  width: number;
  height: number;
  updated_at: string;
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

interface UploadResult {
  error: SupabaseErrorLike;
}

function describeError(error: SupabaseErrorLike): string {
  if (!error) return 'erro desconhecido';
  return [error.message, error.details, error.hint].filter(Boolean).join(' — ') || 'erro Supabase';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'erro desconhecido');
}

function assertSupportedInput(file: File): void {
  if (!file || typeof file !== 'object') {
    throw new Error('Selecione um arquivo de imagem.');
  }
  if (typeof file.type !== 'string' || !SUPPORTED_INPUT_TYPES.has(file.type.toLowerCase())) {
    throw new Error('Formato não aceito. Use somente PNG, JPEG ou WebP.');
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error('O arquivo de imagem está vazio.');
  }
  if (file.size > MAX_EQUIPMENT_IMAGE_INPUT_BYTES) {
    throw new Error('A imagem original deve ter no máximo 8 MiB.');
  }
}

function isSafeGroupId(groupId: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(groupId);
}

function assertSafeGroupId(groupId: string): string {
  const normalized = groupId.trim();
  if (!isSafeGroupId(normalized)) {
    throw new Error('O grupo selecionado tem um identificador inválido.');
  }
  return normalized;
}

function isSafeObjectPath(groupId: string, objectPath: string): boolean {
  return (
    objectPath.startsWith(`${groupId}/`) &&
    !objectPath.includes('..') &&
    !objectPath.startsWith('/') &&
    /^[A-Za-z0-9_-]{1,128}\/[0-9a-f-]{16,64}\.(?:png|webp)$/.test(objectPath)
  );
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    throw new Error('A preparação da imagem precisa ser feita no navegador.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function renderCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível criar o canvas da imagem.');

  // Não pinta um fundo: o canvas começa transparente e o alpha original é mantido.
  context.clearRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('O navegador não conseguiu codificar a imagem.'));
          return;
        }
        resolve(blob);
      }, type, quality);
    } catch (error) {
      reject(error);
    }
  });
}

function imageConstructor(): (new () => HTMLImageElement) | null {
  const candidate = (globalThis as { Image?: unknown }).Image;
  return typeof candidate === 'function' ? (candidate as new () => HTMLImageElement) : null;
}

async function decodeWithImage(file: File): Promise<DecodedImage> {
  const ImageConstructor = imageConstructor();
  if (!ImageConstructor || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('Este navegador não oferece um decodificador de imagens compatível.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new ImageConstructor();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Não foi possível decodificar a imagem selecionada.'));
      element.src = objectUrl;
    });
    const width = Number(image.naturalWidth || image.width);
    const height = Number(image.naturalHeight || image.height);
    if (!width || !height) throw new Error('A imagem não informou dimensões válidas.');
    return {
      source: image,
      width,
      height,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function decodeImage(file: File): Promise<DecodedImage> {
  const createBitmap = (globalThis as {
    createImageBitmap?: (source: Blob, options?: ImageBitmapOptions) => Promise<ImageBitmap>;
  }).createImageBitmap;

  if (typeof createBitmap === 'function') {
    try {
      // from-image normaliza EXIF antes do canvas; esta também achata animações no quadro decodificado.
      const bitmap = await createBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Alguns navegadores expõem createImageBitmap mas não decodificam WebP/JPEG em todos os modos.
      // O caminho HTMLImageElement abaixo preserva a possibilidade de carregamento normal.
    }
  }
  return decodeWithImage(file);
}

async function encodeCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  let pngFallback: Blob | null = null;
  let largestWebp: Blob | null = null;

  for (const quality of WEBP_QUALITIES) {
    const candidate = await canvasToBlob(canvas, 'image/webp', quality);
    const actualType = candidate.type.toLowerCase();
    if (actualType === 'image/png') {
      pngFallback = candidate;
      break;
    }
    if (actualType !== 'image/webp') {
      throw new Error('O navegador retornou um formato de imagem não suportado.');
    }
    largestWebp = candidate;
    if (candidate.size <= EQUIPMENT_IMAGE_TARGET_BYTES) return candidate;
  }

  if (pngFallback) return pngFallback;
  if (largestWebp) return largestWebp;
  throw new Error('Não foi possível codificar a imagem em WebP ou PNG.');
}

async function prepareEncodedImage(
  source: CanvasImageSource,
  initialWidth: number,
  initialHeight: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  let width = initialWidth;
  let height = initialHeight;

  for (;;) {
    const canvas = renderCanvas(source, width, height);
    const blob = await encodeCanvas(canvas);
    if (blob.size <= MAX_EQUIPMENT_IMAGE_BYTES) return { blob, width, height };

    const nextWidth = Math.max(1, Math.floor(width * 0.85));
    const nextHeight = Math.max(1, Math.floor(height * 0.85));
    if (nextWidth === width && nextHeight === height) {
      throw new Error('Não foi possível reduzir a imagem para 180 KB.');
    }
    width = nextWidth;
    height = nextHeight;
  }
}

/**
 * Decodifica, normaliza EXIF e comprime uma imagem no browser antes de qualquer upload.
 * O arquivo original nunca é enviado ao storage.
 */
export async function prepareEquipmentImage(file: File): Promise<PreparedEquipmentImage> {
  assertSupportedInput(file);
  const decoded = await decodeImage(file);
  const pixelCount = decoded.width * decoded.height;

  try {
    if (
      !Number.isFinite(pixelCount) ||
      decoded.width <= 0 ||
      decoded.height <= 0 ||
      pixelCount > MAX_EQUIPMENT_IMAGE_PIXELS
    ) {
      throw new Error('A imagem excede o limite de 16 milhões de pixels.');
    }

    const scale = Math.min(1, MAX_EQUIPMENT_IMAGE_EDGE / Math.max(decoded.width, decoded.height));
    const initialWidth = Math.max(1, Math.round(decoded.width * scale));
    const initialHeight = Math.max(1, Math.round(decoded.height * scale));
    const encoded = await prepareEncodedImage(decoded.source, initialWidth, initialHeight);
    const mimeType = encoded.blob.type.toLowerCase();

    if (mimeType !== 'image/webp' && mimeType !== 'image/png') {
      throw new Error('O navegador não retornou WebP ou PNG após a compressão.');
    }

    const previewUrl =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(encoded.blob)
        : undefined;

    return {
      blob: encoded.blob,
      previewUrl,
      width: encoded.width,
      height: encoded.height,
      originalBytes: file.size,
      mimeType,
      extension: mimeType === 'image/webp' ? 'webp' : 'png',
    };
  } finally {
    decoded.release();
  }
}

function withTimeout<T>(operation: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('A operação de imagem excedeu 15 segundos.'));
    }, REQUEST_TIMEOUT_MS);
  });

  return Promise.race([Promise.resolve().then(() => operation(controller.signal)), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function validatePreparedImage(prepared: PreparedEquipmentImage): void {
  if (!prepared?.blob || prepared.blob.size <= 0 || prepared.blob.size > MAX_EQUIPMENT_IMAGE_BYTES) {
    throw new Error('A imagem preparada precisa ter entre 1 e 180 KB.');
  }
  if (
    (prepared.mimeType !== 'image/webp' && prepared.mimeType !== 'image/png') ||
    prepared.blob.type.toLowerCase() !== prepared.mimeType
  ) {
    throw new Error('O tipo real da imagem preparada não corresponde ao metadata.');
  }
  if (
    !Number.isInteger(prepared.width) ||
    !Number.isInteger(prepared.height) ||
    prepared.width < 1 ||
    prepared.height < 1 ||
    prepared.width > MAX_EQUIPMENT_IMAGE_EDGE ||
    prepared.height > MAX_EQUIPMENT_IMAGE_EDGE
  ) {
    throw new Error('As dimensões da imagem preparada são inválidas.');
  }
}

async function uploadObject(path: string, prepared: PreparedEquipmentImage): Promise<void> {
  const result = await withTimeout(() =>
    apoioClient.storage.from(EQUIPMENT_IMAGE_BUCKET).upload(path, prepared.blob, {
      contentType: prepared.mimeType,
      cacheControl: '31536000',
      upsert: false,
    }),
  ) as UploadResult;
  if (result?.error) throw new Error(`[EquipmentImage] upload: ${describeError(result.error)}`);
}

async function removeObject(path: string): Promise<void> {
  const result = await withTimeout(() =>
    apoioClient.storage.from(EQUIPMENT_IMAGE_BUCKET).remove([path]),
  ) as UploadResult;
  if (result?.error) throw new Error(`[EquipmentImage] remover arquivo: ${describeError(result.error)}`);
}

/** Retorna a URL pública estável do objeto já gravado (o bucket é público para leitura). */
export function getEquipmentGroupImagePublicUrl(objectPath: string): string {
  return apoioClient.storage.from(EQUIPMENT_IMAGE_BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

export async function saveEquipmentGroupImage(
  groupId: string,
  prepared: PreparedEquipmentImage,
  previousPath?: string | null,
): Promise<void> {
  const safeGroupId = assertSafeGroupId(groupId);
  validatePreparedImage(prepared);
  if (previousPath && !isSafeObjectPath(safeGroupId, previousPath)) {
    throw new Error('O caminho da imagem anterior não pertence ao grupo selecionado.');
  }

  const uuid = globalThis.crypto?.randomUUID?.();
  if (!uuid) throw new Error('Este navegador não oferece crypto.randomUUID().');
  const objectPath = `${safeGroupId}/${uuid}.${prepared.extension}`;

  await uploadObject(objectPath, prepared);
  try {
    const metadataResult = await withTimeout((signal) =>
      apoioClient
        .from(EQUIPMENT_IMAGE_TABLE)
        .upsert(
          {
            group_id: safeGroupId,
            object_path: objectPath,
            mime_type: prepared.mimeType,
            bytes: prepared.blob.size,
            width: prepared.width,
            height: prepared.height,
          },
          { onConflict: 'group_id' },
        )
        .abortSignal(signal),
    ) as { error: SupabaseErrorLike };
    if (metadataResult?.error) throw new Error(`[EquipmentImage] metadata: ${describeError(metadataResult.error)}`);
  } catch (error) {
    try {
      await removeObject(objectPath);
    } catch (cleanupError) {
      console.warn('[EquipmentImage] metadata falhou e o arquivo novo ficou órfão.', cleanupError);
      throw new Error(`${errorMessage(error)} O arquivo novo não pôde ser removido automaticamente.`);
    }
    throw error;
  }

  // O novo metadata já está confirmado. O arquivo anterior só é removido agora.
  if (previousPath) {
    try {
      await removeObject(previousPath);
    } catch (cleanupError) {
      console.warn('[EquipmentImage] metadata confirmado, mas a imagem anterior ficou órfã.', cleanupError);
    }
  }

  try {
    await refreshEquipmentImageOverrides(true);
  } catch (error) {
    // A gravação já foi confirmada; uma falha de leitura não cria estado falso
    // nem desfaz o objeto. O manager fará sua leitura explícita e exibirá o dado.
    console.warn('[EquipmentImage] imagem salva, mas o registry não foi atualizado.', error);
  }
}

export async function restoreEquipmentGroupImage(groupId: string, previousPath: string): Promise<void> {
  const safeGroupId = assertSafeGroupId(groupId);
  if (!isSafeObjectPath(safeGroupId, previousPath)) {
    throw new Error('O caminho da imagem anterior não pertence ao grupo selecionado.');
  }

  const metadataResult = await withTimeout((signal) =>
    apoioClient
      .from(EQUIPMENT_IMAGE_TABLE)
      .delete()
      .eq('group_id', safeGroupId)
      .eq('object_path', previousPath)
      .select('object_path')
      .abortSignal(signal),
  ) as { data: {object_path:string}[] | null; error: SupabaseErrorLike };
  if (metadataResult?.error) {
    throw new Error(`[EquipmentImage] restaurar metadata: ${describeError(metadataResult.error)}`);
  }

  if(!metadataResult.data?.length) throw new Error('A imagem mudou em outra sessão ou sua permissão expirou. Atualize o catálogo antes de restaurar.');
  let cleanupError: unknown = null;
  try { await removeObject(previousPath); } catch(error) {cleanupError=error;}
  try { await refreshEquipmentImageOverrides(true); } catch(error) {console.warn('[EquipmentImage] padrão restaurado, mas o registry não foi atualizado.',error);}
  if(cleanupError) throw new Error(`A ilustração padrão foi restaurada, mas o arquivo anterior não pôde ser removido: ${errorMessage(cleanupError)}`);
}
