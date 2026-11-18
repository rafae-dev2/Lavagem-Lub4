import { useEffect, useRef, useState } from 'react';
import { isNavigatorOnline } from '../lib/egressCachePolicy';

export interface NetworkStatusState {
  isOnline: boolean;
  wasOffline: boolean;
  offlineSince: string | null;
}

function formatCurrentClockTime(): string {
  try {
    return new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function useNetworkStatus(syncing: boolean): NetworkStatusState {
  const [isOnline, setIsOnline] = useState<boolean>(() => isNavigatorOnline());
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [offlineSince, setOfflineSince] = useState<string | null>(() =>
    isNavigatorOnline() ? null : formatCurrentClockTime() || null,
  );
  const clearReconnectTimerRef = useRef<number | null>(null);
  const isOnlineRef = useRef(isOnline);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const clearTimer = () => {
      if (clearReconnectTimerRef.current !== null) {
        window.clearTimeout(clearReconnectTimerRef.current);
        clearReconnectTimerRef.current = null;
      }
    };

    const handleOffline = () => {
      clearTimer();
      setIsOnline(false);
      setWasOffline(true);
      setOfflineSince((prev) => prev ?? (formatCurrentClockTime() || null));
    };

    const handleOnline = () => {
      clearTimer();
      setIsOnline(true);
      setOfflineSince(null);
      if (!isOnlineRef.current) {
        setWasOffline(true);
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Sync initial state in case navigator.onLine changed before effect ran
    const currentOnline = isNavigatorOnline();
    if (!currentOnline && isOnlineRef.current) {
      handleOffline();
    } else if (currentOnline && !isOnlineRef.current) {
      handleOnline();
    }

    return () => {
      clearTimer();
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Keep the reconnecting banner visible while syncing, then clear smoothly after sync settles.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isOnline || !wasOffline) return;

    if (clearReconnectTimerRef.current !== null) {
      window.clearTimeout(clearReconnectTimerRef.current);
      clearReconnectTimerRef.current = null;
    }

    if (syncing) return;

    clearReconnectTimerRef.current = window.setTimeout(() => {
      clearReconnectTimerRef.current = null;
      setWasOffline(false);
    }, 3500);

    return () => {
      if (clearReconnectTimerRef.current !== null) {
        window.clearTimeout(clearReconnectTimerRef.current);
        clearReconnectTimerRef.current = null;
      }
    };
  }, [isOnline, wasOffline, syncing]);

  return { isOnline, wasOffline, offlineSince };
}
