import { getMaintenanceOrderClosure } from './maintenanceTracking';
import {
  oficinaLabel,
  type ApoioData,
  type ApoioOrder,
  type ApoioReportRow,
} from '../types/apoio';

export type TVStatusFilter = 'Andamento' | 'abertas';
export type TVSort = 'oldest' | 'newest' | 'fleet' | 'deadline';

export interface TVFilters {
  groups: string[];
  query: string;
  location: string;
  provider: string;
  sector: string;
  reason: string;
  minDays: number;
  sort: TVSort;
  status: TVStatusFilter;
  emergencyOnly: boolean;
}

export const defaultTVFilters: TVFilters = {
  groups: [], query: '', location: '', provider: '', sector: '', reason: '',
  minDays: 0, sort: 'oldest', status: 'Andamento', emergencyOnly: true,
};
export const DEFAULT_TV_FILTERS: TVFilters = { ...defaultTVFilters, groups: [] };

export type TVDeadlineState = 'overdue' | 'today' | 'upcoming' | 'unknown';
export const TV_CLASS_DATA_WARNING =
  'A classe da ordem não está disponível no snapshot Apoio. A TV não pode inferir emergência pela narrativa ou pelo motivo.';

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

/** Normalização de acentos e separadores apenas para comparar categorias. */
function category(value: unknown): string {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('pt-BR')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Emergência vem exclusivamente de classe, nunca de narrativa ou motivo. */
export function isEmergencyOrder(row: Pick<ApoioOrder, 'classe'>): boolean {
  const value = category(row?.classe);
  return value === 'CORRET EMERGENCIAL';
}

export function isInProgress(row: Pick<ApoioOrder, 'status'>): boolean {
  const value = category(row?.status);
  return value === 'ANDAMENTO' || value === 'EM ANDAMENTO';
}

function isOpenStatus(row: Pick<ApoioOrder, 'status'>): boolean {
  return new Set(['PROGRAMADA', 'ANDAMENTO', 'EM ANDAMENTO', 'AGUARDANDO PECA']).has(category(row?.status));
}

interface ISODateParts {
  year: number; month: number; day: number; hour: number; minute: number;
  second: number; millisecond: number; dateOnly: boolean; hasZone: boolean;
}

function validCalendarDate(year: number, month: number, day: number): boolean {
  if (![year, month, day].every(Number.isInteger)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseISODateParts(value: string): ISODateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:(?:T|\s)(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dateOnly = !match[4];
  const hour = Number(match[4] || 0);
  const minute = Number(match[5] || 0);
  const second = Number(match[6] || 0);
  const fraction = match[7] || '';
  const millisecond = fraction ? Number((fraction + '000').slice(0, 3)) : 0;
  const hasZone = Boolean(match[8]);
  if (!validCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) return null;
  if (hasZone && match[8] !== 'Z') {
    const zone = /[+-](\d{2}):?(\d{2})$/.exec(match[8]);
    if (!zone || Number(zone[1]) > 23 || Number(zone[2]) > 59) return null;
  }
  return { year, month, day, hour, minute, second, millisecond, dateOnly, hasZone };
}

function saoPauloParts(timestamp: number): Record<string, number> | null {
  if (!Number.isFinite(timestamp)) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(timestamp));
  const result: Record<string, number> = {};
  for (const part of parts) if (part.type !== 'literal') result[part.type] = Number(part.value);
  return result.year && result.month && result.day ? result : null;
}

function saoPauloOffset(timestamp: number): number | null {
  const parts = saoPauloParts(timestamp);
  if (!parts) return null;
  const wallAsUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wallAsUTC - timestamp;
}

function saoPauloWallTimestamp(parts: ISODateParts): number | null {
  const wallAsUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond);
  if (!Number.isFinite(wallAsUTC)) return null;
  const offset = saoPauloOffset(wallAsUTC);
  if (offset === null) return null;
  const timestamp = wallAsUTC - offset;
  const check = saoPauloParts(timestamp);
  if (!check || check.year !== parts.year || check.month !== parts.month || check.day !== parts.day ||
      check.hour !== parts.hour || check.minute !== parts.minute || check.second !== parts.second) return null;
  return timestamp;
}

/** ISO date/date-time; no-zone values are wall time in America/Sao_Paulo. */
export function tvDateTimestamp(value: string | null | undefined): number | null {
  const raw = text(value);
  if (!raw) return null;
  const parts = parseISODateParts(raw);
  if (!parts) return null;
  if (parts.dateOnly || !parts.hasZone) return saoPauloWallTimestamp(parts);
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function saoPauloDateKey(timestamp: number): string | null {
  const parts = saoPauloParts(timestamp);
  if (!parts) return null;
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

type TVDateInput = string | Pick<ApoioOrder, 'entrada' | 'previsao'> | null | undefined;
function dateInputValue(input: TVDateInput, field: 'entrada' | 'previsao'): string {
  return typeof input === 'string' || input === null || input === undefined ? text(input) : text(input[field]);
}

function elapsedDays(value: string, now: Date): number | null {
  const timestamp = tvDateTimestamp(value);
  if (timestamp === null || !Number.isFinite(now.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 86_400_000));
}

export function tvElapsedLabel(input: TVDateInput, now = new Date()): string {
  const timestamp = tvDateTimestamp(dateInputValue(input, 'entrada'));
  if (timestamp === null || !Number.isFinite(now.getTime())) return 'Data inválida';
  const totalMinutes = Math.floor(Math.max(0, now.getTime() - timestamp) / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

export function tvDeadlineState(input: TVDateInput, now = new Date()): TVDeadlineState {
  const value = dateInputValue(input, 'previsao');
  const timestamp = tvDateTimestamp(value);
  if (timestamp === null || !Number.isFinite(now.getTime())) return 'unknown';
  const deadlineDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : saoPauloDateKey(timestamp);
  const today = saoPauloDateKey(now.getTime());
  if (!deadlineDate || !today) return 'unknown';
  if (deadlineDate < today) return 'overdue';
  if (deadlineDate > today) return 'upcoming';
  return 'today';
}

function eligibleRows(data: ApoioData | null | undefined): ApoioReportRow[] {
  if (!data) return [];
  const groups = new Map(data.groups.map(group => [group.id, group]));
  const fleets = new Map(data.fleets.map(fleet => [fleet.frota, fleet]));
  return data.orders.filter(order => order.ativo === true && getMaintenanceOrderClosure(order).status !== 'encerrado' && fleets.has(order.frota)).map(order => {
    const fleet = fleets.get(order.frota)!;
    return { ...order, apoio: groups.get(fleet.grupo_id)?.nome || 'Grupo não encontrado', equipamento: fleet.nome || order.modelo || 'Equipamento não informado' };
  });
}

/** Aviso para a base antiga que ainda não trouxe nenhum campo classe. */
export function getTVOrdersWarning(data: ApoioData | null | undefined): string | null {
  const rows = eligibleRows(data);
  return rows.length > 0 && rows.every(row => !text(row.classe)) ? TV_CLASS_DATA_WARNING : null;
}
export const tvOrdersWarning = getTVOrdersWarning;

function compareDates(a: ApoioReportRow, b: ApoioReportRow, field: 'entrada' | 'previsao', descending = false): number {
  const aTime = tvDateTimestamp(a[field]);
  const bTime = tvDateTimestamp(b[field]);
  if (aTime === null && bTime === null) return 0;
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  return descending ? bTime - aTime : aTime - bTime;
}

function compareRows(a: ApoioReportRow, b: ApoioReportRow, sort: TVSort): number {
  if (sort === 'newest') return compareDates(a, b, 'entrada', true);
  if (sort === 'fleet') return a.frota.localeCompare(b.frota, 'pt-BR', { numeric: true, sensitivity: 'base' }) || a.os.localeCompare(b.os, 'pt-BR', { numeric: true, sensitivity: 'base' });
  if (sort === 'deadline') return compareDates(a, b, 'previsao');
  return compareDates(a, b, 'entrada');
}

/** Select only active orders whose fleet is registered by exact string equality. */
export function selectTVOrders(data: ApoioData | null | undefined, filters: TVFilters = defaultTVFilters, now = new Date()): ApoioReportRow[] {
  const rows = eligibleRows(data);
  const groupSet = new Set(Array.isArray(filters.groups) ? filters.groups : []);
  const query = category(filters.query);
  const location = category(filters.location);
  const provider = category(filters.provider);
  const sector = category(filters.sector);
  const reason = category(filters.reason);
  const minDays = Number.isFinite(filters.minDays) ? Math.max(0, filters.minDays) : 0;
  const status = filters.status === 'abertas' ? 'abertas' : 'Andamento';
  const sort = ['oldest', 'newest', 'fleet', 'deadline'].includes(filters.sort) ? filters.sort : 'oldest';
  const fleetGroups = new Map((data?.fleets || []).map(fleet => [fleet.frota, fleet.grupo_id]));

  const filtered = rows.filter(row => {
    const groupId = fleetGroups.get(row.frota);
    if (groupSet.size && (!groupId || !groupSet.has(groupId))) return false;
    if (status === 'Andamento' ? !isInProgress(row) : !isOpenStatus(row)) return false;
    if (filters.emergencyOnly && !isEmergencyOrder(row)) return false;
    if (location && category(oficinaLabel(row.origem)) !== location) return false;
    if (provider && (oficinaLabel(row.origem) !== 'Oficina Externa' || category(text(row.prestador) || 'Não informado') !== provider)) return false;
    if (sector && category(row.setor) !== sector) return false;
    if (reason && category(row.motivo) !== reason) return false;
    if (query) {
      const haystack = [row.frota, row.os, row.apoio, row.equipamento, row.modelo, row.origem, row.prestador, row.setor, row.ponto, row.motivo, row.classe, row.cd_ponto, row.narrativa, row.status].map(category).join(' ');
      if (!haystack.includes(query)) return false;
    }
    if (minDays > 0) {
      const days = elapsedDays(row.entrada, now);
      if (days === null || days < minDays) return false;
    }
    return true;
  });

  return filtered.map((row, index) => ({ row, index }))
    .sort((a, b) => compareRows(a.row, b.row, sort) || a.index - b.index)
    .map(item => item.row);
}

/** Painel externo é sempre restrito à oficina externa e às frotas cadastradas do Apoio. */
export function selectTVExternalOrders(data: ApoioData | null | undefined, filters: TVFilters = {...defaultTVFilters,status:'abertas'}, now = new Date()): ApoioReportRow[] {
  return selectTVOrders(data, { ...filters, emergencyOnly: false, location: 'Oficina Externa' }, now);
}
