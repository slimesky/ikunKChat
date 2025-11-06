import { useCallback } from 'react';

// This type is provided by vite-plugin-pwa
declare global {
  interface Window {
    __SW_DISABLED__: boolean;
  }
}

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

export type UsePWAUpdateReturn = {
  offlineReady: boolean;
  needRefresh: boolean;
  updateStatus: UpdateStatus;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  checkForUpdates: () => Promise<{ hasUpdate: boolean; remoteVersion?: string; error?: string }>;
};

export const usePWAUpdate = (): UsePWAUpdateReturn => {
  const updateServiceWorker = useCallback(async () => {
    // Updates are disabled, so this is a no-op.
  }, []);

  const checkForUpdates = useCallback(async () => {
    // Updates are disabled, always report no available update.
    return { hasUpdate: false };
  }, []);

  return {
    offlineReady: false,
    needRefresh: false,
    updateStatus: 'idle',
    updateServiceWorker,
    checkForUpdates
  };
};