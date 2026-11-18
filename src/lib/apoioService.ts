import { createClient } from '@supabase/supabase-js';
import { ApoioData, ApoioFleet, ApoioGroup } from '../types/apoio';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabaseClient';
import {
  buildApoioWatermark,
  loadWithConditionalCache,
  SharedSnapshotCache,
} from './egressCachePolicy';

/**
 * Cliente isolado da seção Apoio.
 *
 * A sessão não é usada como controle de acesso desta seção: as leituras e a
 * classificação são públicas por decisão de produto. O storageKey distinto
 * evita que uma futura sessão desta seção interfira no cliente legado.
 */
export const apoioClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'bp_apoio_auth',
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: { 'X-Client-Info': 'branco-peres-apoio' },
  },
});

const CLIENT_SYNC_THROTTLE_MS = 120_000;
const MANUAL_SYNC_COOLDOWN_MS = 15_000;
const APOIO_BROADCAST_CHANNEL = 'bp_apoio_snapshots_v1';
let lastSyncAttemptAt = 0;
let syncInFlight: Promise<void> | null = null;

const apoioSnapshotCache = new SharedSnapshotCache<ApoioData>();
const externalInvalidators = new Set<() => void>();
let broadcastChannel: BroadcastChannel | null = null;

function ensureBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (broadcastChannel) return broadcastChannel;
  try {
    broadcastChannel = new BroadcastChannel(APOIO_BROADCAST_CHANNEL);
    broadcastChannel.onmessage = (event) => {
      if (event?.data?.type === 'invalidate') {
        invalidateApoioSnapshots(false);
      }
    };
  } catch {
    broadcastChannel = null;
  }
  return broadcastChannel;
}

ensureBroadcastChannel();

export function registerApoioSnapshotInvalidator(listener: () => void): () => void {
  externalInvalidators.add(listener);
  return () => {
    externalInvalidators.delete(listener);
  };
}

export function invalidateApoioSnapshots(broadcast = true): void {
  apoioSnapshotCache.invalidate();
  externalInvalidators.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
  if (broadcast) {
    try {
      ensureBroadcastChannel()?.postMessage({ type: 'invalidate', ts: Date.now() });
    } catch {
      /* ignore */
    }
  }
}

type SupabaseErrorLike = { message?: string; details?: string; hint?: string; code?: string };

function errorText(error: SupabaseErrorLike | null | undefined): string {
  if (!error) return 'erro desconhecido';
  const parts = [error.message, error.details, error.hint].filter(Boolean);
  return parts.join(' — ') || `erro Supabase${error.code ? ` (${error.code})` : ''}`;
}

function throwIfError(error: SupabaseErrorLike | null | undefined, operation: string): void {
  if (error) throw new Error(`[Apoio] ${operation}: ${errorText(error)}`);
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`[Apoio] ${field} não pode ficar vazio.`);
  return normalized;
}

/**
 * Consulta ~150 bytes (apoio_sync + contagens head) antes de baixar snapshots
 * multi-megabyte em leituras automáticas.
 */
export async function fetchApoioWatermark(signal?: AbortSignal): Promise<string | null> {
  try {
    const controller = new AbortController();
    const abortParent = () => controller.abort();
    signal?.addEventListener('abort', abortParent, { once: true });
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const [syncRes, groupsRes, fleetsRes] = await Promise.all([
        apoioClient
          .from('apoio_sync')
          .select('fonte_atualizada,total,erro')
          .eq('id', 1)
          .abortSignal(controller.signal)
          .maybeSingle(),
        apoioClient
          .from('apoio_grupos')
          .select('id', { count: 'exact', head: true })
          .abortSignal(controller.signal),
        apoioClient
          .from('apoio_frotas')
          .select('frota', { count: 'exact', head: true })
          .abortSignal(controller.signal),
      ]);
      if (syncRes.error || groupsRes.error || fleetsRes.error) return null;
      return buildApoioWatermark(
        syncRes.data,
        groupsRes.count ?? null,
        fleetsRes.count ?? null,
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortParent);
    }
  } catch {
    return null;
  }
}

