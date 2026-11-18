import { oficinaLabel, type ApoioReportRow } from '../types/apoio';
import { isApoioClosed } from './apoioFilters';
import { reportFleet } from './apoioReportData';
import { isEmergencyOrder } from './tvOrders';

/**
 * Relatório "Equipamentos em Oficina de Terceiros" e variações com
 * emergenciais em Oficina Interna / Campo (separado ou junto).
 *
 * Projeção mínima usada para cobrar retorno da manutenção: somente frota,
 * modelo e a oficina externa / local emergencial onde o equipamento está.
 * A seleção parte das ordens já filtradas na tela e não altera a fonte.
 */
export const OFICINA_TERCEIROS_TITLE = 'Equipamentos em Oficina de Terceiros';
export const EMERGENCIA_INTERNA_CAMPO_TITLE = 'Emergenciais · Oficina Interna e Campo';
export const OFICINA_E_EMERGENCIA_TITLE = 'Oficina de Terceiros e Emergenciais (Interna / Campo)';
export const OFICINA_TERCEIROS_IMAGE = { width: 921, height: 1600 } as const;

export type OficinaTerceirosScope = 'externa' | 'emergencia' | 'juntos';
export type OficinaReportCategory = 'terceiros' | 'emergencial_interna' | 'emergencial_campo';
export type OficinaReportFormat = 'celular' | 'tablet' | 'computador';
export type OficinaReportQuality = 'padrao' | 'alta' | 'ultra';

export interface OficinaReportFormatSpec {
  label: string;
  shortLabel: string;
  width: number;
  minHeight: number;
  maxHeight: number;
  scales: Record<OficinaReportQuality, number>;
}

export const OFICINA_REPORT_FORMATS: Record<OficinaReportFormat, OficinaReportFormatSpec> = {
  celular: {
    label: 'Celular · vertical (921 px)',
    shortLabel: 'Celular',
    width: 921,
    minHeight: 1600,
    maxHeight: 12000,
    scales: { padrao: 1, alta: 2, ultra: 3 },
  },
  tablet: {
    label: 'Tablet · retrato HD (1240 px)',
    shortLabel: 'Tablet',
    width: 1240,
    minHeight: 1560,
    maxHeight: 12000,
    scales: { padrao: 1, alta: 2, ultra: 2.5 },
  },
  computador: {
    label: 'Computador · widescreen (1680 px)',
    shortLabel: 'Computador',
    width: 1680,
    minHeight: 945,
    maxHeight: 10000,
    scales: { padrao: 1, alta: 2, ultra: 2.5 },
  },
};

export const OFICINA_REPORT_QUALITIES: Record<OficinaReportQuality, { label: string; shortLabel: string }> = {
  alta: { label: 'Alta · 2× nitidez (recomendada)', shortLabel: 'Alta (2×)' },
  ultra: { label: 'Ultra · máxima definição', shortLabel: 'Ultra' },
  padrao: { label: 'Padrão · 1× arquivo leve', shortLabel: 'Padrão (1×)' },
};

export const OFICINA_FORMAT_STORAGE_KEY = 'branco-peres-apoio-oficina-format';
export const OFICINA_QUALITY_STORAGE_KEY = 'branco-peres-apoio-oficina-quality';

