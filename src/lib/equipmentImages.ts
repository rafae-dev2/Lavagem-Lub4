import {resolveCustomEquipmentImage,isEquipmentStorageImage,refreshEquipmentImageOverrides} from './equipmentImageRegistry';
import { CATEGORIAS_PADRAO } from './frotaCategorias';

export interface EquipmentImage {
  key: string;
  label: string;
  src: string;
}

export interface LoadedEquipmentImage {
  image: EquipmentImage;
  dataUrl: string;
  width: number;
  height: number;
}

const EQUIPMENT_IMAGE_DEFINITIONS: ReadonlyArray<readonly [string, string]> = [
  ['leve', 'Veículo leve'],
  ['caminhonete', 'Caminhonete'],
  ['cacamba', 'Caminhão caçamba'],
  ['carga-seca', 'Caminhão carga seca'],
  ['cavalo', 'Caminhão cavalo'],
  ['munck', 'Caminhão munck'],
  ['pipa', 'Caminhão pipa'],
  ['canavieira', 'Carreta canavieira'],
  ['rodomuda', 'Carreta rodomuda'],
  ['colhedora', 'Colhedora'],
  ['prancha', 'Reboque prancha'],
  ['trator', 'Trator'],
  ['vivencia', 'Área de vivência'],
];

/** Catálogo estável consumido pelos cards, relatórios e pré-carregamento. */
export const EQUIPMENT_IMAGES: EquipmentImage[] = EQUIPMENT_IMAGE_DEFINITIONS.map(
  ([key, label]) => ({
    key,
    label,
    src: `/equipment-types/${key}.png`,
  }),
);

const IMAGE_BY_KEY = new Map(EQUIPMENT_IMAGES.map((image) => [image.key, image]));
const IMAGE_KEYS = new Set(IMAGE_BY_KEY.keys());

type IdentityKey = EquipmentImage['key'];

type IdentityAnalysis = {
  keys: Set<IdentityKey>;
  noImageKinds: Set<string>;
};

