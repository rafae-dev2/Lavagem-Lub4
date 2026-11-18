import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  LAVAGEM_TAB_SLOW_THRESHOLD_MS,
  evaluateTabRenderPerformance,
  shouldWarnOnSlowTabRender,
  type TabRenderEvaluation,
} from '../lib/lavagemTabPerformance';

export interface LavagemTabPerformanceState {
  lastMeasurement: TabRenderEvaluation | null;
  slowWarning: TabRenderEvaluation | null;
  dismissSlowWarning: () => void;
}

const getNow = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export function useLavagemTabPerformance(
  activeTab?: string,
  thresholdMs: number = LAVAGEM_TAB_SLOW_THRESHOLD_MS
): LavagemTabPerformanceState {
  const prevTabRef = useRef<string | undefined>(activeTab);
  const pendingTransitionStartRef = useRef<{ tab: string; startedAt: number } | null>(null);
  const lastWarningRef = useRef<{ tab: string | null; at: number }>({ tab: null, at: 0 });

  const [lastMeasurement, setLastMeasurement] = useState<TabRenderEvaluation | null>(null);
  const [slowWarning, setSlowWarning] = useState<TabRenderEvaluation | null>(null);

  if (activeTab && prevTabRef.current !== activeTab) {
    prevTabRef.current = activeTab;
    pendingTransitionStartRef.current = {
      tab: activeTab,
      startedAt: getNow(),
    };
  }

  useLayoutEffect(() => {
    const pending = pendingTransitionStartRef.current;
    if (!pending) return;

    let cancelled = false;
    let rafId = 0;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const finalize = () => {
      if (cancelled) return;
      cancelled = true;
      if (rafId && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(rafId);
      }
      if (fallbackTimer !== null) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }

      pendingTransitionStartRef.current = null;
      const now = getNow();
      const elapsedMs = now - pending.startedAt;
      const evaluation = evaluateTabRenderPerformance({
        tab: pending.tab,
        elapsedMs,
        thresholdMs,
      });

      setLastMeasurement(evaluation);

      if (
        shouldWarnOnSlowTabRender({
          isSlow: evaluation.isSlow,
          tab: evaluation.tab,
          lastWarnedTab: lastWarningRef.current.tab,
          lastWarnedAt: lastWarningRef.current.at,
          now,
        })
      ) {
        lastWarningRef.current = { tab: evaluation.tab, at: now };
        console.warn(`[LavagemPremiumLayout] ${evaluation.warningMessage}`);
        setSlowWarning(evaluation);
      }
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      rafId = window.requestAnimationFrame(finalize);
      // Garante medição mesmo se rAF estiver pausado/reduzido em abas em segundo plano ou headless
      fallbackTimer = setTimeout(finalize, 20);
    } else {
      finalize();
    }

    return () => {
      cancelled = true;
      if (rafId && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(rafId);
      }
      if (fallbackTimer !== null) {
        clearTimeout(fallbackTimer);
      }
    };
  }, [activeTab, thresholdMs]);

  useEffect(() => {
    if (!slowWarning) return;
    const timer = window.setTimeout(() => {
      setSlowWarning(null);
    }, 5500);
    return () => window.clearTimeout(timer);
  }, [slowWarning]);

  const dismissSlowWarning = useCallback(() => {
    setSlowWarning(null);
  }, []);

  return {
    lastMeasurement,
    slowWarning,
    dismissSlowWarning,
  };
}
