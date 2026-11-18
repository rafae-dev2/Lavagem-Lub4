export interface TVLayout {
  columns: number;
  pageSize: number;
  density: 'comfortable' | 'compact' | 'dense';
  rows: number;
}

/** Limites conservadores: cards legíveis, sem depender da resolução nominal da TV. */
export function getTVLayout(width: number, height: number, count: number, requested: number, presentation: boolean): TVLayout {
  const safeWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
  const safeHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
  const limit = [4, 6, 8, 12].includes(requested) ? requested : count > 12 ? 12 : count > 6 ? 8 : 6;
  const availableColumns = safeWidth < 560 ? 1 : safeWidth < 900 ? 2 : safeWidth < 1280 ? 3 : 4;
  const columns = Math.max(1, Math.min(availableColumns, requested === 4 ? 2 : 4, Math.max(1, count)));
  const rowCapacity = presentation ? Math.max(1, Math.min(3, Math.floor((safeHeight + 10) / 250))) : 3;
  const pageSize = presentation ? Math.max(1, Math.min(limit, columns * rowCapacity)) : limit;
  const rows = Math.max(1, Math.ceil(Math.min(Math.max(1, count), pageSize) / columns));
  const cardHeight = presentation ? (safeHeight - (rows - 1) * 10) / rows : 340;
  const density = cardHeight >= 340 ? 'comfortable' : cardHeight >= 280 ? 'compact' : 'dense';
  return { columns, pageSize, rows, density };
}
