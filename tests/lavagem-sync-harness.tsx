import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useSchedules } from '../src/hooks/useSchedules';

declare global {
  interface Window {
    __lavagemSyncHarness?: {
      mounted: boolean;
      generation: number;
    };
  }
}

type ScheduleProbeProps = {
  generation: number;
};

function ScheduleProbe({ generation }: ScheduleProbeProps) {
  const {
    schedules,
    loading,
    error,
    lastSync,
    syncing,
    fromCache,
    refresh,
  } = useSchedules();

  useEffect(() => {
    window.__lavagemSyncHarness = { mounted: true, generation };
    return () => {
      if (window.__lavagemSyncHarness?.generation === generation) {
        window.__lavagemSyncHarness = { mounted: false, generation };
      }
    };
  }, [generation]);

  return (
    <section
      id="schedule-probe"
      data-generation={generation}
      data-loading={String(loading)}
      data-syncing={String(syncing)}
      data-from-cache={String(fromCache)}
    >
      <div id="hook-status" role="status">
        <span id="loading-state">{String(loading)}</span>
        <span id="syncing-state">{String(syncing)}</span>
        <span id="from-cache-state">{String(fromCache)}</span>
        <span id="error-state">{error ?? ''}</span>
        <span id="last-sync-state">{lastSync ?? ''}</span>
      </div>

      <button id="refresh-schedules" type="button" onClick={refresh}>
        Atualizar agora
      </button>

      <output id="schedule-count" aria-label="Quantidade de registros">
        {schedules.length}
      </output>
      <ol id="schedule-list">
        {schedules.map((schedule) => (
          <li
            key={schedule.id}
            data-schedule-id={schedule.id}
            data-situacao={schedule.situacao}
            data-row-index={schedule.rowIndex ?? ''}
          >
            <span className="schedule-id">{schedule.id}</span>
            <span className="schedule-frota">{schedule.frota}</span>
            <span className="schedule-situacao">{schedule.situacao}</span>
            <span className="schedule-row-index">{schedule.rowIndex ?? ''}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function App() {
  const [mounted, setMounted] = useState(true);
  const [generation, setGeneration] = useState(1);

  const toggleHook = () => {
    setMounted((current) => {
      if (current) return false;
      setGeneration((currentGeneration) => currentGeneration + 1);
      return true;
    });
  };

  return (
    <main
      id="lavagem-sync-harness"
      data-hook-mounted={String(mounted)}
      data-generation={generation}
    >
      <h1>Harness de sincronização da lavagem</h1>
      <button id="toggle-hook" type="button" onClick={toggleHook}>
        {mounted ? 'Desmontar hook' : 'Remontar hook'}
      </button>

      {mounted ? (
        <ScheduleProbe key={generation} generation={generation} />
      ) : (
        <section id="hook-unmounted" role="status">
          hook desmontado
        </section>
      )}
    </main>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Elemento #root ausente no harness de lavagem.');
}

createRoot(rootElement).render(<App />);
