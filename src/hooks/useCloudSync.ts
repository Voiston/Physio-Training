import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error' | 'unpaired';

export interface UserAccount {
  email: string;
  name?: string;
  avatar?: string;
  provider: 'google' | 'code';
}

export interface CloudSyncOptions {
  onRemoteDataReceived: (remoteData: any, senderDeviceId?: string) => void;
  getExportableData: () => any;
}

export function useCloudSync({ onRemoteDataReceived, getExportableData }: CloudSyncOptions) {
  // 1. Device identity
  const [deviceId] = useState<string>(() => {
    let id = localStorage.getItem('physio_device_id');
    if (!id) {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      id = `${isMobile ? 'mobile' : 'pc'}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('physio_device_id', id);
    }
    return id;
  });

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // 2. Sync Key & Account
  const [syncKey, setSyncKeyState] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paramKey = urlParams.get('sync');
    if (paramKey && paramKey.trim().length > 0) {
      const cleaned = paramKey.trim();
      localStorage.setItem('physio_sync_key', cleaned);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      return cleaned;
    }

    const saved = localStorage.getItem('physio_sync_key');
    if (saved) return saved;

    const randomCode = `PHYSIO-${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem('physio_sync_key', randomCode);
    return randomCode;
  });

  const [userAccount, setUserAccount] = useState<UserAccount | null>(() => {
    try {
      const raw = localStorage.getItem('physio_user_account');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [activeDevicesCount, setActiveDevicesCount] = useState<number>(1);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [syncNotification, setSyncNotification] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const debounceTimerRef = useRef<any>(null);
  const isRemoteUpdatingRef = useRef<boolean>(false);

  // Keep references to incoming callbacks to prevent effect re-triggering loops
  const onRemoteDataReceivedRef = useRef(onRemoteDataReceived);
  const getExportableDataRef = useRef(getExportableData);

  useEffect(() => {
    onRemoteDataReceivedRef.current = onRemoteDataReceived;
  }, [onRemoteDataReceived]);

  useEffect(() => {
    getExportableDataRef.current = getExportableData;
  }, [getExportableData]);

  // Generate QR code for smartphone pairing
  const pairingUrl = `${window.location.origin}${window.location.pathname}?sync=${encodeURIComponent(syncKey)}`;

  useEffect(() => {
    QRCode.toDataURL(pairingUrl, {
      width: 240,
      margin: 1.5,
      color: {
        dark: '#3b82f6',
        light: '#0f172a',
      },
    })
      .then(url => setQrCodeUrl(url))
      .catch(err => console.error('Failed to generate QR code:', err));
  }, [pairingUrl]);

  // Set new sync key
  const updateSyncKey = useCallback((newKey: string) => {
    const cleanKey = newKey.trim();
    if (!cleanKey) return;
    localStorage.setItem('physio_sync_key', cleanKey);
    setSyncKeyState(cleanKey);
    setSyncNotification(`Code de synchronisation mis à jour : ${cleanKey}`);
  }, []);

  // Google Login (1-click)
  const loginWithGoogle = useCallback(
    (email: string, name?: string) => {
      const cleanEmail = email.trim().toLowerCase();
      const account: UserAccount = {
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        provider: 'google',
      };
      localStorage.setItem('physio_user_account', JSON.stringify(account));
      setUserAccount(account);
      updateSyncKey(cleanEmail);
      setSyncNotification(`Connecté avec Google (${cleanEmail}) - Synchronisation active`);
    },
    [updateSyncKey]
  );

  const logout = useCallback(() => {
    localStorage.removeItem('physio_user_account');
    setUserAccount(null);
    const newRandom = `PHYSIO-${Math.floor(1000 + Math.random() * 9000)}`;
    updateSyncKey(newRandom);
    setSyncNotification('Déconnecté du compte Google');
  }, [updateSyncKey]);

  // Push local data to cloud
  const pushToCloud = useCallback(
    async (overrideData?: any) => {
      if (isRemoteUpdatingRef.current) return;
      if (!navigator.onLine) {
        setSyncStatus('offline');
        return;
      }

      setSyncStatus('syncing');
      try {
        const dataToSend = overrideData || getExportableDataRef.current();
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: syncKey,
            data: dataToSend,
            deviceId,
            userEmail: userAccount?.email,
          }),
        });

        if (!response.ok) throw new Error('Erreur de synchronisation réseau');
        const resJson = await response.json();
        if (resJson.success) {
          setSyncStatus('synced');
          setLastSyncedAt(new Date());
        } else {
          setSyncStatus('error');
        }
      } catch (err) {
        console.warn('Sync push error:', err);
        setSyncStatus('offline');
      }
    },
    [syncKey, deviceId, userAccount?.email]
  );

  const pushToCloudRef = useRef(pushToCloud);
  useEffect(() => {
    pushToCloudRef.current = pushToCloud;
  }, [pushToCloud]);

  // Debounced push for frequent UI modifications
  const triggerDebouncedPush = useCallback(() => {
    if (isRemoteUpdatingRef.current) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      pushToCloudRef.current();
    }, 900);
  }, []);

  // Pull from cloud
  const pullFromCloud = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    try {
      setSyncStatus('syncing');
      const res = await fetch(`/api/sync?key=${encodeURIComponent(syncKey)}`);
      if (!res.ok) throw new Error('Failed to fetch from cloud');
      const json = await res.json();

      if (json.success && json.exists && json.data) {
        isRemoteUpdatingRef.current = true;
        onRemoteDataReceivedRef.current(json.data);
        setTimeout(() => {
          isRemoteUpdatingRef.current = false;
        }, 500);
        setSyncStatus('synced');
        setLastSyncedAt(new Date(json.updatedAt || Date.now()));
        setSyncNotification('Données chargées depuis le Cloud');
      } else {
        // Cloud is empty for this key, push local state to cloud so it's initialized
        setSyncStatus('synced');
        pushToCloudRef.current();
      }
    } catch (err) {
      console.warn('Sync pull error:', err);
      setSyncStatus('offline');
    }
  }, [syncKey]);

  // Setup Server-Sent Events (SSE) listener for instant real-time sync
  useEffect(() => {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sseUrl = `/api/sync/events?key=${encodeURIComponent(syncKey)}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.addEventListener('connected', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        setActiveDevicesCount(Math.max(1, payload.activeDevices || 1));
        setSyncStatus('synced');
      } catch {}
    });

    es.addEventListener('sync-update', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        // Ignore if sent by this device
        if (payload.senderDeviceId === deviceId) {
          setSyncStatus('synced');
          setLastSyncedAt(new Date());
          return;
        }

        // Apply remote update!
        if (payload.data) {
          isRemoteUpdatingRef.current = true;
          onRemoteDataReceivedRef.current(payload.data, payload.senderDeviceId);
          setTimeout(() => {
            isRemoteUpdatingRef.current = false;
          }, 600);

          setSyncStatus('synced');
          setLastSyncedAt(new Date());

          const senderName = payload.senderDeviceId?.startsWith('mobile')
            ? 'Smartphone'
            : payload.senderDeviceId?.startsWith('pc')
            ? 'Ordinateur'
            : 'Appareil distant';

          setSyncNotification(`⚡ Données synchronisées en direct depuis votre ${senderName}`);
        }
      } catch (err) {
        console.error('Error handling sync-update SSE:', err);
      }
    });

    es.onerror = () => {
      // Browser EventSource automatically retries
      if (!navigator.onLine) {
        setSyncStatus('offline');
      }
    };

    // Initial pull from cloud
    pullFromCloud();

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [syncKey, deviceId, pullFromCloud]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus('syncing');
      pullFromCloud();
    };
    const handleOffline = () => {
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pullFromCloud]);

  // Auto-clear notification after 4s
  useEffect(() => {
    if (syncNotification) {
      const timer = setTimeout(() => setSyncNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [syncNotification]);

  return {
    deviceId,
    isMobile,
    syncKey,
    userAccount,
    syncStatus,
    lastSyncedAt,
    activeDevicesCount,
    pairingUrl,
    qrCodeUrl,
    syncNotification,
    setSyncNotification,
    updateSyncKey,
    loginWithGoogle,
    logout,
    pushToCloud,
    triggerDebouncedPush,
    pullFromCloud,
  };
}
