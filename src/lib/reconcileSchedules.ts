import type { Programacao } from '../types';
import { shallowEqual } from './shallowEqual';

/**
 * Compares two `Programacao` records field-by-field using `shallowEqual`.
 */
export function areScheduleRecordsShallowEqual(
  prev: Programacao | undefined,
  next: Programacao | undefined,
): boolean {
  if (prev === next) return true;
  if (!prev || !next) return false;
  return shallowEqual(prev, next);
}

/**
 * Reconciles a freshly fetched or deserialized schedule snapshot against the
 * previous array:
 * - Reuses the exact previous `Programacao` object reference for any item whose
 *   fields are shallowly equal.
 * - Returns the exact `previous` array reference if every single item matches
 *   in order, preventing downstream `useMemo` / `React.memo` trees from
 *   re-rendering on `lastSync` ticks when the underlying dataset is unchanged.
 */
export function reconcileScheduleSnapshot(
  previous: Programacao[],
  next: Programacao[],
): Programacao[] {
  if (previous === next) return previous;
  if (previous.length === 0) return next;
  if (next.length === 0) return previous.length === 0 ? previous : next;

  const prevById = new Map<string, Programacao>();
  for (let i = 0; i < previous.length; i += 1) {
    prevById.set(previous[i].id, previous[i]);
  }

  let allSameInOrder = previous.length === next.length;
  const stabilized = new Array<Programacao>(next.length);

  for (let i = 0; i < next.length; i += 1) {
    const incoming = next[i];
    const matched = prevById.get(incoming.id);
    const resolved =
      matched && areScheduleRecordsShallowEqual(matched, incoming)
        ? matched
        : incoming;

    stabilized[i] = resolved;

    if (allSameInOrder && previous[i] !== resolved) {
      allSameInOrder = false;
    }
  }

  return allSameInOrder ? previous : stabilized;
}
