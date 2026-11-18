export interface ApoioGroup { id: string; nome: string; cor: string; }
export interface ApoioFleet { frota: string; grupo_id: string; nome: string; }
export interface ApoioOrder {
  chave: string; os: string; frota: string; modelo: string;
  grupo_fonte: string; setor: string; ponto: string; origem: string;
  prestador: string; status: string; entrada: string; previsao: string;
  narrativa: string; ativo: boolean; primeira_vista: string;
  ultima_vista: string; ausente_desde: string | null;
  /** Campos estruturados preservados pelo PCM_AUTOMACAO; ausentes em bases antigas. */
  classe?: string | null; motivo?: string | null; cd_ponto?: string | null;
}
export interface ApoioSync {
  id: number; fonte_atualizada: string | null; consultado_em: string | null;
  sincronizado_em: string | null; total: number; erro: string | null;
}
export interface ApoioData {
  groups: ApoioGroup[]; fleets: ApoioFleet[]; orders: ApoioOrder[];
  sync: ApoioSync | null; role: 'admin' | 'viewer';
}
export interface ApoioReportRow extends ApoioOrder { apoio: string; equipamento: string; }
export interface ApoioReportOptions {
  rows: ApoioReportRow[]; filters: string[]; sourceUpdated: string | null;
  lastSynced: string | null; view: string; sourceError?: string | null;
  /** Extra filter summary used only by the Excel metadata sheet. */
  filtersExcel?: string[];
  /** Preserve the caller ordering by grouping only adjacent rows in PDF/images. */
  preserveRowOrder?: boolean;
  /** Título opcional exibido no cabeçalho de exportações com recorte específico. */
  reportTitle?: string;
}

export function oficinaLabel(origem: string): string {
  const value = origem.trim().toLocaleLowerCase('pt-BR');
  if (['oficina', 'interno', 'interna', 'oficina interna'].includes(value)) return 'Oficina Interna';
  if (['terceiro', 'externo', 'externa', 'oficina externa'].includes(value)) return 'Oficina Externa';
  if (value === 'campo') return 'Campo';
  return origem || 'Origem não informada';
}

export function diasEmAberto(entrada: string, now = new Date()): number | null {
  if (!entrada) return null;
  const day = entrada.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T00:00:00`);
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  if (!Number.isFinite(date.getTime()) || date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== dayOfMonth) return null;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  if (date > today) return null;
  return Math.round((today.getTime() - date.getTime()) / 86400000);
}

export function diasObservados(order: ApoioOrder, now = new Date()): number | null {
  if (order.ativo) return diasEmAberto(order.entrada, now);
  if (!order.ultima_vista) return null;
  const observed = new Date(order.ultima_vista);
  if (!Number.isFinite(observed.getTime())) return null;
  return diasEmAberto(order.entrada, observed);
}
