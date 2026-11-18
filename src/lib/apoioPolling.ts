/**
 * Revalidação econômica da fotografia Apoio.
 *
 * A sincronização roda a cada minuto, mas a planilha só muda de vez em
 * quando. Em vez de baixar a fotografia inteira (2,46 MB) a cada 30 ou 60
 * segundos, o app consulta uma versão de ~100 bytes e só baixa a fotografia
 * quando a versão muda, quando a última leitura ficou velha ou quando o
 * usuário pede.
 */

/** Intervalo máximo sem baixar a fotografia, mesmo sem mudança de versão. */
export const APOIO_SNAPSHOT_MAX_AGE_MS = 60 * 60 * 1000;
/** Intervalo mínimo entre duas consultas de versão. */
export const APOIO_VERSION_MIN_INTERVAL_MS = 20_000;
/**
 * Intervalo mínimo entre duas cargas automáticas da fotografia. A atualização
 * manual do usuário ignora este limite; o automático espera, para não voltar
 * a gastar banda quando a planilha é editada com frequência.
 */
export const APOIO_AUTO_RELOAD_MIN_INTERVAL_MS = 5 * 60 * 1000;

export interface ApoioVersionState {
  /** Versão aplicada na última fotografia carregada. */
  version: string | null;
  /** Momento (epoch ms) em que a fotografia foi carregada. */
  loadedAt: number | null;
}

/** Normaliza a versão para comparação; sem valor significa "desconhecida". */
export function versionKey(value: string | null | undefined): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

/**
 * Decide se vale baixar a fotografia completa.
 *
 * - Sem versão nova: não baixa (economiza banda).
 * - Versão diferente da carregada: baixa.
 * - Ainda não há fotografia: baixa.
 * - Fotografia velha (acima de `maxAgeMs`): baixa por segurança.
 */
export function shouldReloadSnapshot(
  current: ApoioVersionState,
  nextVersion: string | null | undefined,
  now: number,
  maxAgeMs: number = APOIO_SNAPSHOT_MAX_AGE_MS,
  minIntervalMs: number = APOIO_AUTO_RELOAD_MIN_INTERVAL_MS,
): boolean {
  const next = versionKey(nextVersion);
  // Sem versão confiável, mantém a fotografia atual e só revalida no prazo
  // de segurança (ou quando ainda não há nada carregado).
  if (!next) return current.loadedAt === null || now - current.loadedAt >= maxAgeMs;
  if (current.loadedAt === null) return true;
  if (current.version === null) return true;
  if (current.version !== next) return now - current.loadedAt >= minIntervalMs;
  return now - current.loadedAt >= maxAgeMs;
}

/** Evita consultas de versão em rajada (foco, realtime e intervalo juntos). */
export function shouldCheckVersion(lastCheckAt: number | null, now: number, minIntervalMs: number = APOIO_VERSION_MIN_INTERVAL_MS): boolean {
  if (lastCheckAt === null) return true;
  return now - lastCheckAt >= minIntervalMs;
}

/** Indica se a fotografia passou do prazo de validade. */
export function isSnapshotStale(loadedAt: number | null, now: number, maxAgeMs: number = APOIO_SNAPSHOT_MAX_AGE_MS): boolean {
  if (loadedAt === null) return true;
  return now - loadedAt >= maxAgeMs;
}