async function fetchApoioFull(): Promise<{ value: ApoioData; version: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response;
  try { response = await apoioClient.rpc('carregar_apoio_controle').abortSignal(controller.signal); }
  finally { clearTimeout(timeout); }
  const { data, error } = response;
  throwIfError(error, 'carregar fotografia compartilhada');
  if (!data || !Array.isArray(data.groups) || !Array.isArray(data.fleets) || !Array.isArray(data.orders)) {
    throw new Error('[Apoio] O banco retornou uma fotografia incompleta. Verifique o SQL de instalação.');
  }
  const snapshot = data as ApoioData;
  const version = buildApoioWatermark(snapshot.sync, snapshot.groups.length, snapshot.fleets.length);
  return { value: snapshot, version };
}

/**
 * Carrega snapshot do Apoio usando cache condicional leve para evitar downloads
 * repetidos em trocas de aba e polls sem alteração na fonte.
 */
export async function loadApoioData(options: { force?: boolean } = {}): Promise<ApoioData> {
  return loadWithConditionalCache({
    cache: apoioSnapshotCache,
    force: options.force ?? false,
    fetchVersion: () => fetchApoioWatermark(),
    fetchFull: fetchApoioFull,
  });
}

/**
 * Versão da fotografia: 103 bytes que dizem se a planilha mudou.
 *
 * `sincronizado_em` muda a cada minuto (o cron roda sempre), por isso não
 * serve como sinal. `fonte_atualizada` só muda quando a origem é editada.
 */
export interface ApoioVersion {
  fonteAtualizada: string | null;
  sincronizadoEm: string | null;
  total: number;
  erro: string | null;
}

export async function loadApoioVersion(): Promise<ApoioVersion> {
  const { data, error } = await apoioClient
    .from('apoio_sync')
    .select('fonte_atualizada, sincronizado_em, total, erro')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(error, 'consultar versão da fotografia');
  const row = (data ?? {}) as {
    fonte_atualizada?: string | null;
    sincronizado_em?: string | null;
    total?: number | null;
    erro?: string | null;
  };
  return {
    fonteAtualizada: row.fonte_atualizada ?? null,
    sincronizadoEm: row.sincronizado_em ?? null,
    total: Number(row.total) || 0,
    erro: row.erro ?? null,
  };
}

const TV_ORDER_COLUMNS = [
  'chave', 'os', 'frota', 'modelo', 'grupo_fonte', 'setor', 'ponto', 'origem',
  'prestador', 'status', 'entrada', 'previsao', 'narrativa', 'ativo',
  'primeira_vista', 'ultima_vista', 'ausente_desde', 'classe', 'motivo', 'cd_ponto',
].join(',');

/**
 * Fotografia enxuta para a TV: somente ordens ativas (≈450 KB em vez de
 * 2,46 MB), sem o histórico encerrado que a TV não mostra. O formato é o
 * mesmo de `loadApoioData`, então as telas não precisam mudar.
 */
export async function loadApoioTVData(): Promise<ApoioData> {
  const [ordersResult, fleetsResult, groupsResult, version] = await Promise.all([
    apoioClient.from('apoio_ordens').select(TV_ORDER_COLUMNS).eq('ativo', true),
    apoioClient.from('apoio_frotas').select('frota, grupo_id, nome'),
    apoioClient.from('apoio_grupos').select('id, nome, cor'),
    loadApoioVersion(),
  ]);
  throwIfError(ordersResult.error, 'carregar ordens da TV');
  throwIfError(fleetsResult.error, 'carregar frotas da TV');
  throwIfError(groupsResult.error, 'carregar grupos da TV');
  if (!Array.isArray(ordersResult.data) || !Array.isArray(fleetsResult.data) || !Array.isArray(groupsResult.data)) {
    throw new Error('[Apoio] A leitura da TV voltou incompleta. Tente novamente.');
  }
  return {
    orders: ordersResult.data as unknown as ApoioOrder[],
    fleets: fleetsResult.data as ApoioFleet[],
    groups: groupsResult.data as ApoioGroup[],
    sync: version.sincronizadoEm || version.fonteAtualizada
      ? {
        id: 0,
        fonte_atualizada: version.fonteAtualizada,
        consultado_em: null,
        sincronizado_em: version.sincronizadoEm,
        total: version.total,
        erro: version.erro,
      } as ApoioSync
      : null,
    role: 'viewer',
  };
}

