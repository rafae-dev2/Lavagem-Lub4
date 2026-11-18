import { Programacao } from '../types';
import { supabase } from './supabaseClient';
import { DbRow, mapRawToProgramacao } from './sheetsService';

const PCM_HISTORY_RPC = 'carregar_pcm_historico';
const PCM_EXECUTION_RPC = 'registrar_execucao_pcm';

function normalizeRows(payload: unknown): DbRow[] {
  if (Array.isArray(payload)) return payload as DbRow[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { rows?: unknown }).rows)) {
    return (payload as { rows: DbRow[] }).rows;
  }
  throw new Error('Supabase: RPC de histórico PCM retornou um payload inválido.');
}

/** Carrega somente por ação explícita do usuário; não grava nada no carregamento. */
export async function fetchPcmHistory(): Promise<Programacao[]> {
  const { data, error } = await supabase.rpc(PCM_HISTORY_RPC);
  if (error) throw new Error(`Supabase: ${error.message}`);
  return normalizeRows(data)
    .map(mapRawToProgramacao)
    .filter((programacao) => programacao.frota !== '');
}

export interface PcmExecutionResult {
  data: unknown;
}

/** Registra uma data escolhida pelo usuário, sem inferir a partir do encerramento. */
export async function registerPcmExecution(
  chave: string,
  data: string,
  observacao: string,
): Promise<PcmExecutionResult> {
  const normalizedKey = chave.trim();
  const normalizedDate = data.trim();
  if (!normalizedKey) throw new Error('Não foi possível identificar a chave PCM desta OS.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    throw new Error('Informe uma data de execução válida.');
  }

  const { data: result, error } = await supabase.rpc(PCM_EXECUTION_RPC, {
    p_chave: normalizedKey,
    p_data: normalizedDate,
    p_observacao: observacao.trim(),
  });
  if (error) throw new Error(`Supabase: ${error.message}`);
  return { data: result };
}

export { PCM_HISTORY_RPC, PCM_EXECUTION_RPC };