export interface OficinaTerceirosEntry {
  frota: string;
  modelo: string;
  prestador: string;
  /** Grupo Apoio, usado apenas para a cor de identificação da linha. */
  grupo: string;
  /** Origem do registro no relatório (oficina externa ou emergencial interna/campo). */
  categoria?: OficinaReportCategory;
  /** Local normalizado (Oficina Externa, Oficina Interna ou Campo). */
  local?: string;
  /** Verdadeiro quando a ordem possui classe emergencial explícita. */
  emergencial?: boolean;
  /** Nome/tipo do equipamento para resolução da ilustração. */
  equipamento?: string;
  /** Identificador de grupo Apoio para consulta direta no registry de imagens. */
  grupo_id?: string;
  /** Grupo da fonte original para fallback no registry de imagens. */
  grupo_fonte?: string;
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function fleetKey(frota: string): string {
  return frota
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function isInformativeProvider(provider: string, location: string): boolean {
  const folded = fold(provider);
  if (!folded) return false;
  if (['nao informado', 'prestador nao informado', 'sem prestador', 'nao informada'].includes(folded)) {
    return false;
  }
  return folded !== fold(location);
}

function emergencyLocationLabel(row: ApoioReportRow, location: 'Oficina Interna' | 'Campo'): string {
  const prestador = clean(row.prestador);
  const setor = clean(row.setor);
  const ponto = clean(row.ponto);
  if (isInformativeProvider(prestador, location)) {
    return `${location} · ${prestador} (Emergencial)`;
  }
  const detail = setor || ponto;
  if (detail && fold(detail) !== fold(location)) {
    return `${location} · ${detail} (Emergencial)`;
  }
  return `${location} · Emergencial`;
}

export const OFICINA_SCOPE_STORAGE_KEY = 'branco-peres-apoio-oficina-scope';

export function normalizeOficinaScope(value: unknown): OficinaTerceirosScope {
  const normalized = String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
  if (normalized === 'emergencia' || normalized === 'emergencias' || normalized === 'separados' || normalized === 'separado_emergencia') {
    return 'emergencia';
  }
  if (normalized === 'juntos' || normalized === 'junto') {
    return 'juntos';
  }
  return 'externa';
}

export function readStoredOficinaScope(): OficinaTerceirosScope {
  if (typeof window === 'undefined') return 'externa';
  try {
    return normalizeOficinaScope(window.localStorage.getItem(OFICINA_SCOPE_STORAGE_KEY));
  } catch {
    return 'externa';
  }
}

export function saveStoredOficinaScope(scope: OficinaTerceirosScope): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFICINA_SCOPE_STORAGE_KEY, normalizeOficinaScope(scope));
  } catch {
    /* preferência opcional quando localStorage estiver bloqueado */
  }
}

export function normalizeOficinaFormat(value: unknown): OficinaReportFormat {
  const normalized = fold(clean(value));
  if (normalized === 'tablet') return 'tablet';
  if (normalized === 'computador' || normalized === 'desktop' || normalized === 'pc') return 'computador';
  return 'celular';
}

export function readStoredOficinaFormat(): OficinaReportFormat {
  if (typeof window === 'undefined') return 'celular';
  try {
    return normalizeOficinaFormat(window.localStorage.getItem(OFICINA_FORMAT_STORAGE_KEY));
  } catch {
    return 'celular';
  }
}

export function saveStoredOficinaFormat(format: OficinaReportFormat): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFICINA_FORMAT_STORAGE_KEY, normalizeOficinaFormat(format));
  } catch {
    /* preferência opcional */
  }
}

export function normalizeOficinaQuality(
  value: unknown,
  fallback: OficinaReportQuality = 'alta',
): OficinaReportQuality {
  const normalized = fold(clean(value));
  if (normalized === 'padrao' || normalized === 'standard' || normalized === '1x') return 'padrao';
  if (normalized === 'ultra' || normalized === 'maxima') return 'ultra';
  if (normalized === 'alta' || normalized === 'high' || normalized === '2x') return 'alta';
  return fallback;
}

export function readStoredOficinaQuality(): OficinaReportQuality {
  if (typeof window === 'undefined') return 'alta';
  try {
    return normalizeOficinaQuality(window.localStorage.getItem(OFICINA_QUALITY_STORAGE_KEY), 'alta');
  } catch {
    return 'alta';
  }
}

export function saveStoredOficinaQuality(quality: OficinaReportQuality): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFICINA_QUALITY_STORAGE_KEY, normalizeOficinaQuality(quality));
  } catch {
    /* preferência opcional */
  }
}

const OFICINA_MAX_CANVAS_SIDE = 16000;
const OFICINA_MAX_CANVAS_PIXELS = 60_000_000;

