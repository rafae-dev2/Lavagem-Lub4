import {
  apoioClient,
  fetchApoioWatermark,
  loadApoioData,
  registerApoioSnapshotInvalidator,
} from './apoioService';
import {
  buildApoioWatermark,
  loadWithConditionalCache,
  SharedSnapshotCache,
} from './egressCachePolicy';
import type { ApoioData } from '../types/apoio';

export const MAINTENANCE_READ_TIMEOUT_MS = 15_000;

const maintenanceSnapshotCache = new SharedSnapshotCache<ApoioData>();
registerApoioSnapshotInvalidator(() => maintenanceSnapshotCache.invalidate());

async function fetchMaintenanceFull(forceFallback: boolean): Promise<{ value: ApoioData; version: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAINTENANCE_READ_TIMEOUT_MS);
  try {
    const { data, error } = await apoioClient
      .rpc('carregar_acompanhamento_manutencao')
      .abortSignal(controller.signal);
    // Somente ausência real da função permite fallback. Falhas de permissão,
    // rede ou schema não são mascaradas como sucesso em outra consulta.
    if (error?.code === 'PGRST202' || error?.code === '42883') {
      const fallback = await loadApoioData({ force: forceFallback });
      return {
        value: fallback,
        version: buildApoioWatermark(fallback.sync, fallback.groups.length, fallback.fleets.length),
      };
    }
    if (error) {
      if (controller.signal.aborted) throw new Error('[Manutenção] A consulta excedeu 15 segundos. Tente atualizar novamente.');
      throw new Error(`[Manutenção] Consulta compartilhada: ${error.message || error.code || 'erro desconhecido'}`);
    }
    if (!data || !Array.isArray(data.groups) || !Array.isArray(data.fleets) || !Array.isArray(data.orders)) {
      throw new Error('[Manutenção] Fotografia incompleta; a última seleção válida foi preservada.');
    }
    if (data.orders.some((row: unknown) => !row || typeof row !== 'object' || typeof (row as { chave?: unknown }).chave !== 'string' || typeof (row as { status?: unknown }).status !== 'string')) {
      throw new Error('[Manutenção] A fotografia contém ordens inconsistentes. Nenhum encerramento foi inferido desta resposta.');
    }
    const snapshot = data as ApoioData;
    return {
      value: snapshot,
      version: buildApoioWatermark(snapshot.sync, snapshot.groups.length, snapshot.fleets.length),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Leitura consistente e sem escrita; compartilha cache condicional entre módulos. */
export async function loadMaintenanceData(options: { force?: boolean } = {}): Promise<ApoioData> {
  const force = options.force ?? false;
  return loadWithConditionalCache({
    cache: maintenanceSnapshotCache,
    force,
    fetchVersion: () => fetchApoioWatermark(),
    fetchFull: () => fetchMaintenanceFull(force),
  });
}