interface UnknownRecord {
  [key: string]: unknown;
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' ? (value as UnknownRecord) : null;
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

/** Normaliza acentos, separadores, hífens, underscores e nomes em camelCase. */
function normalizeIdentity(value: unknown): string {
  return text(value)
    .replace(/([a-záàâãéêíóôõúç])([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/g, '$1 $2')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function compact(value: string): string {
  return value.replace(/\s/g, '');
}

function hasWord(value: string, pattern: RegExp): boolean {
  return pattern.test(value);
}

function hasPhrase(value: string, phrase: string): boolean {
  return value === phrase || value.includes(`${phrase} `) || value.includes(` ${phrase}`);
}

function hasAny(value: string, phrases: readonly string[]): boolean {
  const compactValue = compact(value);
  return phrases.some((phrase) => {
    const normalizedPhrase = normalizeIdentity(phrase);
    return hasPhrase(value, normalizedPhrase) || compactValue.includes(compact(normalizedPhrase));
  });
}

function addKey(analysis: IdentityAnalysis, key: IdentityKey): void {
  analysis.keys.add(key);
}

/**
 * Lê somente identidade curta do equipamento/grupo. Narrativa, motivo, ponto
 * e setor nunca entram nesta função nem em nenhum dos campos pesquisados.
 */
function analyzeIdentity(value: unknown): IdentityAnalysis {
  const normalized = normalizeIdentity(value);
  const analysis: IdentityAnalysis = { keys: new Set(), noImageKinds: new Set() };
  if (!normalized) return analysis;

  const joined = compact(normalized);

  // Categorias sem PNG: servem como sinal de bloqueio, nunca como fallback.
  if (hasWord(normalized, /\bcoleta\b/)) analysis.noImageKinds.add('coleta');

  // Tipos com fotografia própria. As formas compactas cobrem, por exemplo,
  // "carga-seca", "cargaSeca", "reboqueprancha" e IDs de categoria.
  if (
    hasPhrase(normalized, 'veiculo leve') ||
    joined.includes('veiculoleve') ||
    hasWord(normalized, /\bleves?\b/) && hasWord(normalized, /\bveiculos?\b/) ||
    hasWord(normalized, /\bcarro\b/) ||
    hasWord(normalized, /\bautomovel\b/) ||
    hasWord(normalized, /\b(?:sedan|hatch)\b/) ||
    hasWord(normalized, /\borochi\b/)
  ) {
    addKey(analysis, 'leve');
  }

  if (
    hasWord(normalized, /\bcaminhonetes?\b/) ||
    hasWord(normalized, /\bpicapes?\b/) ||
    hasPhrase(normalized, 'pick up') ||
    joined.includes('pickup')
  ) {
    addKey(analysis, 'caminhonete');
  }

  if (
    hasPhrase(normalized, 'carga seca') ||
    joined.includes('cargaseca')
  ) {
    addKey(analysis, 'carga-seca');
  }

  if (hasWord(normalized, /\bcacambas?\b/)) addKey(analysis, 'cacamba');
  if (hasWord(normalized, /\bcavalos?\b/)) addKey(analysis, 'cavalo');
  if (hasWord(normalized, /\bmunck\b/) || hasWord(normalized, /\bguindauto\b/)) addKey(analysis, 'munck');
  if (hasWord(normalized, /\bpipa\b/)) addKey(analysis, 'pipa');

  if (
    hasWord(normalized, /\bcanavieir\w*\b/) ||
    hasPhrase(normalized, 'carreta de cana') ||
    hasPhrase(normalized, 'carretas de cana') ||
    joined.includes('carretacanavieira') ||
    joined.includes('carretascanavieiras')
  ) {
    addKey(analysis, 'canavieira');
  }

  if (hasWord(normalized, /\brodomud\w*\b/) || joined.includes('carretarodomuda')) {
    addKey(analysis, 'rodomuda');
  }

  if (
    hasWord(normalized, /\bcolhedor\w*\b/) ||
    joined.includes('colhedoracana') ||
    joined.includes('colhedorascana')
  ) {
    addKey(analysis, 'colhedora');
  }

  if (
    hasWord(normalized, /\bpranchas?\b/) ||
    hasPhrase(normalized, 'reboque prancha') ||
    joined.includes('reboqueprancha') ||
    joined.includes('pranchasimplemento')
  ) {
    addKey(analysis, 'prancha');
  }

  // A única imagem compartilhada de transbordo/reboque é a de trator. Não
  // se afirma o subtipo no label: "Trator Geral", "Trator Transbordo" e
  // "Trator Reboque" resolvem todos para a chave trator.
  if (hasWord(normalized, /\btrator(?:es)?\b/) || joined.includes('tratorgeral')) {
    addKey(analysis, 'trator');
  }

  if (
    hasWord(normalized, /\bvivencia\b/) ||
    hasPhrase(normalized, 'area de vivencia') ||
    joined.includes('areadevivencia')
  ) {
    addKey(analysis, 'vivencia');
  }

  return analysis;
}

function analysisIsAmbiguous(analysis: IdentityAnalysis): boolean {
  return analysis.keys.size > 1 || (analysis.keys.size > 0 && analysis.noImageKinds.size > 0);
}

function imageForIdentity(value: unknown): EquipmentImage | null | undefined {
  const analysis = analyzeIdentity(value);
  if (analysisIsAmbiguous(analysis)) return null;
  if (!analysis.keys.size) return undefined;
  return IMAGE_BY_KEY.get([...analysis.keys][0]) || null;
}

function valuesFromRecord(record: UnknownRecord, names: readonly string[]): unknown[] {
  return names.flatMap((name) => {
    const value = record[name];
    if (name !== 'group' || value === null || value === undefined) return [value];
    if (typeof value === 'string' || typeof value === 'number') return [value];
    const group = asRecord(value);
    if (!group) return [];
    return [group.nome, group.name, group.label, group.categoria, group.id];
  });
}

function firstIdentityInTier(values: unknown[]): EquipmentImage | null | undefined {
  let found: EquipmentImage | undefined;
  let hadAmbiguous = false;

  for (const value of values) {
    if (value === null || value === undefined || text(value) === '') continue;
    const result = imageForIdentity(value);
    if (result === null) hadAmbiguous = true;
    if (result && found && found.key !== result.key) return null;
    if (result) found = result;
  }

  // Um texto que declara dois equipamentos é uma identidade inválida, mesmo
  // que outro campo da mesma camada tenha uma imagem aproveitável.
  if (hadAmbiguous) return null;
  return found;
}

function standardImageForFleet(value: unknown): EquipmentImage | null {
  const fleet = text(value);
  if (!fleet) return null;

  const category = CATEGORIAS_PADRAO.find((candidate) => candidate.frotas.includes(fleet));
  if (!category) return null;

  const keyByCategoryId: Record<string, IdentityKey | undefined> = {
    carretas_canavieiras: 'canavieira',
    colhedoras_cana: 'colhedora',
    trator_geral: 'trator',
    carretas_rodomuda: 'rodomuda',
    munck: 'munck',
    pipa: 'pipa',
    cacambas: 'cacamba',
    cavalo: 'cavalo',
    // A fonte possui categorias sem imagem fornecida.
    coleta: undefined,
    veiculos: undefined,
    pranchas: 'prancha',
    vivencia: 'vivencia',
  };
  const key = keyByCategoryId[category.id];
  return key ? IMAGE_BY_KEY.get(key) || null : null;
}

function explicitIdentityValues(record: UnknownRecord, names: readonly string[]): unknown[] {
  return valuesFromRecord(record, names).filter((value) => text(value) !== '');
}

function hasNoImageIdentity(values: unknown[]): boolean {
  return values.some((value) => analyzeIdentity(value).noImageKinds.size > 0);
}

function tierHasContradiction(values: unknown[], standard: EquipmentImage | null): boolean {
  if (!standard) return false;
  for (const value of values) {
    const result = imageForIdentity(value);
    if (result && result.key !== standard.key) return true;
    if (result === null) return true;
  }
  return false;
}

function isEquipmentImage(value: unknown): value is EquipmentImage {
  const record = asRecord(value);
  return Boolean(
    record &&
      typeof record.key === 'string' &&
      (IMAGE_KEYS.has(record.key) || record.key.startsWith('group:') && typeof record.src === 'string' && isEquipmentStorageImage(record.src)) &&
      typeof record.label === 'string' &&
      typeof record.src === 'string',
  );
}

/**
 * Resolve a fotografia sem consultar narrativa, motivo, ponto ou setor.
 *
 * A ordem é: grupo/categoria do cadastro, nome do equipamento cadastrado,
 * grupo/modelo da fonte e, por último, o mapa exato de frota padrão. Um grupo
 * cadastrado explicitamente prevalece sobre uma fonte divergente; conflitos
 * dentro da mesma identidade são recusados em vez de receberem um chute.
 */
export function resolveEquipmentImage(input: unknown): EquipmentImage | null {
  if (isEquipmentImage(input)) return input.key.startsWith('group:') ? input : IMAGE_BY_KEY.get(input.key) || null;
  const custom = resolveCustomEquipmentImage(input);
  if(custom) return custom;
  if (typeof input === 'string' || typeof input === 'number') {
    const result = imageForIdentity(input);
    return result === null || result === undefined ? null : result;
  }

  const record = asRecord(input);
  if (!record) return null;

  const standard = standardImageForFleet(record.frota);
  const registryValues = explicitIdentityValues(record, ['apoio', 'apoioNome', 'categoria', 'group']);
  const equipmentValues = explicitIdentityValues(record, ['equipamento', 'nome', 'nomeFrota']);
  const sourceValues = explicitIdentityValues(record, ['grupo_fonte', 'modelo', 'model', 'modelPCM']);

  // Grupo/categoria e nome cadastrado são a identidade própria. Quando um
  // deles é explícito, não se deixa uma fonte conflitante sobrescrevê-lo.
  if (hasNoImageIdentity(registryValues)) return null;
  const registryResult = firstIdentityInTier(registryValues);
  if (registryResult !== undefined) return registryResult;

  if (hasNoImageIdentity(equipmentValues)) return null;
  const equipmentResult = firstIdentityInTier(equipmentValues);
  if (equipmentResult !== undefined) return equipmentResult;

  if (hasNoImageIdentity(sourceValues)) return null;
  const sourceResult = firstIdentityInTier(sourceValues);
  if (sourceResult !== undefined) {
    // Um mapa de frota é apenas fallback. Se uma fonte forte contradiz esse
    // mapa, retornar null é mais seguro que exibir uma foto errada.
    if (sourceResult && tierHasContradiction(sourceValues, standard)) return null;
    return sourceResult;
  }

  // A presença de uma identidade não mapeada (coleta, veículos genéricos ou
  // caminhão genérico) não cria uma fotografia; só o mapa exato pode fazê-lo.
  if (
    hasNoImageIdentity(registryValues) ||
    hasNoImageIdentity(equipmentValues) ||
    hasNoImageIdentity(sourceValues)
  ) {
    return null;
  }
  return standard;
}

const imageDataCache = new Map<string, Promise<LoadedEquipmentImage>>();
const MAX_IMAGE_DIMENSION = 400;
const IMAGE_TIMEOUT_MS = 5000;

function browserImageAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof window.location !== 'undefined' &&
    typeof (globalThis as { Image?: unknown }).Image === 'function'
  );
}

function sameOriginUrl(src: string): string | null {
  if (!browserImageAvailable()) return null;
  try {
    const url = new URL(src, window.location.href);
    return url.origin === window.location.origin || isEquipmentStorageImage(url.href) ? url.href : null;
  } catch {
    return null;
  }
}

function loadImageData(image: EquipmentImage): Promise<LoadedEquipmentImage> {
  const cached = imageDataCache.get(image.src);
  if (cached) return cached;

  const promise = new Promise<LoadedEquipmentImage>((resolve, reject) => {
    const src = sameOriginUrl(image.src);
    const ImageConstructor = (globalThis as { Image?: new () => HTMLImageElement }).Image;
    if (!src || !ImageConstructor) {
      reject(new Error('Imagens de equipamentos só podem ser carregadas no navegador.'));
      return;
    }

    const element = new ImageConstructor();
    let settled = false;
    const timer = window.setTimeout(() => finish(new Error('Tempo esgotado ao carregar a imagem do equipamento.')), IMAGE_TIMEOUT_MS);

    const cleanup = () => {
      window.clearTimeout(timer);
      element.onload = null;
      element.onerror = null;
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) {
        reject(error);
        return;
      }

      const sourceWidth = Number(element.naturalWidth || element.width);
      const sourceHeight = Number(element.naturalHeight || element.height);
      if (!sourceWidth || !sourceHeight) {
        reject(new Error('A imagem do equipamento não informou dimensões válidas.'));
        return;
      }

      const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Não foi possível criar o canvas da imagem do equipamento.'));
        return;
      }
      context.drawImage(element, 0, 0, width, height);
      try {
        resolve({ image, dataUrl: canvas.toDataURL('image/png'), width, height });
      } catch {
        reject(new Error('Não foi possível converter a imagem do equipamento.'));
      }
    };

    element.onload = () => finish();
    element.onerror = () => finish(new Error('Não foi possível carregar a imagem do equipamento.'));
    if(isEquipmentStorageImage(src)) element.crossOrigin='anonymous';
    element.src = src;
  });

