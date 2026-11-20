import { PageType } from "../types";

export const FAVORITE_PAGES_STORAGE_KEY = "bp-favorite-pages-v1";
export const RECENT_PAGES_STORAGE_KEY = "bp-recent-pages-v1";
export const MAX_RECENT_PAGES = 5;

export interface CommandPaletteModuleItem {
  id: PageType;
  label: string;
  section: string;
  keywords?: string[];
}

export interface CommandPaletteQuickAction {
  id: string;
  label: string;
  description: string;
  keywords?: string[];
  shortcut?: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function normalizeCommandQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
    .replace(/\s+/g, " ");
}

function scoreMatch(haystack: string, needle: string, weight: number): number {
  if (!needle) return 0;
  if (haystack === needle) return weight + 40;
  if (haystack.startsWith(needle)) return weight + 24;
  if (haystack.includes(needle)) return weight + 10;
  return 0;
}

export function filterCommandModules(
  modules: readonly CommandPaletteModuleItem[],
  query: string,
  favorites: readonly PageType[] = [],
  recents: readonly PageType[] = [],
): CommandPaletteModuleItem[] {
  const normalized = normalizeCommandQuery(query);
  const favSet = new Set(favorites);
  const recentOrder = new Map(recents.map((id, idx) => [id, idx]));

  if (!normalized) {
    return [...modules];
  }

  const tokens = normalized.split(" ").filter(Boolean);

  const scored: { item: CommandPaletteModuleItem; score: number; index: number }[] = [];

  modules.forEach((item, index) => {
    const labelNorm = normalizeCommandQuery(item.label);
    const sectionNorm = normalizeCommandQuery(item.section);
    const idNorm = normalizeCommandQuery(item.id.replace(/-/g, " "));
    const kwNorm = (item.keywords || []).map(normalizeCommandQuery).join(" ");
    const combined = `${labelNorm} ${sectionNorm} ${idNorm} ${kwNorm}`;

    const allTokensMatch = tokens.every((token) => combined.includes(token));
    if (!allTokensMatch) return;

    let score = 0;
    score += scoreMatch(labelNorm, normalized, 100);
    score += scoreMatch(sectionNorm, normalized, 40);
    score += scoreMatch(kwNorm, normalized, 35);
    score += scoreMatch(idNorm, normalized, 25);

    for (const token of tokens) {
      score += scoreMatch(labelNorm, token, 18);
      score += scoreMatch(kwNorm, token, 10);
      score += scoreMatch(sectionNorm, token, 6);
    }

    if (favSet.has(item.id)) score += 12;
    const recentIdx = recentOrder.get(item.id);
    if (recentIdx !== undefined) score += Math.max(1, 6 - recentIdx);

    scored.push({ item, score, index });
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((entry) => entry.item);
}

export function filterCommandActions(
  actions: readonly CommandPaletteQuickAction[],
  query: string,
): CommandPaletteQuickAction[] {
  const normalized = normalizeCommandQuery(query);
  if (!normalized) return [...actions];
  const tokens = normalized.split(" ").filter(Boolean);

  return actions.filter((action) => {
    const combined = normalizeCommandQuery(
      `${action.label} ${action.description} ${(action.keywords || []).join(" ")}`,
    );
    return tokens.every((token) => combined.includes(token));
  });
}

function getSafeStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readFavoritePages(
  validIds: readonly PageType[],
  storage?: StorageLike | null,
): PageType[] {
  const store = getSafeStorage(storage);
  if (!store) return [];
  const validSet = new Set(validIds);
  try {
    const raw = store.getItem(FAVORITE_PAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const deduped: PageType[] = [];
    for (const entry of parsed) {
      if (typeof entry === "string" && validSet.has(entry as PageType) && !deduped.includes(entry as PageType)) {
        deduped.push(entry as PageType);
      }
    }
    return deduped;
  } catch {
    return [];
  }
}

export function toggleFavoritePage(
  current: readonly PageType[],
  page: PageType,
  storage?: StorageLike | null,
): PageType[] {
  const exists = current.includes(page);
  const next = exists ? current.filter((item) => item !== page) : [page, ...current];
  const store = getSafeStorage(storage);
  if (store) {
    try {
      store.setItem(FAVORITE_PAGES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota / private mode errors
    }
  }
  return next;
}

export function readRecentPages(
  validIds: readonly PageType[],
  storage?: StorageLike | null,
): PageType[] {
  const store = getSafeStorage(storage);
  if (!store) return [];
  const validSet = new Set(validIds);
  try {
    const raw = store.getItem(RECENT_PAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const deduped: PageType[] = [];
    for (const entry of parsed) {
      if (typeof entry === "string" && validSet.has(entry as PageType) && !deduped.includes(entry as PageType)) {
        deduped.push(entry as PageType);
      }
      if (deduped.length >= MAX_RECENT_PAGES) break;
    }
    return deduped;
  } catch {
    return [];
  }
}

export function recordRecentPage(
  current: readonly PageType[],
  page: PageType,
  storage?: StorageLike | null,
): PageType[] {
  const next = [page, ...current.filter((item) => item !== page)].slice(0, MAX_RECENT_PAGES);
  const store = getSafeStorage(storage);
  if (store) {
    try {
      store.setItem(RECENT_PAGES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota / private mode errors
    }
  }
  return next;
}