export function resolveOficinaRenderDimensions(
  format: OficinaReportFormat = 'celular',
  quality: OficinaReportQuality = 'padrao',
  contentHeight?: number,
): {
  format: OficinaReportFormat;
  quality: OficinaReportQuality;
  cssWidth: number;
  cssHeight: number;
  requestedScale: number;
  scale: number;
  pixelWidth: number;
  pixelHeight: number;
  clamped: boolean;
} {
  const safeFormat = normalizeOficinaFormat(format);
  const safeQuality = normalizeOficinaQuality(quality, 'padrao');
  const spec = OFICINA_REPORT_FORMATS[safeFormat];
  const cssWidth = spec.width;
  const cssHeight = Math.max(spec.minHeight, Math.ceil(contentHeight ?? spec.minHeight));
  const requestedScale = spec.scales[safeQuality];

  let scale = requestedScale;
  if (requestedScale > 1) {
    const maxBySide = OFICINA_MAX_CANVAS_SIDE / Math.max(cssWidth, cssHeight);
    const maxByArea = Math.sqrt(OFICINA_MAX_CANVAS_PIXELS / (cssWidth * cssHeight));
    const capped = Math.min(requestedScale, maxBySide, maxByArea);
    scale = Math.max(1, Number(capped.toFixed(2)));
  }

  return {
    format: safeFormat,
    quality: safeQuality,
    cssWidth,
    cssHeight,
    requestedScale,
    scale,
    pixelWidth: Math.round(cssWidth * scale),
    pixelHeight: Math.round(cssHeight * scale),
    clamped: scale + 0.001 < requestedScale,
  };
}

export function oficinaScopeLabel(scope: OficinaTerceirosScope = 'externa'): string {
  if (scope === 'emergencia') return 'Separado · Somente Emergenciais (Oficina Interna e Campo)';
  if (scope === 'juntos') return 'Junto · Oficina de Terceiros + Emergenciais (Interna e Campo)';
  return 'Separado · Somente Oficina de Terceiros';
}

export function oficinaReportTitle(scope: OficinaTerceirosScope = 'externa'): string {
  if (scope === 'emergencia') return EMERGENCIA_INTERNA_CAMPO_TITLE;
  if (scope === 'juntos') return OFICINA_E_EMERGENCIA_TITLE;
  return OFICINA_TERCEIROS_TITLE;
}

export function oficinaReportFilenameBase(scope: OficinaTerceirosScope = 'externa'): string {
  if (scope === 'emergencia') return 'equipamentos-emergenciais-interna-campo';
  if (scope === 'juntos') return 'equipamentos-terceiros-e-emergenciais';
  return 'equipamentos-oficina-terceiros';
}

function rowMatchesScopeCategory(
  row: ApoioReportRow,
  includeExterna: boolean,
  includeEmergencia: boolean,
): OficinaReportCategory | null {
  if (row.ativo === false || isApoioClosed(row)) return null;
  const location = oficinaLabel(clean(row.origem));
  const isExternal = location === 'Oficina Externa';
  const isInternalOrFieldEmergency =
    isEmergencyOrder(row) && (location === 'Oficina Interna' || location === 'Campo');
  if (isExternal && includeExterna) return 'terceiros';
  if (isInternalOrFieldEmergency && includeEmergencia) {
    return location === 'Campo' ? 'emergencial_campo' : 'emergencial_interna';
  }
  return null;
}

/**
 * Seleciona equipamentos ativos em manutenção conforme o escopo escolhido:
 * - 'externa': apenas Oficina Externa (comportamento padrão).
 * - 'emergencia': apenas ordens emergenciais em Oficina Interna ou Campo.
 * - 'juntos': Oficina Externa + emergenciais em Oficina Interna ou Campo.
 * Mantém uma linha por frota na ordem da seleção atual.
 */
