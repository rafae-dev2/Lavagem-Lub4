import type { ApoioData, ApoioOrder, ApoioReportRow } from '../types/apoio';
import { diasObservados, oficinaLabel } from '../types/apoio';
import { getMaintenanceOrderClosure } from './maintenanceTracking';

export type ApoioView = 'abertas' | 'classificar' | 'historico' | 'encerradas';
export type ApoioFleetsByGroup = Record<string, string[]>;
export type ApoioOperationalStatus = 'programado' | 'andamento' | 'encerrado' | 'ausente' | 'outros';

export interface ApoioFilters {
  query: string;
  groups: string[];
  /** Accepts a scalar for backwards-compatible callers and arrays for the UI multi-selects. */
  location: string | string[];
  status: string | string[];
  provider: string | string[];
  /** Alias used by newer callers when the UI labels this axis as origem. */
  origins?: string[];
  /** Optional per-group fleet restrictions. A missing key means all fleets; [] means none. */
  fleetsByGroup?: ApoioFleetsByGroup;
}

function filterValues(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.map(item => item.trim()).filter(Boolean);
  return value?.trim() ? [value.trim()] : [];
}

export function apoioOperationalStatus(order: ApoioOrder): ApoioOperationalStatus {
  return getMaintenanceOrderClosure(order).status;
}

export function isApoioClosed(order: ApoioOrder): boolean {
  return apoioOperationalStatus(order) === 'encerrado';
}

export function apoioStatusLabel(status: ApoioOperationalStatus): string {
  switch (status) {
    case 'programado': return 'Programada';
    case 'andamento': return 'Em andamento';
    case 'encerrado': return 'Encerrada';
    case 'ausente':
    case 'outros': return 'Outros';
  }
}

export function apoioOrderStatusLabel(order: ApoioOrder): string {
  const status = apoioOperationalStatus(order);
  return status === 'ausente' ? 'Outros · Sem confirmação' : apoioStatusLabel(status);
}

export function apoioBaseRows(data: ApoioData | null, view: ApoioView): ApoioReportRow[] {
  if (!data) return [];
  const fleets = new Map(data.fleets.map(f => [f.frota, f]));
  const groups = new Map(data.groups.map(g => [g.id, g]));
  return data.orders.filter(order => {
    const own = fleets.has(order.frota);
    const closed = isApoioClosed(order);
    if (view === 'historico') return own && (!order.ativo || closed);
    if (view === 'encerradas') return own && closed;
    if (view === 'classificar') return order.ativo && !own;
    // An order with an explicit closed status may still be active in the
    // snapshot. It is operationally closed and must never count as open.
    return order.ativo && own && !closed;
  }).map(order => {
    const fleet = fleets.get(order.frota);
    return {
      ...order,
      apoio: fleet ? groups.get(fleet.grupo_id)?.nome || 'Grupo não encontrado' : 'Não cadastrado como próprio',
      equipamento: fleet?.nome || order.modelo || 'Equipamento não informado',
    };
  });
}

function matchesFleetSelection(
  row: ApoioReportRow,
  fleetMap: Map<string, ApoioData['fleets'][number]>,
  fleetsByGroup: ApoioFleetsByGroup | undefined,
): boolean {
  if (!fleetsByGroup) return true;
  const fleet = fleetMap.get(row.frota);
  if (!fleet || !Object.prototype.hasOwnProperty.call(fleetsByGroup, fleet.grupo_id)) return true;
  // A restriction belongs only to its own group. Other groups must not be
  // removed when a multi-group selection has a different group's restriction.
  return fleetsByGroup[fleet.grupo_id].includes(row.frota);
}

function foldedStatus(value: unknown): string {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ');
}

