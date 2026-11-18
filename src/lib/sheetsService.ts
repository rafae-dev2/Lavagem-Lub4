/**
 * sheetsService.ts — Serviço de dados de Lavagem e Lubrificação
 *
 * NOVA IMPLEMENTAÇÃO (v51): snapshot PCM via RPC, com fallback legado seguro.
 *
 * Regras:
 *   • App interno — sem autenticação, apenas ANON KEY.
 *   • Sem cache no servidor — leitura sempre fresca via RPC/PostgREST.
 *   • Mantém o mesmo contrato de funções para não quebrar o app:
 *       fetchSchedules / appendRowToSheet / updateRowInSheet / deleteRowFromSheet
 *       parseCsvToSchedules / getStoredConfig / saveConfig / getAppsScriptUrl
 *       syncSheetFilter / getSheetFilterStatus
 *   • O campo `rowIndex` é reaproveitado como o `id` (bigint) da tabela.
 */

import { Programacao, StatusType, SheetsConfig } from '../types';
import { supabase, LAVAGEM_TABLE, SUPABASE_URL } from './supabaseClient';
import {
  cleanScheduleObservation,
  effectiveScheduleCompletionDate,
  getScheduleCompletionSource,
} from './schedulePresentation';
import { buildSchedulesWatermark } from './egressCachePolicy';

// ─── Config (compat) ──────────────────────────────────────────────────────────
// Mantida apenas para não quebrar Configuracoes.tsx e outros usos.
// Agora expõe informações do Supabase.

const CONFIG_KEY = 'bp_supabase_config_v1';

function getDefaultConfig(): SheetsConfig {
  return {
    appsScriptUrl: `${SUPABASE_URL}/rest/v1/${LAVAGEM_TABLE}`,
    spreadsheetId: LAVAGEM_TABLE,
    sheetName: 'Lavagem e Lubrificação',
  };
}

export function getStoredConfig(): SheetsConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SheetsConfig>;
      return { ...getDefaultConfig(), ...parsed };
    }
  } catch {
    /* ignore */
  }
  return getDefaultConfig();
}

export function saveConfig(config: Partial<SheetsConfig>): void {
  const current = getStoredConfig();
  const updated: SheetsConfig = { ...current, ...config };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
}

export function getAppsScriptUrl(): string {
  return getStoredConfig().appsScriptUrl;
}

export function saveAppsScriptUrl(url: string): void {
  saveConfig({ appsScriptUrl: url });
}

// ─── Helpers de status ───────────────────────────────────────────────────────

function calcularSituacao(situacaoRaw: string, dataProgramada: string): StatusType {
  const s = (situacaoRaw || '').trim().toUpperCase();
  if (s === 'ENCERRADO') return 'ENCERRADO';
  if (s === 'CANCELADO') return 'ENCERRADO';
  if (s === 'ANDAMENTO' || s === 'EM ANDAMENTO' || s === 'EMANDAMENTO') return 'ANDAMENTO';
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (dataProgramada) {
    const d = new Date(dataProgramada + 'T00:00:00');
    if (!isNaN(d.getTime()) && d < hoje && s !== 'ENCERRADO' && s !== 'ANDAMENTO') return 'ATRASADO';
  }
  if (s === 'PENDENTE') return 'PENDENTE';
  if (s === 'ATRASADO') return 'ATRASADO';
  if (s === 'PROGRAMADO') return 'PROGRAMADO';
  return 'PENDENTE';
}

// ─── Helpers de data/hora ────────────────────────────────────────────────────

