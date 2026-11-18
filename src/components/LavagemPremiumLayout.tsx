import { Children, type ReactNode } from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { useLavagemTabPerformance } from '../hooks/useLavagemTabPerformance';
import '../styles/lavagem-premium.css';

interface Props {
  children: ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
  activeTab?: string;
  slowThresholdMs?: number;
}

export default function LavagemPremiumLayout({
  children,
  refreshing,
  onRefresh,
  activeTab,
  slowThresholdMs,
}: Props) {
  const { lastMeasurement, slowWarning, dismissSlowWarning } = useLavagemTabPerformance(
    activeTab,
    slowThresholdMs
  );
  const childList = Children.toArray(children);
  const hasSharedHeader = Boolean(activeTab) && childList.length >= 2;
  const staticIntro = hasSharedHeader ? childList.slice(0, -1) : null;
  const tabContent = hasSharedHeader ? childList[childList.length - 1] : children;

  return <section className="lavagem-premium" aria-label="Módulo Lavagem e Lubrificação">
    <div className="lavagem-premium-ribbons" aria-hidden="true" />
    <header className="lavagem-premium-hero">
      <div className="lavagem-premium-brand">
        <img src="/logo.png" alt="Branco Peres Agro S/A" />
        <div><h2>Lavagem e Lubrificação</h2><p>BRANCO PERES AGRO</p></div>
      </div>
      <button type="button" className="lavagem-premium-sync" disabled={refreshing} onClick={onRefresh}>
        <RefreshCw size={18} aria-hidden="true" className={refreshing ? 'animate-spin' : ''}/>
        {refreshing ? 'Sincronizando…' : 'Sincronizar'}
      </button>
    </header>
    <div className="lavagem-premium-body">
      {staticIntro}
      {slowWarning && (
        <div
          className="lavagem-perf-soft-warning"
          role="status"
          aria-live="polite"
        >
          <AlertCircle size={16} aria-hidden="true" className="lavagem-perf-soft-warning__icon" />
          <span className="lavagem-perf-soft-warning__text">
            {slowWarning.warningMessage}
          </span>
          <button
            type="button"
            className="lavagem-perf-soft-warning__close"
            onClick={dismissSlowWarning}
            aria-label="Fechar aviso de desempenho"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      <div
        key={activeTab ?? 'lavagem-tab-default'}
        className="lavagem-premium-tab-panel"
        data-active-tab={activeTab}
        data-tab-render-ms={lastMeasurement?.elapsedMs ?? undefined}
      >
        {tabContent}
      </div>
    </div>
  </section>;
}
