export const SCHEDULE_ATTEMPT_TIMEOUT_MS = 30_000;
export const SCHEDULE_MAX_RETRIES = 1;
export const SCHEDULE_RETRY_DELAY_MS = 1_000;
export const SCHEDULE_RESUME_COOLDOWN_MS = 5_000;

export class ScheduleTimeoutError extends Error {
  readonly isTimeout = true;

  constructor(message = 'A consulta de Lavagem e Lubrificação excedeu o tempo limite.') {
    super(message);
    this.name = 'ScheduleTimeoutError';
  }
}

export function isAbortLikeError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (!error || typeof error !== 'object') return false;
  const err = error as { name?: unknown; message?: unknown; details?: unknown };
  const name = String(err.name || '');
  const message = String(err.message || '');
  const details = String(err.details || '');
  return (
    name === 'AbortError' ||
    /\babort(ed|error)?\b/i.test(message) ||
    /\babort(ed|error)?\b/i.test(details)
  );
}

export function isRetryableScheduleError(error: unknown): boolean {
  if (error instanceof ScheduleTimeoutError) return true;
  if (!error || typeof error !== 'object') return false;
  const err = error as { name?: unknown; message?: unknown; isTimeout?: unknown };
  if (err.isTimeout === true || err.name === 'ScheduleTimeoutError') return true;
  const message = String(err.message || '').toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('fetcherror') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('network unavailable') ||
    message.includes('load failed') ||
    message.includes('falha de conexão') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('timeout') ||
    message.includes('excedeu') ||
    message.includes('statement timeout') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('gateway')
  );
}

export interface ResumeSyncGateInput {
  now: number;
  lastCompletedAt: number;
  lastAttemptAt: number;
  syncInProgress: boolean;
  isHidden?: boolean;
  cooldownMs?: number;
}

/**
 * Evita rajadas de sincronizações duplicadas (ex.: StrictMode, SUBSCRIBED logo após
 * o carregamento inicial, ou focus + visibilitychange disparando juntos).
 */
export function shouldSkipAutoOrResumeSync(input: ResumeSyncGateInput): boolean {
  if (input.isHidden) return true;
  if (input.syncInProgress) return true;
  const cooldown = input.cooldownMs ?? SCHEDULE_RESUME_COOLDOWN_MS;
  if (input.lastCompletedAt > 0 && input.now - input.lastCompletedAt < cooldown) {
    return true;
  }
  if (input.lastAttemptAt > 0 && input.now - input.lastAttemptAt < 1_500) {
    return true;
  }
  return false;
}

function waitWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  if (signal?.aborted) {
    const abortErr = new Error('Consulta de programações cancelada.');
    abortErr.name = 'AbortError';
    return Promise.reject(abortErr);
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      const abortErr = new Error('Consulta de programações cancelada.');
      abortErr.name = 'AbortError';
      reject(abortErr);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface RunScheduleFetchOptions {
  signal?: AbortSignal;
  attemptTimeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

export async function runScheduleFetchWithRetry<T>(
  runAttempt: (attemptSignal: AbortSignal, attemptNumber: number) => Promise<T>,
  options: RunScheduleFetchOptions = {},
): Promise<T> {
  const attemptTimeoutMs = options.attemptTimeoutMs ?? SCHEDULE_ATTEMPT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? SCHEDULE_MAX_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? SCHEDULE_RETRY_DELAY_MS;
  const parentSignal = options.signal;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (parentSignal?.aborted) {
      const abortErr = new Error('Consulta de programações cancelada.');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    const attemptController = new AbortController();
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const abortFromParent = () => attemptController.abort();
    parentSignal?.addEventListener('abort', abortFromParent, { once: true });

    try {
      const result = await Promise.race([
        runAttempt(attemptController.signal, attempt + 1),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            timedOut = true;
            attemptController.abort();
            reject(
              new ScheduleTimeoutError(
                'A consulta de Lavagem e Lubrificação excedeu o tempo limite. Verifique a conexão.',
              ),
            );
          }, attemptTimeoutMs);
        }),
      ]);
      return result;
    } catch (error) {
      if (parentSignal?.aborted || (!timedOut && isAbortLikeError(error, attemptController.signal))) {
        const abortErr = new Error('Consulta de programações cancelada.');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      const canRetry = attempt < maxRetries && (timedOut || isRetryableScheduleError(error));
      if (!canRetry) {
        throw error;
      }

      options.onRetry?.(attempt + 1, error);
      await waitWithSignal(retryDelayMs * (attempt + 1), parentSignal);
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      parentSignal?.removeEventListener('abort', abortFromParent);
    }
  }

  throw new ScheduleTimeoutError('A consulta de Lavagem e Lubrificação excedeu o tempo limite.');
}