/** Aceita YYYY-MM-DD, DD/MM/YYYY e retorna sempre YYYY-MM-DD (interno). */
function parseDateToISO(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`;
  return '';
}

/** ISO YYYY-MM-DD para o campo `date` do Postgres (ou null para vazio). */
function isoOrNull(v: string): string | null {
  const iso = parseDateToISO(v);
  return iso || null;
}

function parseTime(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^\d{1,2}:\d{2}$/.test(s)) return s.padStart(5, '0');
  const hms = s.match(/^(\d{1,2}):(\d{2}):\d{2}$/);
  if (hms) return `${hms[1]!.padStart(2, '0')}:${hms[2]}`;
  return '';
}

// ─── Mapeadores DB ⇄ App ─────────────────────────────────────────────────────

export interface DbRow {
  id: number;
  frota: string | null;
  local: string | null;
  tipo: string | null;
  data_programada: string | null;
  horario: string | null;
  status: string | null;
  data_realizada: string | null;
  observacao: string | null;
  pcm_chave?: string | null;
  pcm_os?: string | null;
  pcm_grupo_id?: string | null;
  pcm_grupo_nome?: string | null;
  pcm_status?: string | null;
  pcm_entrada?: string | null;
  pcm_previsao?: string | null;
  pcm_narrativa?: string | null;
  pcm_encerrado_em?: string | null;
  pcm_motivo_encerramento?: string | null;
  pcm_ultima_sinc?: string | null;
  pcm_execucao_confirmada_em?: string | null;
  pcm_edicao_campos?: Record<string, unknown> | null;
  pcm_editado_em?: string | null;
  pcm_manual_arquivado_em?: string | null;
  pcm_manual_automatico_id?: number | string | null;
  created_at?: string;
  updated_at?: string;
}

function optionalText(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  return text || undefined;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || String(value).trim() === '') return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

/** Mapeia tanto o snapshot principal quanto as linhas do histórico PCM. */
export function mapRawToProgramacao(r: DbRow): Programacao {
  const dataProgramada = parseDateToISO(r.data_programada);
  const origemRegistro = optionalText(r.pcm_chave) ? 'PCM' : 'MANUAL';
  const situacao = calcularSituacao(r.status || r.pcm_status || 'PENDENTE', dataProgramada);
  const execucaoConfirmadaEm = optionalText(r.pcm_execucao_confirmada_em);
  const rawDataRealizada = parseDateToISO(r.data_realizada);
  const horarioAgendado = parseTime(r.horario);
  const mapped: Programacao = {
    id: `sb-${r.id}`,
    frota: String(r.frota || '').trim(),
    descricaoPonto: String(r.local || 'LAVADOR').trim(),
    tipoPreventiva: String(r.tipo || 'Lavagem / Lubrificação').trim(),
    dataProgramada,
    // PCM ativo/suspenso não pode expor uma data realizada que tenha sobrado
    // no registro. Para PCM encerrado, o helper abaixo escolhe a data explícita
    // ou o dia civil de pcm_encerrado_em em America/Sao_Paulo.
    dataRealizada: origemRegistro === 'PCM' && situacao !== 'ENCERRADO' ? '' : rawDataRealizada,
    situacao,
    horarioAgendado,
    observacao: String(r.observacao || '').trim(),
    rowIndex: Number(r.id),
    origemRegistro,
    pcmChave: optionalText(r.pcm_chave),
    numeroOS: optionalText(r.pcm_os),
    apoioId: optionalText(r.pcm_grupo_id),
    apoioNome: optionalText(r.pcm_grupo_nome),
    statusPCM: optionalText(r.pcm_status),
    entradaPCM: optionalText(r.pcm_entrada),
    previsaoPCM: optionalText(r.pcm_previsao),
    narrativaPCM: optionalText(r.pcm_narrativa),
    encerradoDetectadoEm: optionalText(r.pcm_encerrado_em),
    motivoEncerramento: optionalText(r.pcm_motivo_encerramento),
    ultimaSincronizacaoPCM: optionalText(r.pcm_ultima_sinc),
    execucaoConfirmadaEm,
    dataRealizadaOrigem: rawDataRealizada ? origemRegistro : undefined,
    pcmEdicaoCampos: r.pcm_edicao_campos || undefined,
    pcmEditadoEm: optionalText(r.pcm_editado_em),
    manualArquivadoEm: optionalText(r.pcm_manual_arquivado_em),
    manualAutomaticoId: optionalNumber(r.pcm_manual_automatico_id),
  };

  const effectiveDate = origemRegistro === 'PCM'
    ? effectiveScheduleCompletionDate(mapped)
    : mapped.dataRealizada;
  return {
    ...mapped,
    dataRealizada: effectiveDate,
    dataRealizadaOrigem: effectiveDate
      ? (getScheduleCompletionSource(mapped) || origemRegistro)
      : undefined,
    observacao: cleanScheduleObservation(mapped),
  };
}

// Alias semântico para consumidores que tratam a resposta do RPC como RAW.
export const dbRowToProgramacao = mapRawToProgramacao;

const PCM_EDIT_RPC = 'editar_programacao_pcm';
const PCM_EDIT_INSTALL_MESSAGE = 'RPC de edição PCM indisponível. Instale supabase/PCM_EDICAO_PREMIUM.sql.';

type EditableScheduleField =
  | 'descricaoPonto'
  | 'tipoPreventiva'
  | 'dataProgramada'
  | 'horarioAgendado'
  | 'situacao'
  | 'dataRealizada'
  | 'observacao';

const EDITABLE_SCHEDULE_FIELDS: readonly EditableScheduleField[] = [
  'descricaoPonto',
  'tipoPreventiva',
  'dataProgramada',
  'horarioAgendado',
  'situacao',
  'dataRealizada',
  'observacao',
];

function payloadValue(field: EditableScheduleField, value: unknown): unknown {
  switch (field) {
    case 'descricaoPonto': return String(value ?? '').trim();
    case 'tipoPreventiva': return String(value ?? '').trim();
    case 'dataProgramada': return isoOrNull(String(value ?? ''));
    case 'horarioAgendado': return parseTime(value) || null;
    case 'situacao': return String(value ?? 'PENDENTE').trim().toUpperCase();
    case 'dataRealizada': return isoOrNull(String(value ?? ''));
    case 'observacao': return String(value ?? '').trim();
  }
}

function progToDbPayload(
  prog: Programacao,
  changes?: Partial<Programacao>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const fieldMap: Record<EditableScheduleField, string> = {
    descricaoPonto: 'local',
    tipoPreventiva: 'tipo',
    dataProgramada: 'data_programada',
    horarioAgendado: 'horario',
    situacao: 'status',
    dataRealizada: 'data_realizada',
    observacao: 'observacao',
  };
  for (const field of EDITABLE_SCHEDULE_FIELDS) {
    if (changes !== undefined && !Object.prototype.hasOwnProperty.call(changes, field)) continue;
    const value = changes !== undefined ? changes[field] : prog[field];
    if (value === undefined) continue;
    payload[fieldMap[field]] = payloadValue(field, value);
  }
  if (changes === undefined || (prog.origemRegistro !== 'PCM' && Object.prototype.hasOwnProperty.call(changes, 'frota'))) {
    payload.frota = (prog.frota || '').trim();
  }
  return payload;
}

// ─── LEITURA ─────────────────────────────────────────────────────────────────

const PROGRAMACOES_RPC = 'carregar_lavagem_programacoes';
const LEGACY_PAGE_SIZE = 1000;
const LEGACY_COLUMNS = 'id,frota,local,tipo,data_programada,horario,status,data_realizada,observacao';

function isMissingProgramacoesRpc(error: { code?: string; message?: string } | null | undefined): boolean {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  // PGRST202 é o erro de função ausente/no schema cache. Não fazer fallback
  // para erros de execução, permissão ou payload do RPC.
  return code === 'PGRST202'
    || /could not find function .*carregar_lavagem_programacoes/.test(message)
    || /function (public\.)?carregar_lavagem_programacoes.*does not exist/.test(message)
    || /schema cache.*carregar_lavagem_programacoes/.test(message);
}

function isAbortError(
  error: { name?: string; code?: string; message?: string; details?: string } | null | undefined,
  signal?: AbortSignal,
): boolean {
  if (signal?.aborted) return true;
  const name = String(error?.name || '');
  const message = String(error?.message || '');
  const details = String(error?.details || '');
  return (
    name === 'AbortError' ||
    /\babort(ed|error)?\b/i.test(message) ||
    /\babort(ed|error)?\b/i.test(details)
  );
}

function createAbortError(): Error {
  const abortErr = new Error('Consulta de programações cancelada.');
  abortErr.name = 'AbortError';
  return abortErr;
}

async function fetchLegacySchedules(signal?: AbortSignal): Promise<DbRow[]> {
  const rows: DbRow[] = [];
  for (let offset = 0; ; offset += LEGACY_PAGE_SIZE) {
    if (signal?.aborted) throw createAbortError();
    let query = supabase.from(LAVAGEM_TABLE).select(LEGACY_COLUMNS)
      .order('id', { ascending: true }).range(offset, offset + LEGACY_PAGE_SIZE - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;

    if (error) {
      if (isAbortError(error, signal)) throw createAbortError();
      throw new Error(`Supabase: ${error.message}`);
    }
    const page = (data || []) as DbRow[];
    rows.push(...page);
    if (page.length < LEGACY_PAGE_SIZE) break;
  }
  return rows;
}

/**
 * Consulta ultraleve (~120 bytes) para checar se houve inserção, edição ou
 * exclusão na tabela antes de baixar o snapshot completo do RPC.
 * Retorna `null` caso não seja possível verificar (forçando leitura completa).
 */
export async function fetchSchedulesWatermark(signal?: AbortSignal): Promise<string | null> {
  if (signal?.aborted) throw createAbortError();
  try {
    let query = supabase
      .from(LAVAGEM_TABLE)
      .select('id,updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(0, 0);
    if (signal && typeof query.abortSignal === 'function') {
      query = query.abortSignal(signal);
    }
    const { data, error, count } = (await query) as {
      data: Array<{ id?: number | string | null; updated_at?: string | null }> | null;
      error: { name?: string; message?: string; details?: string } | null;
      count?: number | null;
    };
    if (error) {
      if (isAbortError(error, signal)) throw createAbortError();
      return null;
    }
    // Mocks simples sem suporte a count ou sem registros detalhados recaem com segurança.
    if (typeof count !== 'number') return null;
    const top = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return buildSchedulesWatermark(count, top?.id ?? null, top?.updated_at ?? null);
  } catch (err) {
    if (isAbortError(err as { name?: string; message?: string; details?: string }, signal)) {
      throw createAbortError();
    }
    return null;
  }
}

export async function fetchSchedules(_opts?: { fresh?: boolean; signal?: AbortSignal }): Promise<Programacao[]> {
  if (_opts?.signal?.aborted) throw createAbortError();
  console.log('[supabase] Buscando snapshot de programações via RPC...');

  let rows: DbRow[];
  let query = supabase.rpc(PROGRAMACOES_RPC);
  if (_opts?.signal) query = query.abortSignal(_opts.signal);

  let data: unknown = null;
  let error: { code?: string; message?: string; details?: string; name?: string } | null = null;
  try {
    const response = await query;
    data = response.data;
    error = response.error;
  } catch (err) {
    if (isAbortError(err as { name?: string; message?: string; details?: string }, _opts?.signal)) {
      throw createAbortError();
    }
    throw err;
  }

  if (error) {
    if (isAbortError(error, _opts?.signal)) {
      throw createAbortError();
    }
    if (!isMissingProgramacoesRpc(error)) {
      const detail = String(error.message || 'Erro ao consultar programações.');
      if (/failed to fetch|networkerror|load failed|fetcherror/i.test(detail)) {
        throw new TypeError(`Falha de conexão com o Supabase (Failed to fetch): ${detail}`);
      }
      throw new Error(`Supabase: ${detail}`);
    }
    console.warn('[supabase] RPC ausente; usando fallback legado paginado.');
    rows = await fetchLegacySchedules(_opts?.signal);
  } else {
    if (data != null && !Array.isArray(data)) {
      throw new Error('Supabase: RPC de programações retornou um payload inválido.');
    }
    rows = (data || []) as DbRow[];
  }

  const schedules = rows.map(mapRawToProgramacao).filter((p) => p.frota !== '');
  console.log(`[supabase] ✅ ${schedules.length} registros carregados`);
  return schedules;
}

// ─── ESCRITA ─────────────────────────────────────────────────────────────────

const PCM_READ_ONLY_MESSAGE = 'Registros PCM são somente leitura nesta tela.';

function isMissingPcmEditRpc(error: { code?: string; message?: string } | null | undefined): boolean {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return code === 'PGRST202'
    || /could not find function .*editar_programacao_pcm/.test(message)
    || /function (public\.)?editar_programacao_pcm.*does not exist/.test(message)
    || /schema cache.*editar_programacao_pcm/.test(message);
}

function allEditableChanges(prog: Programacao): Partial<Programacao> {
  return {
    descricaoPonto: prog.descricaoPonto,
    tipoPreventiva: prog.tipoPreventiva,
    dataProgramada: prog.dataProgramada,
    horarioAgendado: prog.horarioAgendado,
    situacao: prog.situacao,
    dataRealizada: prog.dataRealizada,
    observacao: prog.observacao,
  };
}

function unwrapPcmRpcResult(data: unknown): { ok?: unknown; row?: DbRow; error?: unknown } | null {
  const value = Array.isArray(data) ? data[0] : data;
  return value && typeof value === 'object' ? value as { ok?: unknown; row?: DbRow; error?: unknown } : null;
}

async function isAutomaticRow(rowIndex: number): Promise<{ automatic: boolean; error?: string }> {
  const { data, error } = await supabase
    .from(LAVAGEM_TABLE)
    .select('pcm_chave')
    .eq('id', rowIndex)
    .maybeSingle();

  if (error) return { automatic: false, error: `Supabase: ${error.message}` };
  return { automatic: Boolean(String((data as { pcm_chave?: unknown } | null)?.pcm_chave || '').trim()) };
}

export async function appendRowToSheet(
  prog: Programacao,
): Promise<{ success: boolean; error?: string; rowIndex?: number }> {
  try {
    if (prog.origemRegistro === 'PCM') {
      return { success: false, error: 'Registros PCM não podem ser inseridos.' };
    }
    const payload = progToDbPayload(prog);
    const { data, error } = await supabase
      .from(LAVAGEM_TABLE)
      .insert(payload)
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return { success: true, rowIndex: Number(data!.id) };
  } catch (e: any) {
    console.error('[supabase] Erro ao inserir:', e.message);
    return { success: false, error: e.message };
  }
}

export async function updateRowInSheet(
  rowIndex: number,
  prog: Programacao,
  changes?: Partial<Programacao>,
): Promise<{ success: boolean; error?: string; row?: DbRow }> {
  try {
    const rowGuard = prog.origemRegistro === 'PCM'
      ? { automatic: true }
      : await isAutomaticRow(rowIndex);
    if (rowGuard.error) throw new Error(rowGuard.error);

    if (rowGuard.automatic || prog.origemRegistro === 'PCM') {
      const pcmChanges = changes === undefined ? allEditableChanges(prog) : changes;
      const payload = progToDbPayload(prog, pcmChanges);
      delete payload.frota;
      if (Object.keys(payload).length === 0) return { success: true };

      const { data, error } = await supabase.rpc(PCM_EDIT_RPC, {
        p_id: rowIndex,
        p_campos: payload,
      });
      if (error) {
        if (isMissingPcmEditRpc(error)) throw new Error(PCM_EDIT_INSTALL_MESSAGE);
        throw new Error(`Supabase: ${error.message}`);
      }
      const result = unwrapPcmRpcResult(data);
      if (!result || result.ok !== true) {
        const detail = typeof result?.error === 'string' ? ` ${result.error}` : '';
        throw new Error(`RPC de edição PCM recusou a alteração.${detail}`);
      }
      return { success: true, row: result.row };
    }

    const payload = progToDbPayload(prog, changes);
    if (Object.keys(payload).length === 0) return { success: true };
    const { error } = await supabase
      .from(LAVAGEM_TABLE)
      .update(payload)
      .eq('id', rowIndex);

    if (error) throw new Error(error.message);
    return { success: true };
  } catch (e: any) {
    console.error('[supabase] Erro ao atualizar:', e.message);
    return { success: false, error: e.message };
  }
}

export async function deleteRowFromSheet(
  rowIndex: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const rowGuard = await isAutomaticRow(rowIndex);
    if (rowGuard.error) throw new Error(rowGuard.error);
    if (rowGuard.automatic) return { success: false, error: PCM_READ_ONLY_MESSAGE };
    const { error } = await supabase
      .from(LAVAGEM_TABLE)
      .delete()
      .eq('id', rowIndex);

    if (error) throw new Error(error.message);
    return { success: true };
  } catch (e: any) {
    console.error('[supabase] Erro ao excluir:', e.message);
    return { success: false, error: e.message };
  }
}

// ─── FILTRO (stub) ───────────────────────────────────────────────────────────
// O filtro visual no Google Sheets não existe mais — o filtro é feito no
// próprio app (frontend). Mantemos as funções apenas para compatibilidade.

export async function syncSheetFilter(
  _hideEncerradas: boolean,
): Promise<{ success: boolean; error?: string; filterActive?: boolean }> {
  return { success: true, filterActive: !!_hideEncerradas };
}

export async function getSheetFilterStatus(): Promise<{
  success: boolean;
  filterActive?: boolean;
  hiddenStatuses?: string[];
  hiddenRows?: number;
  cutoffDate?: string;
  cutoffTime?: string;
  windowKey?: string;
  updatedAt?: string;
  error?: string;
}> {
  return {
    success: true,
    filterActive: false,
    hiddenStatuses: [],
    hiddenRows: 0,
    cutoffDate: '',
    cutoffTime: '07:00',
    windowKey: '',
    updatedAt: '',
  };
}

// ─── TESTE DE CONEXÃO ────────────────────────────────────────────────────────

export async function testSupabaseConnection(): Promise<{ ok: boolean; msg: string; count?: number }> {
  try {
    const { count, error } = await supabase
      .from(LAVAGEM_TABLE)
      .select('*', { count: 'exact', head: true });

    if (error) {
      return { ok: false, msg: error.message };
    }
    return {
      ok: true,
      msg: `Conexão OK! ${count ?? 0} registros na tabela ${LAVAGEM_TABLE}.`,
      count: count ?? 0,
    };
  } catch (e: any) {
    return { ok: false, msg: e.message || 'Erro desconhecido' };
  }
}

// ─── CSV parser (mantido para importação manual) ─────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

export function parseCsvToSchedules(csvText: string): Programacao[] {
  const lines = csvText.trim().split('\n').filter((l) => l.trim());
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]!).map((h) => h.toUpperCase().trim());
  const idx = (name: string) => {
    const i = headers.indexOf(name);
    if (i >= 0) return i;
    return headers.findIndex((h) => h.includes(name.split(' ')[0]!));
  };

  const fI = idx('FROTA');
  const pI = idx('LOCAL');
  const tI = idx('TIPO');
  const dpI = idx('DATA PROGRAMADA');
  const drI = idx('DATA REALIZADA');
  const sI = idx('STATUS');
  const hI = idx('HORARIO');
  const oI = idx('OBSERVAÇÃO');

  return lines
    .slice(1)
    .map((line, i) => {
      const cols = parseCsvLine(line);
      const g = (n: number) => (n >= 0 && n < cols.length ? (cols[n] || '').replace(/^"|"$/g, '').trim() : '');
      const frota = g(fI);
      if (!frota) return null;

      const dataProgramada = parseDateToISO(g(dpI));
      const dataRealizada = parseDateToISO(g(drI));
      const horarioAgendado = parseTime(g(hI));
      const situacao = calcularSituacao(g(sI) || 'PENDENTE', dataProgramada);

      return {
        id: `csv-${i + 2}`,
        frota,
        descricaoPonto: g(pI) || 'LAVADOR',
        tipoPreventiva: g(tI) || 'Lavagem / Lubrificação',
        dataProgramada,
        dataRealizada,
        situacao,
        horarioAgendado,
        observacao: g(oI),
      } as Programacao;
    })
    .filter(Boolean) as Programacao[];
}
