export const LAVAGEM_TAB_SLOW_THRESHOLD_MS = 300;
export const LAVAGEM_TAB_WARNING_COOLDOWN_MS = 4000;

export interface TabRenderEvaluationInput {
  tab: string;
  elapsedMs: number;
  thresholdMs?: number;
}

export interface TabRenderEvaluation {
  tab: string;
  label: string;
  elapsedMs: number;
  thresholdMs: number;
  isSlow: boolean;
  warningMessage: string | null;
}

const TAB_LABELS: Record<string, string> = {
  programacoes: 'Programações',
  dashboard: 'Dashboard',
  importar: 'Importar',
  exportar: 'Exportar',
};

export function getLavagemTabLabel(tab?: string | null): string {
  if (!tab) return 'Aba';
  return TAB_LABELS[tab] ?? tab;
}

export function evaluateTabRenderPerformance({
  tab,
  elapsedMs,
  thresholdMs = LAVAGEM_TAB_SLOW_THRESHOLD_MS,
}: TabRenderEvaluationInput): TabRenderEvaluation {
  const safeElapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? Math.round(elapsedMs) : 0;
  const safeThreshold =
    Number.isFinite(thresholdMs) && thresholdMs > 0
      ? Math.round(thresholdMs)
      : LAVAGEM_TAB_SLOW_THRESHOLD_MS;
  const label = getLavagemTabLabel(tab);
  const isSlow = safeElapsed > safeThreshold;

  return {
    tab,
    label,
    elapsedMs: safeElapsed,
    thresholdMs: safeThreshold,
    isSlow,
    warningMessage: isSlow
      ? `A transição para ${label} levou ${safeElapsed} ms (acima de ${safeThreshold} ms).`
      : null,
  };
}

export interface SlowWarningCooldownInput {
  isSlow: boolean;
  tab: string;
  lastWarnedTab: string | null;
  lastWarnedAt: number;
  now: number;
  cooldownMs?: number;
}

export function shouldWarnOnSlowTabRender({
  isSlow,
  tab,
  lastWarnedTab,
  lastWarnedAt,
  now,
  cooldownMs = LAVAGEM_TAB_WARNING_COOLDOWN_MS,
}: SlowWarningCooldownInput): boolean {
  if (!isSlow) return false;
  if (lastWarnedTab === tab && now - lastWarnedAt < cooldownMs) {
    return false;
  }
  return true;
}
