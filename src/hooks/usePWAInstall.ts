import { useCallback, useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PWAInstallSnapshot {
  isStandalone: boolean;
  isIOS: boolean;
  hasDeferredPrompt: boolean;
}

export type PWAInstallMode = 'installed' | 'native' | 'ios-guide' | 'manual-guide';

export function resolvePWAInstallMode(snapshot: PWAInstallSnapshot): PWAInstallMode {
  if (snapshot.isStandalone) return 'installed';
  if (snapshot.hasDeferredPrompt) return 'native';
  if (snapshot.isIOS) return 'ios-guide';
  return 'manual-guide';
}

export function detectIOSDevice(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent || '');
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkStandalone = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsInstalled(checkStandalone());
    setIsIOS(detectIOSDevice(window.navigator.userAgent));

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const mode = resolvePWAInstallMode({
    isStandalone: isInstalled,
    isIOS,
    hasDeferredPrompt: Boolean(deferredPrompt),
  });

  return {
    mode,
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    install,
  };
}
