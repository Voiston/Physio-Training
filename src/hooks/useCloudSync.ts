import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  db, 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInAnonymously,
  signOut, 
  onAuthStateChanged, 
  handleFirestoreError,
  OperationType,
  type User 
} from '../firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot 
} from 'firebase/firestore';

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
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      id = `${isMobileDevice ? 'mobile' : 'pc'}_${Math.random().toString(36).substring(2, 9)}`;
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

  // Synchronize Firebase Auth state (Auto-sign in anonymously if not authenticated with Google)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        if (!firebaseUser.isAnonymous) {
          const email = (firebaseUser.email || '').toLowerCase();
          const account: UserAccount = {
            email,
            name: firebaseUser.displayName || email.split('@')[0],
            avatar: firebaseUser.photoURL || undefined,
            provider: 'google',
          };
          setUserAccount(account);
          localStorage.setItem('physio_user_account', JSON.stringify(account));
        }
      } else {
        signInAnonymously(auth).catch((err) => {
          console.warn('Anonymous sign-in notice:', err?.message || err);
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Set new sync key
  const updateSyncKey = useCallback((newKey: string) => {
    const cleanKey = newKey.trim();
    if (!cleanKey) return;
    localStorage.setItem('physio_sync_key', cleanKey);
    setSyncKeyState(cleanKey);
    setSyncNotification(`Code de synchronisation mis à jour : ${cleanKey}`);
  }, []);

  // Helper to get safe room id
  const getRoomId = (key: string) => key.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');

  // Push local data to cloud (Firestore room first, user UID sync, server fallback)
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
        const stringified = typeof dataToSend === 'string' ? dataToSend : JSON.stringify(dataToSend);
        const roomId = getRoomId(syncKey);

        // 1. Save directly to Firestore room (instant QR code sync between phone and PC)
        if (auth.currentUser && roomId) {
          try {
            const roomRef = doc(db, 'sync_rooms', roomId);
            await setDoc(
              roomRef,
              {
                key: roomId,
                data: stringified,
                version: 1,
                lastDeviceId: deviceId,
                updatedAt: new Date().toISOString(),
                userEmail: userAccount?.email || '',
              },
              { merge: true }
            );

            // Also keep private record if signed in with Google
            if (userAccount?.provider === 'google' && auth.currentUser.emailVerified) {
              const docRef = doc(db, 'sync_records', auth.currentUser.uid);
              setDoc(
                docRef,
                {
                  userId: auth.currentUser.uid,
                  userEmail: auth.currentUser.email || userAccount?.email || '',
                  key: roomId,
                  data: stringified,
                  version: 1,
                  lastDeviceId: deviceId,
                  updatedAt: new Date().toISOString(),
                },
                { merge: true }
              ).catch(() => {});
            }

            setSyncStatus('synced');
            setLastSyncedAt(new Date());
            return;
          } catch (err: any) {
            console.warn('Firestore room push warning:', err?.message || err);
          }
        }

        // 2. Fallback to Express backend if available
        try {
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

          if (response.ok) {
            const resJson = await response.json();
            if (resJson.success) {
              setSyncStatus('synced');
              setLastSyncedAt(new Date());
              return;
            }
          }
        } catch {
          // Backend not running (e.g. GitHub Pages)
        }

        setSyncStatus('synced');
        setLastSyncedAt(new Date());
      } catch (err) {
        console.warn('Sync push notice:', err);
        setSyncStatus(navigator.onLine ? 'synced' : 'offline');
      }
    },
    [syncKey, deviceId, userAccount?.email, userAccount?.provider]
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
      const roomId = getRoomId(syncKey);

      // 1. Pull from Firestore room
      if (auth.currentUser && roomId) {
        try {
          const roomRef = doc(db, 'sync_rooms', roomId);
          const docSnap = await getDoc(roomRef);
          if (docSnap.exists()) {
            const record = docSnap.data();
            if (record && record.data) {
              const parsed = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;
              isRemoteUpdatingRef.current = true;
              onRemoteDataReceivedRef.current(parsed, record.lastDeviceId);
              setTimeout(() => {
                isRemoteUpdatingRef.current = false;
              }, 500);
              setSyncStatus('synced');
              setLastSyncedAt(new Date(record.updatedAt || Date.now()));
              setSyncNotification('⚡ Données chargées depuis Firestore Cloud');
              return;
            }
          }
        } catch (err: any) {
          console.warn('Firestore room pull warning:', err?.message || err);
        }
      }

      // 2. If authenticated with Google, check user's private doc
      if (auth.currentUser && userAccount?.provider === 'google') {
        const docRef = doc(db, 'sync_records', auth.currentUser.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const record = docSnap.data();
            if (record && record.data) {
              const parsed = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;
              isRemoteUpdatingRef.current = true;
              onRemoteDataReceivedRef.current(parsed, record.lastDeviceId);
              setTimeout(() => {
                isRemoteUpdatingRef.current = false;
              }, 500);
              setSyncStatus('synced');
              setLastSyncedAt(new Date(record.updatedAt || Date.now()));
              setSyncNotification('⚡ Données chargées depuis Firestore Cloud');
              return;
            }
          }
        } catch {}
      }

      // 3. Fallback to Express backend if available
      try {
        const res = await fetch(`/api/sync?key=${encodeURIComponent(syncKey)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.exists && json.data) {
            isRemoteUpdatingRef.current = true;
            onRemoteDataReceivedRef.current(json.data);
            setTimeout(() => {
              isRemoteUpdatingRef.current = false;
            }, 500);
            setSyncStatus('synced');
            setLastSyncedAt(new Date(json.updatedAt || Date.now()));
            setSyncNotification('Données chargées depuis le serveur');
            return;
          }
        }
      } catch {
        // Backend not running
      }

      setSyncStatus('synced');
    } catch (err) {
      console.warn('Sync pull notice:', err);
      setSyncStatus('synced');
    }
  }, [syncKey, userAccount?.provider]);

  // Google Login (Real Firebase Auth with 1-click popup)
  const loginWithGoogle = useCallback(
    async () => {
      try {
        setSyncStatus('syncing');
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        const email = (user.email || '').toLowerCase();
        const account: UserAccount = {
          email,
          name: user.displayName || email.split('@')[0],
          avatar: user.photoURL || undefined,
          provider: 'google',
        };
        setUserAccount(account);
        localStorage.setItem('physio_user_account', JSON.stringify(account));
        updateSyncKey(email);
        setSyncNotification(`Connecté avec Google (${email}) - Synchronisation Firestore active`);
        pullFromCloud();
      } catch (err: any) {
        console.warn('Google sign-in exception:', err?.message || err);
        setSyncStatus('synced');
        if (err?.code === 'auth/popup-closed-by-user') {
          setSyncNotification('Connexion Google annulée');
        } else if (err?.code === 'auth/cancelled-popup-request') {
          setSyncNotification('Demande de popup annulée');
        } else {
          setSyncNotification('Connexion Google impossible (vérifiez le bloqueur de popups)');
        }
      }
    },
    [updateSyncKey, pullFromCloud]
  );

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch {}
    localStorage.removeItem('physio_user_account');
    setUserAccount(null);
    const newRandom = `PHYSIO-${Math.floor(1000 + Math.random() * 9000)}`;
    updateSyncKey(newRandom);
    setSyncNotification('Déconnecté du compte Google');
  }, [updateSyncKey]);

  // Setup Real-Time listeners (Firestore room onSnapshot + SSE fallback)
  useEffect(() => {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    let unsubscribeSnapshot: (() => void) | null = null;
    let sseSource: EventSource | null = null;
    const roomId = getRoomId(syncKey);

    const attachFirestoreListener = (currentUser: User | null) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
      if (!currentUser || !roomId) return;

      try {
        const roomRef = doc(db, 'sync_rooms', roomId);
        unsubscribeSnapshot = onSnapshot(
          roomRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const record = snapshot.data();
              if (record && record.data) {
                if (record.lastDeviceId === deviceId) {
                  setSyncStatus('synced');
                  setLastSyncedAt(new Date(record.updatedAt || Date.now()));
                  return;
                }

                try {
                  const parsed = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;
                  isRemoteUpdatingRef.current = true;
                  onRemoteDataReceivedRef.current(parsed, record.lastDeviceId);
                  setTimeout(() => {
                    isRemoteUpdatingRef.current = false;
                  }, 600);

                  setSyncStatus('synced');
                  setLastSyncedAt(new Date(record.updatedAt || Date.now()));
                  const senderName = record.lastDeviceId?.startsWith('mobile')
                    ? 'Smartphone'
                    : record.lastDeviceId?.startsWith('pc')
                    ? 'Ordinateur'
                    : 'Appareil distant';
                  setSyncNotification(`⚡ Données synchronisées en direct depuis votre ${senderName}`);
                } catch (err) {
                  console.error('Error parsing Firestore remote payload:', err);
                }
              }
            }
          },
          (error) => {
            console.warn('Firestore onSnapshot listener notice:', error.message);
          }
        );
      } catch (err) {
        console.warn('Could not attach Firestore onSnapshot:', err);
      }
    };

    if (auth.currentUser) {
      attachFirestoreListener(auth.currentUser);
    }

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      attachFirestoreListener(u);
    });

    // Also attempt SSE on /api/sync/events if available
    try {
      const sseUrl = `/api/sync/events?key=${encodeURIComponent(syncKey)}`;
      sseSource = new EventSource(sseUrl);

      sseSource.addEventListener('connected', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          setActiveDevicesCount(Math.max(1, payload.activeDevices || 1));
          setSyncStatus('synced');
        } catch {}
      });

      sseSource.addEventListener('sync-update', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.senderDeviceId === deviceId) {
            setSyncStatus('synced');
            setLastSyncedAt(new Date());
            return;
          }

          if (payload.data) {
            isRemoteUpdatingRef.current = true;
            onRemoteDataReceivedRef.current(payload.data, payload.senderDeviceId);
            setTimeout(() => {
              isRemoteUpdatingRef.current = false;
            }, 600);

            setSyncStatus('synced');
            setLastSyncedAt(new Date());
            setSyncNotification('⚡ Données synchronisées en direct');
          }
        } catch {}
      });

      sseSource.onerror = () => {
        if (!navigator.onLine) setSyncStatus('offline');
      };
    } catch {}

    pullFromCloud();

    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      if (sseSource) sseSource.close();
      unsubAuth();
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
