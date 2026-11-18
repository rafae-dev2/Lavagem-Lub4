import { createRoot } from 'react-dom/client';
import { useTVOrders } from '../src/hooks/useTVOrders';
import '../src/styles/tv-monitor.css';

function Harness() {
  const monitor = useTVOrders();
  return <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
    <h1>Teste isolado de recuperação Modo TV</h1>
    <p data-testid="online">navigator.onLine: {String(navigator.onLine)}</p>
    <p data-testid="connection">Conexão: {monitor.connection}</p>
    <p data-testid="error">Erro: {monitor.error || 'nenhum'}</p>
    <p data-testid="count">Snapshot: {monitor.data?.orders.length ?? 'sem dados'}</p>
    <p data-testid="refreshing">Atualizando: {String(monitor.refreshing)}</p>
    <button type="button" disabled={monitor.refreshing} onClick={() => void monitor.refresh()}>Tentar leitura</button>
    <button type="button" onClick={() => window.dispatchEvent(new Event('online'))}>Disparar evento online</button>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Harness />);
