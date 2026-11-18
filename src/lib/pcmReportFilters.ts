import type { Programacao } from '../types';

export interface PCMReportFilters { tipo: string; origem: string; apoio: string; semana: string; }
export function pcmWeekRange(value: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  const [year, month, day] = value.split('-').map(Number);
  if (!Number.isFinite(date.getTime()) || date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) return null;
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const start = iso(date); date.setDate(date.getDate() + 6);
  return { start, end: iso(date) };
}
export function matchesPCMReportFilters(row: Programacao, filters: PCMReportFilters): boolean {
  if (filters.tipo && row.tipoPreventiva !== filters.tipo) return false;
  if (filters.origem && (row.origemRegistro || 'MANUAL') !== filters.origem) return false;
  if (filters.apoio && (row.apoioId || '') !== filters.apoio) return false;
  const range = filters.semana ? pcmWeekRange(filters.semana) : null;
  if (filters.semana && !range) return false;
  if (range && (!row.dataProgramada || row.dataProgramada < range.start || row.dataProgramada > range.end)) return false;
  return true;
}