function statusFilterMatches(row: ApoioReportRow, requested: string): boolean {
  const filter = foldedStatus(requested);
  if (!filter) return true;
  const operational = apoioOperationalStatus(row);
  if (filter === 'programada' || filter === 'programado') return operational === 'programado';
  if (filter === 'andamento' || filter === 'em andamento' || filter === 'em execucao') return operational === 'andamento';
  if (filter === 'encerrada' || filter === 'encerrado' || filter === 'concluida' || filter === 'concluido') return operational === 'encerrado';
  if (filter === 'outros' || filter === 'ausente da fonte' || filter === 'sem confirmacao' || filter === 'aguardando peca') return operational === 'ausente' || operational === 'outros';
  // Unknown source statuses are deliberately not filter semantics. The raw
  // value remains available in the card/report detail, while the list uses
  // only the operational vocabulary above.
  return false;
}

export function filterApoioRows(data: ApoioData | null, base: ApoioReportRow[], filters: ApoioFilters): ApoioReportRow[] {
  const fleetMap = new Map((data?.fleets || []).map(f => [f.frota, f]));
  const needle = foldedStatus(filters.query);
  const locations = filterValues(filters.origins?.length ? filters.origins : filters.location);
  const statuses = filterValues(filters.status);
  const providers = filterValues(filters.provider);
  return base.filter(row => {
    const fleet = fleetMap.get(row.frota);
    if (filters.groups.length && (!fleet || !filters.groups.includes(fleet.grupo_id))) return false;
    if (!matchesFleetSelection(row, fleetMap, filters.fleetsByGroup)) return false;
    if (locations.length && !locations.includes(oficinaLabel(row.origem))) return false;
    if (statuses.length && !statuses.some(requested => statusFilterMatches(row, requested))) return false;
    if (providers.length && !providers.includes(row.prestador || 'Não informado')) return false;
    const closure = getMaintenanceOrderClosure(row);
    const statusLabel = apoioOrderStatusLabel(row);
    const closureOrigin = closure.origin === 'ausencia' ? 'ausencia validada' : closure.origin === 'fonte' ? 'status da fonte' : '';
    if (needle && ![
      row.frota, row.os, row.equipamento, row.apoio, row.prestador, row.narrativa, row.ponto,
      row.status, statusLabel, closure.status, closureOrigin,
    ].map(value => foldedStatus(value)).join(' ').includes(needle)) return false;
    return true;
  }).sort((a, b) => a.apoio.localeCompare(b.apoio, 'pt-BR') || oficinaLabel(a.origem).localeCompare(oficinaLabel(b.origem), 'pt-BR') || a.prestador.localeCompare(b.prestador, 'pt-BR') || (diasObservados(b) ?? -1) - (diasObservados(a) ?? -1) || a.frota.localeCompare(b.frota, 'pt-BR', { numeric: true }));
}

/** Reconcile registry changes only, never prune a selection because an order disappeared. */
export function reconcileApoioFleetSelection(
  data: Pick<ApoioData, 'groups' | 'fleets'>,
  selectedGroups: string[],
  fleetsByGroup: ApoioFleetsByGroup,
): { groups: string[]; fleetsByGroup: ApoioFleetsByGroup } {
  const validGroups = new Set(data.groups.map(group => group.id));
  const groupForFleet = new Map(data.fleets.map(fleet => [fleet.frota, fleet.grupo_id]));
  const filteredGroups = selectedGroups.filter(id => validGroups.has(id));
  const groups = filteredGroups.length === selectedGroups.length ? selectedGroups : filteredGroups;
  let changed = false;
  const restrictions: ApoioFleetsByGroup = {};
  for (const [groupId, selected] of Object.entries(fleetsByGroup)) {
    if (!validGroups.has(groupId)) { changed = true; continue; }
    const valid = selected.filter(frota => groupForFleet.get(frota) === groupId);
    if (valid.length !== selected.length) changed = true;
    // Keep [] explicit when every selected fleet was removed or reassigned.
    restrictions[groupId] = valid.length === selected.length ? selected : valid;
  }
  return { groups, fleetsByGroup: changed ? restrictions : fleetsByGroup };
}