export function selectOficinaReportEquipment(
  rows: readonly ApoioReportRow[],
  scope: OficinaTerceirosScope = 'externa',
): OficinaTerceirosEntry[] {
  const seen = new Set<string>();
  const entries: OficinaTerceirosEntry[] = [];
  const includeExterna = scope === 'externa' || scope === 'juntos';
  const includeEmergencia = scope === 'emergencia' || scope === 'juntos';

  for (const row of rows) {
    const categoria = rowMatchesScopeCategory(row, includeExterna, includeEmergencia);
    if (!categoria) continue;

    const location = oficinaLabel(clean(row.origem));
    const frota = reportFleet(row);
    if (frota === 'Sem frota informada') continue;
    const key = fleetKey(frota);
    if (seen.has(key)) continue;
    seen.add(key);

    const prestador =
      categoria === 'terceiros'
        ? clean(row.prestador) || 'Oficina não informada'
        : emergencyLocationLabel(row, location as 'Oficina Interna' | 'Campo');

    entries.push({
      frota,
      modelo: clean(row.modelo) || clean(row.equipamento) || 'Modelo não informado',
      prestador,
      grupo: clean(row.apoio),
      categoria,
      local: location,
      emergencial: isEmergencyOrder(row),
      equipamento: clean(row.equipamento),
      grupo_fonte: clean(row.grupo_fonte),
    });
  }

  return entries;
}

/**
 * Mantém apenas ordens ativas em Oficina Externa, uma linha por frota, na
 * ordem da seleção atual. Ordem encerrada ou ausente da listagem não é um
 * equipamento parado em oficina de terceiros.
 */
export function selectOficinaTerceirosEquipment(
  rows: readonly ApoioReportRow[],
): OficinaTerceirosEntry[] {
  return selectOficinaReportEquipment(rows, 'externa');
}

/**
 * Seleciona todas as ordens (ApoioReportRow) correspondentes ao escopo e aos
 * filtros/checkmarks definidos no relatório de Oficina de Terceiros, para
 * exportações de dados (Excel e PDF) alinhadas ao modo separado/junto.
 */
export function selectOficinaReportOrders(
  rows: readonly ApoioReportRow[],
  scope: OficinaTerceirosScope = 'externa',
  options: OficinaTerceirosFilter & { excludedFleets?: readonly string[] } = {},
): ApoioReportRow[] {
  const equipment = filterOficinaTerceirosEntries(
    selectOficinaReportEquipment(rows, scope),
    { query: options.query, prestadores: options.prestadores },
  );
  const excluded = new Set((options.excludedFleets ?? []).map(frota => fleetKey(clean(frota))));
  const selectedFleets = new Set(
    equipment
      .filter(entry => !excluded.has(fleetKey(entry.frota)))
      .map(entry => fleetKey(entry.frota)),
  );
  if (!selectedFleets.size) return [];

  const includeExterna = scope === 'externa' || scope === 'juntos';
  const includeEmergencia = scope === 'emergencia' || scope === 'juntos';

  return rows.filter(row => {
    if (!rowMatchesScopeCategory(row, includeExterna, includeEmergencia)) return false;
    const frota = reportFleet(row);
    if (frota === 'Sem frota informada') return false;
    return selectedFleets.has(fleetKey(frota));
  });
}

/** Resumo exibido no aplicativo antes da exportação. */
export function oficinaTerceirosSummary(
  entries: readonly OficinaTerceirosEntry[],
  scope: OficinaTerceirosScope = 'externa',
): string {
  const equipamentos = entries.length === 1 ? '1 equipamento' : `${entries.length} equipamentos`;
  if (scope === 'emergencia') {
    const interna = entries.filter(entry => entry.categoria === 'emergencial_interna').length;
    const campo = entries.filter(entry => entry.categoria === 'emergencial_campo').length;
    return `${equipamentos} emergenciais (${interna} oficina interna · ${campo} campo)`;
  }
  if (scope === 'juntos') {
    const terceiros = entries.filter(entry => entry.categoria !== 'emergencial_interna' && entry.categoria !== 'emergencial_campo').length;
    const emergenciais = entries.length - terceiros;
    return `${equipamentos} (${terceiros} terceiros · ${emergenciais} emergenciais interna/campo)`;
  }
  const oficinas = new Set(entries.map(entry => entry.prestador.toLocaleLowerCase('pt-BR')));
  const totalOficinas = oficinas.size === 1 ? '1 oficina' : `${oficinas.size} oficinas`;
  return `${equipamentos} em oficina de terceiros · ${totalOficinas}`;
}