  let trackedPromise: Promise<LoadedEquipmentImage>;
  trackedPromise = promise.catch((error) => {
    // Falhas nunca ficam presas no cache: uma chamada posterior pode tentar
    // novamente depois de o asset ou a conexão serem corrigidos.
    if (imageDataCache.get(image.src) === trackedPromise) imageDataCache.delete(image.src);
    throw error;
  });
  imageDataCache.set(image.src, trackedPromise);
  return trackedPromise;
}

/** Carrega uma imagem e retorna null fora do browser ou em caso de falha. */
export async function loadEquipmentImageData(input: unknown): Promise<LoadedEquipmentImage | null> {
  const image = resolveEquipmentImage(input);
  if (!image || !browserImageAvailable()) return null;
  try {
    return await loadImageData(image);
  } catch {
    return null;
  }
}

/** Pré-carrega cada tipo no máximo uma vez e indexa o resultado pela chave. */
export async function preloadEquipmentImages(
  rows: unknown[],
): Promise<Map<string, LoadedEquipmentImage>> {
  if(browserImageAvailable()) await refreshEquipmentImageOverrides().catch(() => undefined);
  const images = new Map<string, EquipmentImage>();
  for (const row of rows) {
    const image = resolveEquipmentImage(row);
    if (image) images.set(image.key, image);
  }

  const loaded = await Promise.all(
    [...images.values()].map(async (image) => ({ image, data: await loadEquipmentImageData(image) })),
  );
  return new Map(
    loaded
      .filter((entry): entry is { image: EquipmentImage; data: LoadedEquipmentImage } => Boolean(entry.data))
      .map(({ image, data }) => [image.key, data]),
  );
}
