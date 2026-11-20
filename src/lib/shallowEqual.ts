import React from 'react';

type PlainRecord = Record<string, unknown>;

/**
 * Fast, deterministic shallow equality for plain objects/props using Object.is.
 */
export function shallowEqual<T extends object>(
  prev: T | null | undefined,
  next: T | null | undefined,
): boolean {
  if (Object.is(prev, next)) return true;
  if (!prev || !next || typeof prev !== 'object' || typeof next !== 'object') {
    return false;
  }

  const prevObj = prev as PlainRecord;
  const nextObj = next as PlainRecord;
  const prevKeys = Object.keys(prevObj);
  const nextKeys = Object.keys(nextObj);

  if (prevKeys.length !== nextKeys.length) return false;

  for (let i = 0; i < prevKeys.length; i += 1) {
    const key = prevKeys[i];
    if (
      !Object.prototype.hasOwnProperty.call(nextObj, key) ||
      !Object.is(prevObj[key], nextObj[key])
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Compares two ReactNode slots shallowly: if both are React elements of the
 * same type and key, compares their props with `shallowEqual`. This allows
 * memoized workspace/layout shells to skip re-rendering when a parent
 * re-evaluates JSX with identical underlying props (e.g., on `lastSync` ticks).
 */
export function areReactNodesShallowEqual(
  prev: React.ReactNode,
  next: React.ReactNode,
): boolean {
  if (Object.is(prev, next)) return true;

  if (Array.isArray(prev) && Array.isArray(next)) {
    if (prev.length !== next.length) return false;
    for (let i = 0; i < prev.length; i += 1) {
      if (!areReactNodesShallowEqual(prev[i], next[i])) return false;
    }
    return true;
  }

  if (React.isValidElement(prev) && React.isValidElement(next)) {
    if (prev.type !== next.type || prev.key !== next.key) return false;
    return shallowEqual(
      prev.props as Record<string, unknown>,
      next.props as Record<string, unknown>,
    );
  }

  return false;
}

/**
 * Shallow props comparator for memoized wrapper components that accept a
 * `children` slot (such as `MemoizedLavagemWorkspace` and `LavagemPremiumLayout`).
 */
export function shallowEqualWithChildren<T extends { children?: React.ReactNode }>(
  prev: T,
  next: T,
): boolean {
  if (Object.is(prev, next)) return true;
  const prevObj = prev as PlainRecord;
  const nextObj = next as PlainRecord;
  const prevKeys = Object.keys(prevObj);
  const nextKeys = Object.keys(nextObj);
  if (prevKeys.length !== nextKeys.length) return false;

  for (let i = 0; i < prevKeys.length; i += 1) {
    const key = prevKeys[i];
    if (!Object.prototype.hasOwnProperty.call(nextObj, key)) return false;
    if (key === 'children') {
      if (!areReactNodesShallowEqual(prev.children, next.children)) return false;
    } else if (!Object.is(prevObj[key], nextObj[key])) {
      return false;
    }
  }

  return true;
}