export interface OficinaTerceirosFilter {
  /** Busca livre em frota, modelo e oficina/local. */
  query?: string;
  /** Oficinas/locais selecionados; vazio considera todos. */
  prestadores?: readonly string[];
}

/**
 * Filtro exclusivo do relatório: não altera a lista de ordens da tela, apenas
 * quais equipamentos saem na imagem.
 */
export function filterOficinaTerceirosEntries(
  entries: readonly OficinaTerceirosEntry[],
  filter: OficinaTerceirosFilter = {},
): OficinaTerceirosEntry[] {
  const terms = fold(String(filter.query ?? '').trim()).split(/\s+/).filter(Boolean);
  const providers = new Set((filter.prestadores ?? []).map(prestador => prestador.toLocaleLowerCase('pt-BR')));
  return entries.filter(entry => {
    if (providers.size && !providers.has(entry.prestador.toLocaleLowerCase('pt-BR'))) return false;
    if (!terms.length) return true;
    const haystack = fold(`${entry.frota} ${entry.modelo} ${entry.prestador} ${entry.local ?? ''}`);
    return terms.every(term => haystack.includes(term));
  });
}

/** Oficinas ou locais presentes na seleção, com a quantidade de equipamentos de cada um. */
export function oficinaTerceirosProviderOptions(
  entries: readonly OficinaTerceirosEntry[],
): { value: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.prestador, (counts.get(entry.prestador) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

export function oficinaEntryCategoryLabel(entry: OficinaTerceirosEntry): string {
  if (entry.categoria === 'emergencial_interna') return 'Emergencial · Oficina Interna';
  if (entry.categoria === 'emergencial_campo') return 'Emergencial · Campo';
  return 'Oficina Externa (Terceiros)';
}

/** Estrutura pura usada para gerar a planilha Excel do relatório separado/junto. */
export function buildOficinaTerceirosExcelData(
  entries: readonly OficinaTerceirosEntry[],
  scopedRows: readonly ApoioReportRow[],
  options: { scope?: OficinaTerceirosScope; query?: string; prestadores?: readonly string[]; generatedAt?: Date } = {},
) {
  const scope: OficinaTerceirosScope = options.scope ?? 'externa';
  const generatedAt = options.generatedAt ?? new Date();
  const equipmentRows = entries.map(entry => ({
    Equipamento: entry.frota,
    Modelo: entry.modelo,
    'Prestador / Local': entry.prestador,
    'Origem no relatório': oficinaEntryCategoryLabel(entry),
    'Grupo Apoio': entry.grupo || 'Não informado',
    Emergencial: entry.emergencial || entry.categoria === 'emergencial_interna' || entry.categoria === 'emergencial_campo' ? 'Sim' : 'Não',
  }));
  const orderRows = scopedRows.map(row => ({
    Frota: reportFleet(row),
    OS: clean(row.os) || '—',
    Equipamento: clean(row.modelo) || clean(row.equipamento) || 'Modelo não informado',
    'Grupo Apoio': clean(row.apoio) || 'Não informado',
    Origem: oficinaLabel(clean(row.origem)),
    Prestador: clean(row.prestador) || 'Não informado',
    Classe: clean(row.classe) || 'Não informada',
    Status: clean(row.status) || 'Não informado',
    Entrada: clean(row.entrada),
    Previsão: clean(row.previsao),
    Narrativa: clean(row.narrativa),
  }));
  const metaRows: Array<[string, string | number]> = [
    ['Relatório', oficinaReportTitle(scope)],
    ['Modo de visualização', oficinaScopeLabel(scope)],
    ['Resumo', oficinaTerceirosSummary(entries, scope)],
    ['Equipamentos exportados', entries.length],
    ['Ordens vinculadas', scopedRows.length],
    ['Filtro de busca', clean(options.query) || 'Nenhum'],
    ['Oficinas / locais selecionados', options.prestadores?.length ? options.prestadores.join(', ') : 'Todos'],
    ['Gerado em', generatedAt.toISOString()],
  ];
  return { equipmentRows, orderRows, metaRows };
}

