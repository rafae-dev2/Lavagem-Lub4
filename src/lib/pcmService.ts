import {
  apoioClient,
  fetchApoioWatermark,
  invalidateApoioSnapshots,
  registerApoioSnapshotInvalidator,
} from './apoioService';
import {
  buildApoioWatermark,
  loadWithConditionalCache,
  SharedSnapshotCache,
} from './egressCachePolicy';

export type PCMClassification = 'AUTO' | 'Lavagem / Lubrificação' | 'Lubrificação' | 'Troca de Óleo' | 'IGNORAR';
export interface PCMReviewOrder {
  chave: string;
  os: string;
  frota: string;
  apoio: string;
  equipamento: string;
  setor: string;
  ponto: string;
  motivo: string;
  classe: string;
  narrativa: string;
  entrada: string;
  previsao: string;
  tipo_atual: string | null;
  regra: string;
  motivo_revisao: string | null;
}
export interface PCMReviewData {
  rows: PCMReviewOrder[];
  sync: { fonte_atualizada: string | null; sincronizado_em: string | null; erro: string | null } | null;
}

const pcmReviewCache = new SharedSnapshotCache<PCMReviewData>();
registerApoioSnapshotInvalidator(() => pcmReviewCache.invalidate());

async function fetchPCMReviewFull(): Promise<{ value: PCMReviewData; version: string | null }> {
  const { data, error } = await apoioClient.rpc('carregar_pcm_revisao');
  if (error) throw new Error(`Integração PCM: ${error.message}`);
  if (!data || !Array.isArray(data.rows)) throw new Error('A integração PCM retornou dados incompletos.');
  const snapshot = data as PCMReviewData;
  return {
    value: snapshot,
    version: buildApoioWatermark(snapshot.sync),
  };
}

export async function loadPCMReview(options: { force?: boolean } = {}): Promise<PCMReviewData> {
  return loadWithConditionalCache({
    cache: pcmReviewCache,
    force: options.force ?? false,
    fetchVersion: async () => {
      const { data, error } = await apoioClient
        .from('apoio_sync')
        .select('fonte_atualizada,erro')
        .eq('id', 1)
        .maybeSingle();
      if (error || !data) return fetchApoioWatermark();
      return buildApoioWatermark(data as { fonte_atualizada?: string | null; erro?: string | null });
    },
    fetchFull: fetchPCMReviewFull,
  });
}

export async function classifyPCMOrder(chave: string, tipo: PCMClassification): Promise<void> {
  if (!chave.trim()) throw new Error('A ordem não possui identificação.');
  const { error } = await apoioClient.rpc('classificar_ordem_pcm', { p_chave: chave, p_tipo: tipo });
  if (error) throw new Error(`Não foi possível classificar a ordem: ${error.message}`);
  invalidateApoioSnapshots();
}
