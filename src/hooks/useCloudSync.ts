import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  db, 
  auth, 
  googleProvider, 
  signInWithPopup, 
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
  provider: 'google';
}

export interface CloudSyncOptions {
  onRemoteDataReceived: (remoteData: any, senderDeviceId?: string) => void;
  getExportableData: () => any;
}

export function useCloudSync({ onRemoteDataReceived, getExportableData }: CloudSyncOptions) {
  // 1. Device identity (distinguish PC vs Mobile to avoid self-echo)
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

  // 2. Google User Account & Status
  const [currentUser, setCurrentUser] = useState<User | null>(() => auth.currentUser);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(() => {
    try {
      const raw = localStorage.getItem('physio_user_account');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => (auth.currentUser ? 'syncing' : 'unpaired'));
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [syncNotification, setSyncNotification] = useState<string | null>(null);

  const debounceTimerRef = useRef<any>(null);
  const isRemoteUpdatingRef = useRef<boolean>(false);

  const onRemoteDataReceivedRef = useRef(onRemoteDataReceived);
  const getExportableDataRef = useRef(getExportableData);

  useEffect(() => {
    onRemoteDataReceivedRef.current = onRemoteDataReceived;
  }, [onRemoteDataReceived]);

  useEffect(() => {
    getExportableDataRef.current = getExportableData;
  }, [getExportableData]);

  // QR Code to open the app directly on smartphone
  const pairingUrl = `${window.location.origin}${window.location.pathname}`;

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

  // Push local data to Firestore user document
  const pushToCloud = useCallback(
    async (overrideData?: any) => {
      if (isRemoteUpdatingRef.current) return;
      if (!navigator.onLine) {
        setSyncStatus('offline');
        return;
      }
      if (!auth.currentUser) {
        setSyncStatus('unpaired');
        return;
      }

      setSyncStatus('syncing');
      const user = auth.currentUser;
      const path = `sync_records/${user.uid}`;

      try {
        const dataToSend = overrideData || getExportableDataRef.current();
        const stringified = typeof dataToSend === 'string' ? dataToSend : JSON.stringify(dataToSend);

        const docRef = doc(db, 'sync_records', user.uid);
        await setDoc(
          docRef,
          {
            userId: user.uid,
            userEmail: user.email || '',
            key: user.uid,
            data: stringified,
            version: 1,
            lastDeviceId: deviceId,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        setSyncStatus('synced');
        setLastSyncedAt(new Date());
      } catch (err) {
        console.warn('Firestore push error:', err);
        setSyncStatus(navigator.onLine ? 'error' : 'offline');
        try {
          handleFirestoreError(err, OperationType.WRITE, path);
        } catch {
          // handled
        }
      }
    },
    [deviceId]
  );

  const pushToCloudRef = useRef(pushToCloud);
  useEffect(() => {
    pushToCloudRef.current = pushToCloud;
  }, [pushToCloud]);

  // Debounced push for interactive user edits
  const triggerDebouncedPush = useCallback(() => {
    if (isRemoteUpdatingRef.current) return;
    if (!auth.currentUser) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      pushToCloudRef.current();
    }, 800);
  }, []);

  // Pull data from Firestore
  const pullFromCloud = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }
    if (!auth.currentUser) {
      setSyncStatus('unpaired');
      return;
    }

    setSyncStatus('syncing');
    const user = auth.currentUser;
    const path = `sync_records/${user.uid}`;

    try {
      const docRef = doc(db, 'sync_records', user.uid);
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
          setSyncNotification('⚡ Données synchronisées depuis votre compte Google');
          return;
        }
      }
      setSyncStatus('synced');
    } catch (err) {
      console.warn('Firestore pull notice:', err);
      setSyncStatus('error');
      try {
        handleFirestoreError(err, OperationType.GET, path);
      } catch {}
    }
  }, []);

  const pullFromCloudRef = useRef(pullFromCloud);
  useEffect(() => {
    pullFromCloudRef.current = pullFromCloud;
  }, [pullFromCloud]);

  // Google Login (1-click popup)
  const loginWithGoogle = useCallback(async () => {
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
      setCurrentUser(user);
      setUserAccount(account);
      localStorage.setItem('physio_user_account', JSON.stringify(account));
      setSyncNotification(`Connecté avec ${email} · Synchronisation Cloud active`);
      
      // Pull remote data or push local data
      pullFromCloudRef.current();
    } catch (err: any) {
      console.warn('Google sign-in exception:', err?.message || err);
      setSyncStatus(auth.currentUser ? 'synced' : 'unpaired');
      if (err?.code === 'auth/popup-closed-by-user') {
        setSyncNotification('Connexion Google annulée');
      } else if (err?.code === 'auth/cancelled-popup-request') {
        setSyncNotification('Demande de popup annulée');
      } else {
        setSyncNotification('Connexion Google impossible (vérifiez le bloqueur de popups)');
      }
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch {}
    localStorage.removeItem('physio_user_account');
    setCurrentUser(null);
    setUserAccount(null);
    setSyncStatus('unpaired');
    setSyncNotification('Déconnecté du compte Google');
  }, []);

  // Listen to Auth State and Real-Time Firestore changes
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const setupListenerForUser = (user: User | null) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (!user) {
        setCurrentUser(null);
        setUserAccount(null);
        setSyncStatus('unpaired');
        return;
      }

      setCurrentUser(user);
      const email = (user.email || '').toLowerCase();
      const account: UserAccount = {
        email,
        name: user.displayName || email.split('@')[0],
        avatar: user.photoURL || undefined,
        provider: 'google',
      };
      setUserAccount(account);
      localStorage.setItem('physio_user_account', JSON.stringify(account));

      if (!navigator.onLine) {
        setSyncStatus('offline');
        return;
      }

      // Attach Firestore onSnapshot listener
      const docRef = doc(db, 'sync_records', user.uid);
      unsubscribeSnapshot = onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const record = snapshot.data();
            if (record && record.data) {
              // Ignore self-echo
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

                const senderDevice = record.lastDeviceId?.startsWith('mobile')
                  ? 'Smartphone'
                  : record.lastDeviceId?.startsWith('pc')
                  ? 'PC'
                  : 'Appareil distant';
                setSyncNotification(`⚡ Synchronisation en direct depuis votre ${senderDevice}`);
              } catch (err) {
                console.error('Error parsing Firestore remote payload:', err);
              }
            }
          } else {
            // First time user, sync local data up
            pushToCloudRef.current();
          }
        },
        (error) => {
          console.warn('Firestore onSnapshot notice:', error.message);
          setSyncStatus('error');
        }
      );
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setupListenerForUser(user);
    });

    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      unsubAuth();
    };
  }, [deviceId]);

  // Handle online/offline network events
  useEffect(() => {
    const handleOnline = () => {
      if (auth.currentUser) {
        setSyncStatus('syncing');
        pullFromCloudRef.current();
      }
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
  }, []);

  // Auto-clear notification
  useEffect(() => {
    if (syncNotification) {
      const timer = setTimeout(() => setSyncNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [syncNotification]);

  return {
    deviceId,
    isMobile,
    currentUser,
    userAccount,
    syncStatus,
    lastSyncedAt,
    pairingUrl,
    qrCodeUrl,
    syncNotification,
    setSyncNotification,
    loginWithGoogle,
    logout,
    pushToCloud,
    triggerDebouncedPush,
    pullFromCloud,
  };
}
