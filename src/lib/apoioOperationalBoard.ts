import { apoioForecastOverdue } from './apoioCardPresentation';
import { apoioOrderStatusLabel } from './apoioFilters';
import { getMaintenanceOrderClosure } from './maintenanceTracking';
import { ApoioReportRow, diasEmAberto, diasObservados, oficinaLabel } from '../types/apoio';

export type ApoioPanelGroupBy = 'priority' | 'status' | 'group';

export type ApoioUrgencyTier = 'overdue' | 'progress' | 'scheduled' | 'other' | 'closed';

export interface ApoioClassifiedOrder {
  row: ApoioReportRow;
  tier: ApoioUrgencyTier;
  rank: number;
  statusLabel: string;
  closed: boolean;
  overdue: boolean;
  days: number | null;
  local: string;
  groupName: string;
}

export interface ApoioPanelBucket {
  id: string;
  title: string;
  tone: 'danger' | 'progress' | 'scheduled' | 'warning' | 'closed' | 'neutral';
  overdueCount: number;
  items: ApoioClassifiedOrder[];
}

export interface ApoioPanelSummary {
  total: number;
  overdueCount: number;
  inProgressCount: number;
  scheduledCount: number;
  externalCount: number;
  closedCount: number;
}

const TIER_RANK: Record<ApoioUrgencyTier, number> = {
  overdue: 0,
  progress: 1,
  scheduled: 2,
  other: 3,
  closed: 4,
};

export function classifyApoioOrderUrgency(row: ApoioReportRow, now: Date = new Date()): ApoioClassifiedOrder {
  const closure = getMaintenanceOrderClosure(row);
  const closed = closure.status === 'encerrado';
  const overdue = !closed && apoioForecastOverdue(row, now);
  const statusLabel = apoioOrderStatusLabel(row);
  const days = diasObservados(row, now) ?? diasEmAberto(row.entrada || '', now);
  const local = oficinaLabel(row.origem || '');
  const groupName = row.apoio?.trim() || 'Sem grupo definido';

  let tier: ApoioUrgencyTier;
  if (closed) {
    tier = 'closed';
  } else if (overdue) {
    tier = 'overdue';
  } else if (closure.status === 'andamento') {
    tier = 'progress';
  } else if (closure.status === 'programado') {
    tier = 'scheduled';
  } else {
    tier = 'other';
  }

  return {
    row,
    tier,
    rank: TIER_RANK[tier],
    statusLabel,
    closed,
    overdue,
    days,
    local,
    groupName,
  };
}

function sortClassifiedOrders(a: ApoioClassifiedOrder, b: ApoioClassifiedOrder): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  const daysA = a.days ?? -1;
  const daysB = b.days ?? -1;
  if (daysA !== daysB) return daysB - daysA;
  return a.row.frota.localeCompare(b.row.frota, 'pt-BR', { numeric: true });
}

export function summarizeApoioPanelMetrics(rows: ApoioReportRow[], now: Date = new Date()): ApoioPanelSummary {
  let overdueCount = 0;
  let inProgressCount = 0;
  let scheduledCount = 0;
  let externalCount = 0;
  let closedCount = 0;

  for (const row of rows) {
    const closure = getMaintenanceOrderClosure(row);
    const closed = closure.status === 'encerrado';
    if (closed) {
      closedCount += 1;
    } else {
      if (apoioForecastOverdue(row, now)) overdueCount += 1;
      if (closure.status === 'andamento') inProgressCount += 1;
      else if (closure.status === 'programado') scheduledCount += 1;
    }
    if (oficinaLabel(row.origem || '') === 'Oficina Externa') {
      externalCount += 1;
    }
  }

  return {
    total: rows.length,
    overdueCount,
    inProgressCount,
    scheduledCount,
    externalCount,
    closedCount,
  };
}

export function groupApoioOrdersForPanel(
  rows: ApoioReportRow[],
  groupBy: ApoioPanelGroupBy,
  now: Date = new Date(),
): ApoioPanelBucket[] {
  const classified = rows.map(row => classifyApoioOrderUrgency(row, now)).sort(sortClassifiedOrders);

  if (groupBy === 'priority') {
    const defs: Array<{ id: ApoioUrgencyTier; title: string; tone: ApoioPanelBucket['tone'] }> = [
      { id: 'overdue', title: 'Previsão vencida · Atenção imediata', tone: 'danger' },
      { id: 'progress', title: 'Em andamento', tone: 'progress' },
      { id: 'scheduled', title: 'Programadas', tone: 'scheduled' },
      { id: 'other', title: 'Outros / Sem confirmação', tone: 'warning' },
      { id: 'closed', title: 'Encerradas', tone: 'closed' },
    ];
    return defs
      .map(def => {
        const items = classified.filter(item => item.tier === def.id);
        return {
          id: def.id,
          title: def.title,
          tone: def.tone,
          overdueCount: items.filter(item => item.overdue).length,
          items,
        };
      })
      .filter(bucket => bucket.items.length > 0);
  }

  if (groupBy === 'status') {
    const defs: Array<{
      id: string;
      title: string;
      tone: ApoioPanelBucket['tone'];
      match: (item: ApoioClassifiedOrder) => boolean;
    }> = [
      { id: 'andamento', title: 'Em andamento', tone: 'progress', match: item => !item.closed && getMaintenanceOrderClosure(item.row).status === 'andamento' },
      { id: 'programado', title: 'Programadas', tone: 'scheduled', match: item => !item.closed && getMaintenanceOrderClosure(item.row).status === 'programado' },
      { id: 'outros', title: 'Outros / Aguardando', tone: 'warning', match: item => !item.closed && !['andamento', 'programado'].includes(getMaintenanceOrderClosure(item.row).status) },
      { id: 'encerrado', title: 'Encerradas', tone: 'closed', match: item => item.closed },
    ];
    return defs
      .map(def => {
        const items = classified.filter(def.match);
        return {
          id: def.id,
          title: def.title,
          tone: def.tone,
          overdueCount: items.filter(item => item.overdue).length,
          items,
        };
      })
      .filter(bucket => bucket.items.length > 0);
  }

  const byGroup = new Map<string, ApoioClassifiedOrder[]>();
  for (const item of classified) {
    const list = byGroup.get(item.groupName) ?? [];
    list.push(item);
    byGroup.set(item.groupName, list);
  }

  return Array.from(byGroup.entries())
    .map(([groupName, items]) => {
      const overdueCount = items.filter(item => item.overdue).length;
      return {
        id: `group-${groupName}`,
        title: groupName,
        tone: (overdueCount > 0 ? 'danger' : 'neutral') as ApoioPanelBucket['tone'],
        overdueCount,
        items,
      };
    })
    .sort((a, b) => {
      if (a.overdueCount !== b.overdueCount) return b.overdueCount - a.overdueCount;
      if (a.items.length !== b.items.length) return b.items.length - a.items.length;
      return a.title.localeCompare(b.title, 'pt-BR');
    });
}
