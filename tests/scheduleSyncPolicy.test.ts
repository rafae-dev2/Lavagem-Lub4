import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAbortLikeError,
  isRetryableScheduleError,
  runScheduleFetchWithRetry,
  ScheduleTimeoutError,
  shouldSkipAutoOrResumeSync,
} from '../src/lib/scheduleSyncPolicy';

test('runScheduleFetchWithRetry resolves immediately on first successful attempt', async () => {
  let attempts = 0;
  const result = await runScheduleFetchWithRetry(
    async () => {
      attempts += 1;
      return ['ok'];
    },
    { attemptTimeoutMs: 200, maxRetries: 1, retryDelayMs: 10 },
  );
  assert.deepEqual(result, ['ok']);
  assert.equal(attempts, 1);
});

test('runScheduleFetchWithRetry aborts stalled attempt and succeeds on automatic retry', async () => {
  let attempts = 0;
  let firstSignalAborted = false;
  let retriesObserved = 0;

  const result = await runScheduleFetchWithRetry(
    (signal, attemptNumber) =>
      new Promise<string>((resolve, reject) => {
        attempts += 1;
        if (attemptNumber === 1) {
          signal.addEventListener('abort', () => {
            firstSignalAborted = true;
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
          return;
        }
        resolve('recovered');
      }),
    {
      attemptTimeoutMs: 30,
      maxRetries: 1,
      retryDelayMs: 10,
      onRetry: () => {
        retriesObserved += 1;
      },
    },
  );

  assert.equal(result, 'recovered');
  assert.equal(attempts, 2);
  assert.equal(retriesObserved, 1);
  assert.equal(firstSignalAborted, true);
});

test('runScheduleFetchWithRetry retries transient network failure and throws timeout when exhausted', async () => {
  let networkAttempts = 0;
  const recovered = await runScheduleFetchWithRetry(
    async (_signal, attempt) => {
      networkAttempts += 1;
      if (attempt === 1) throw new TypeError('Failed to fetch');
      return 42;
    },
    { attemptTimeoutMs: 200, maxRetries: 1, retryDelayMs: 5 },
  );
  assert.equal(recovered, 42);
  assert.equal(networkAttempts, 2);

  let timeoutAttempts = 0;
  await assert.rejects(
    () =>
      runScheduleFetchWithRetry(
        () =>
          new Promise<never>(() => {
            timeoutAttempts += 1;
          }),
        { attemptTimeoutMs: 20, maxRetries: 1, retryDelayMs: 5 },
      ),
    (err: unknown) => err instanceof ScheduleTimeoutError && isRetryableScheduleError(err),
  );
  assert.equal(timeoutAttempts, 2);
});

test('runScheduleFetchWithRetry does not retry permission errors or parent abort', async () => {
  let permAttempts = 0;
  await assert.rejects(
    () =>
      runScheduleFetchWithRetry(
        async () => {
          permAttempts += 1;
          throw new Error('Supabase: permission denied for function carregar_lavagem_programacoes');
        },
        { attemptTimeoutMs: 200, maxRetries: 1, retryDelayMs: 5 },
      ),
    /permission denied/,
  );
  assert.equal(permAttempts, 1);

  const parent = new AbortController();
  let abortedAttempts = 0;
  await assert.rejects(
    () =>
      runScheduleFetchWithRetry(
        (signal) =>
          new Promise<never>((_resolve, reject) => {
            abortedAttempts += 1;
            signal.addEventListener('abort', () => {
              const err = new Error('Cancelled');
              err.name = 'AbortError';
              reject(err);
            });
            setTimeout(() => parent.abort(), 15);
          }),
        { signal: parent.signal, attemptTimeoutMs: 500, maxRetries: 1, retryDelayMs: 5 },
      ),
    (err: unknown) => err instanceof Error && err.name === 'AbortError',
  );
  assert.equal(abortedAttempts, 1);
});

test('shouldSkipAutoOrResumeSync prevents hidden, concurrent, and duplicate burst syncs', () => {
  assert.equal(
    shouldSkipAutoOrResumeSync({
      now: 10_000,
      lastCompletedAt: 0,
      lastAttemptAt: 0,
      syncInProgress: false,
      isHidden: true,
    }),
    true,
  );
  assert.equal(
    shouldSkipAutoOrResumeSync({
      now: 10_000,
      lastCompletedAt: 0,
      lastAttemptAt: 0,
      syncInProgress: true,
    }),
    true,
  );
  assert.equal(
    shouldSkipAutoOrResumeSync({
      now: 10_000,
      lastCompletedAt: 7_500,
      lastAttemptAt: 7_000,
      syncInProgress: false,
      cooldownMs: 5_000,
    }),
    true,
  );
  assert.equal(
    shouldSkipAutoOrResumeSync({
      now: 10_000,
      lastCompletedAt: 4_000,
      lastAttemptAt: 9_200,
      syncInProgress: false,
    }),
    true,
  );
  assert.equal(
    shouldSkipAutoOrResumeSync({
      now: 10_000,
      lastCompletedAt: 4_000,
      lastAttemptAt: 3_500,
      syncInProgress: false,
    }),
    false,
  );
});

test('isAbortLikeError and isRetryableScheduleError classify wrapped Supabase errors accurately', () => {
  assert.equal(
    isAbortLikeError({ message: 'TypeError: Failed to fetch', details: 'AbortError: signal is aborted' }),
    true,
  );
  assert.equal(
    isRetryableScheduleError(new TypeError('Falha de conexão com o Supabase (Failed to fetch): TypeError: Failed to fetch')),
    true,
  );
  assert.equal(
    isRetryableScheduleError({ message: 'FetchError: request failed' }),
    true,
  );
  assert.equal(
    isRetryableScheduleError({ message: 'Supabase: permission denied for table lavagem_lubrificacao' }),
    false,
  );
});