export async function saveApoioGroup(group: ApoioGroup): Promise<void> {
  const id = requireNonEmpty(group.id, 'id do grupo');
  const nome = requireNonEmpty(group.nome, 'nome do grupo');
  const cor = requireNonEmpty(group.cor, 'cor do grupo');
  const { error } = await apoioClient
    .from('apoio_grupos')
    .upsert({ id, nome, cor }, { onConflict: 'id' });
  throwIfError(error, 'salvar grupo');
  invalidateApoioSnapshots();
}

export async function deleteApoioGroup(id: string): Promise<void> {
  const groupId = requireNonEmpty(id, 'id do grupo');
  const { error } = await apoioClient.from('apoio_grupos').delete().eq('id', groupId);
  // A FK apoio_frotas.grupo_id é RESTRICT; o erro é propagado de propósito.
  throwIfError(error, 'excluir grupo');
  invalidateApoioSnapshots();
}

export async function saveApoioFleet(fleet: ApoioFleet): Promise<void> {
  const frota = requireNonEmpty(fleet.frota, 'frota');
  if (frota === 'SEM-FROTA') throw new Error('Esta ordem não informa um número de frota na fonte. Não pode ser cadastrada como equipamento próprio.');
  const grupoId = requireNonEmpty(fleet.grupo_id, 'grupo do equipamento');
  const nome = fleet.nome.trim();
  const { error } = await apoioClient
    .from('apoio_frotas')
    .upsert({ frota, grupo_id: grupoId, nome }, { onConflict: 'frota' });
  throwIfError(error, 'salvar frota');
  invalidateApoioSnapshots();
}

export async function deleteApoioFleet(frota: string): Promise<void> {
  const fleetId = requireNonEmpty(frota, 'frota');
  const { error } = await apoioClient.from('apoio_frotas').delete().eq('frota', fleetId);
  throwIfError(error, 'excluir frota');
  invalidateApoioSnapshots();
}

/**
 * Solicita uma atualização no servidor. O navegador aplica um throttle em
 * leituras automáticas (2 min) e curto em chamadas manuais (15s); a trava real
 * está no claim_apoio_sync() atômico executado pela Edge Function.
 */
export async function syncApoio(options: { force?: boolean } = {}): Promise<void> {
  if (syncInFlight) return syncInFlight;
  const now = Date.now();
  const minInterval = options.force ? MANUAL_SYNC_COOLDOWN_MS : CLIENT_SYNC_THROTTLE_MS;
  if (now - lastSyncAttemptAt < minInterval) return;
  lastSyncAttemptAt = now;

  syncInFlight = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const { data, error } = await apoioClient.functions.invoke('sync-ordens', {
        body: {}, signal: controller.signal,
      });
      if (controller.signal.aborted) throw new Error('[Apoio] Sincronização excedeu 30 segundos. A última fotografia será mantida.');
      if (error) {
        let detail = error.message || String(error);
        if (error.name === 'FunctionsFetchError' || /Failed to send a request/i.test(detail)) {
          const origin = typeof window !== 'undefined' ? window.location.origin : 'o endereço do aplicativo';
          detail = `Não foi possível contatar a sincronização. Verifique a conexão e se ${origin} está autorizado no Supabase (CORS). A fotografia já gravada no banco não foi alterada.`;
        } else if (error.context instanceof Response) {
          try {
            const response = await error.context.clone().json();
            if (typeof response?.erro === 'string') detail = response.erro.slice(0, 500);
          } catch { /* Mantém o diagnóstico original quando não houver JSON. */ }
        }
        throw new Error(`[Apoio] sincronizar ordens: ${detail}`);
      }
      if (data?.ok === false) throw new Error(`[Apoio] sincronizar ordens: ${data.erro || 'resposta rejeitada pelo servidor'}`);
      if (data?.aplicado) invalidateApoioSnapshots();
    } finally {
      clearTimeout(timeout);
    }
  })();

  try {
    await syncInFlight;
  } catch (error) {
    lastSyncAttemptAt = 0;
    throw error;
  } finally {
    syncInFlight = null;
  }
}
