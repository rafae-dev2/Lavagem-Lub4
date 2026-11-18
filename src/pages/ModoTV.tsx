import TVMonitor from '../components/TVMonitor';
import { useTVOrders } from '../hooks/useTVOrders';

export default function ModoTV({initialPanel='emergency'}: {initialPanel?: 'emergency' | 'external'}) {
  const monitor = useTVOrders();
  return <TVMonitor {...monitor} initialPanel={initialPanel} />;
}
