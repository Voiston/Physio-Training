import { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from 'firebase/auth';

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
  onClearLocalHealthData?: () => void;
}

// Singleton de chargement différé : Firebase n'est importé que si un compte existe ou sur action utilisateur
let firebaseModulePromise: Promise<typeof import('../firebase')> | null = null;
function getFirebase() {
  if (!firebaseModulePromise) {
    firebaseModulePromise = import('../firebase');
  }
  return firebaseModulePromise;
}

/**
 * Purge hermétique des données de santé privées dans le localStorage.
 * PRÉSERVE :
 * - 'physio_device_id' (identité de l'appareil matériel pour éviter les boucles d'écho)
 * PURGE FORMELLEMENT :
 * - Toutes les clés temporelles YYYY-MM-DD_*
 * - Toutes les configurations de l'athlète physio_* (hors device_id)
 * - Le brouillon de séance Mode Salle 'training_live_session_draft_v1'
 */
export function purgeLocalHealthStorage(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // Clés de santé temporelles YYYY-MM-DD_*
      if (/^\d{4}-\d{2}-\d{2}_/.test(key)) {
        keysToRemove.push(key);
        continue;
      }

      // Clés de profil et configurations de l'athlète
      if (
        key.startsWith('physio_') &&
        key !== 'physio_device_id' // Préservé
      ) {
        keysToRemove.push(key);
      }
    }

    // Purge garantie du brouillon de séance en salle sur appareil partagé
    keysToRemove.push('training_live_session_draft_v1');

    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn('Erreur lors de la purge sécurisée du stockage local:', err);
  }
}

/**
 * Vérifie si le localStorage contient des données significatives de santé
 */
export function hasLocalHealthData(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && /^\d{4}-\d{2}-\d{2}_/.test(key)) {
        return true;
      }
    }
  } catch {}
  return false;
}

export function useCloudSync({ onRemoteDataReceived, getExportableData, onClearLocalHealthData }: CloudSyncOptions) {
  // 1. Device identity (distinguish PC vs Mobile to avoid self-echo)
  const [deviceId] = useState<string>(() => {
    let id = localStorage.getItem('physio_device_id');
    if (!id) {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
      id = `${isMobileDevice ? 'mobile' : 'pc'}_${uuid}`;
      localStorage.setItem('physio_device_id', id);
    }
    return id;
  });

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // 2. Google User Account & Status
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(() => {
    try {
      const raw = localStorage.getItem('physio_user_account');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => {
    try {
      return localStorage.getItem('physio_user_account') ? 'syncing' : 'unpaired';
    } catch {
      return 'unpaired';
    }
  });

  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [syncNotification, setSyncNotification] = useState<string | null>(null);

  const [confirmFirstPush, setConfirmFirstPush] = useState<boolean>(false);

  const debounceTimerRef = useRef<any>(null);
  const isRemoteUpdatingRef = useRef<boolean>(false);

  const onRemoteDataReceivedRef = useRef(onRemoteDataReceived);
  const getExportableDataRef = useRef(getExportableData);
  const onClearLocalHealthDataRef = useRef(onClearLocalHealthData);

  useEffect(() => {
    onRemoteDataReceivedRef.current = onRemoteDataReceived;
  }, [onRemoteDataReceived]);

  useEffect(() => {
    getExportableDataRef.current = getExportableData;
  }, [getExportableData]);

  useEffect(() => {
    onClearLocalHealthDataRef.current = onClearLocalHealthData;
  }, [onClearLocalHealthData]);

  // QR Code pairing URL to open the app directly on smartphone
  const pairingUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${typeof window !== 'undefined' ? window.location.pathname : ''}`;

  // Push local data to Firestore user document
  const pushToCloud = useCallback(
    async (overrideData?: any) => {
      if (isRemoteUpdatingRef.current) return;
      if (!navigator.onLine) {
        setSyncStatus('offline');
        return;
      }
      
      const fb = await getFirebase();
      if (!fb.auth.currentUser) {
        setSyncStatus('unpaired');
        return;
      }

      setSyncStatus('syncing');
      const user = fb.auth.currentUser;
      const path = `sync_records/${user.uid}`;

      try {
        const dataToSend = overrideData || getExportableDataRef.current();
        const stringified = typeof dataToSend === 'string' ? dataToSend : JSON.stringify(dataToSend);

        const docRef = fb.doc(fb.db, 'sync_records', user.uid);
        await fb.setDoc(
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
        setConfirmFirstPush(false);
      } catch (err) {
        console.warn('Firestore push error:', err);
        setSyncStatus(navigator.onLine ? 'error' : 'offline');
        try {
          fb.handleFirestoreError(err, fb.OperationType.WRITE, path);
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
    if (!localStorage.getItem('physio_user_account')) return;
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
    const fb = await getFirebase();
    if (!fb.auth.currentUser) {
      setSyncStatus('unpaired');
      return;
    }

    setSyncStatus('syncing');
    const user = fb.auth.currentUser;
    const path = `sync_records/${user.uid}`;

    try {
      const docRef = fb.doc(fb.db, 'sync_records', user.uid);
      const docSnap = await fb.getDoc(docRef);

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
        fb.handleFirestoreError(err, fb.OperationType.GET, path);
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
      const fb = await getFirebase();
      const result = await fb.signInWithPopup(fb.auth, fb.googleProvider);
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
      
      // Pull remote data or handle snapshot
      pullFromCloudRef.current();
    } catch (err: any) {
      console.warn('Google sign-in exception:', err?.message || err);
      try {
        const fb = await getFirebase();
        setSyncStatus(fb.auth.currentUser ? 'synced' : 'unpaired');
      } catch {
        setSyncStatus('unpaired');
      }
      if (err?.code === 'auth/popup-closed-by-user') {
        setSyncNotification('Connexion Google annulée');
      } else if (err?.code === 'auth/cancelled-popup-request') {
        setSyncNotification('Demande de popup annulée');
      } else {
        setSyncNotification('Connexion Google impossible (vérifiez le bloqueur de popups)');
      }
    }
  }, []);

  // Logout avec PURGE SÉCURISÉE du localStorage pour cloisonner les données de santé sur appareil partagé
  const logout = useCallback(async () => {
    try {
      const fb = await getFirebase();
      await fb.signOut(fb.auth);
    } catch {}

    // 1. Purge du compte Google enregistré
    localStorage.removeItem('physio_user_account');
    setCurrentUser(null);
    setUserAccount(null);
    setSyncStatus('unpaired');
    setConfirmFirstPush(false);

    // 2. Purge de toutes les données de santé locales (VFC, RPE, charges, blocs, etc.)
    purgeLocalHealthStorage();

    // 3. Réinitialisation des états en mémoire du client React
    if (onClearLocalHealthDataRef.current) {
      onClearLocalHealthDataRef.current();
    }

    setSyncNotification('Déconnecté : données de santé locales sécurisées et purgées de cet appareil');
  }, []);

  // Annuler le premier push sur un compte vierge (réinitialise localement)
  const rejectFirstPush = useCallback(() => {
    setConfirmFirstPush(false);
    purgeLocalHealthStorage();
    if (onClearLocalHealthDataRef.current) {
      onClearLocalHealthDataRef.current();
    }
    setSyncNotification('Nouveau compte initialisé sans les données de l\'appareil');
  }, []);

  // Confirmer le premier push sur un compte vierge (importe les données locales vers le cloud)
  const acceptFirstPush = useCallback(() => {
    setConfirmFirstPush(false);
    pushToCloudRef.current();
    setSyncNotification('Données locales associées avec succès à votre compte Cloud');
  }, []);

  // Coupure ou réactivation du réseau Firestore pendant les séances hors-ligne
  const setNetworkState = useCallback(async (enabled: boolean) => {
    if (firebaseModulePromise) {
      try {
        const fb = await firebaseModulePromise;
        if (enabled) {
          await fb.enableNetwork(fb.db);
        } else {
          await fb.disableNetwork(fb.db);
        }
      } catch {}
    }
  }, []);

  // Listen to Auth State and Real-Time Firestore changes UNIQUEMENT si un compte est enregistré
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    let unsubAuth: (() => void) | null = null;
    let isCancelled = false;

    const initSync = async () => {
      // Si aucun compte n'est enregistré dans localStorage, ne pas initialiser Firebase
      const raw = localStorage.getItem('physio_user_account');
      if (!raw) {
        setSyncStatus('unpaired');
        return;
      }

      try {
        const fb = await getFirebase();
        if (isCancelled) return;

        const setupListenerForUser = (user: User | null) => {
          if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
          }

          if (!user) {
            setCurrentUser(null);
            setUserAccount(null);
            setSyncStatus('unpaired');
            setConfirmFirstPush(false);
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
          const docRef = fb.doc(fb.db, 'sync_records', user.uid);
          unsubscribeSnapshot = fb.onSnapshot(
            docRef,
            (snapshot) => {
              if (snapshot.exists()) {
                setConfirmFirstPush(false);
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
                // First time user (document cloud vierge)
                if (hasLocalHealthData()) {
                  setConfirmFirstPush(true);
                  setSyncStatus('synced');
                  setSyncNotification('Nouveau compte détecté : confirmation requise pour la synchronisation');
                } else {
                  pushToCloudRef.current();
                }
              }
            },
            (error) => {
              console.warn('Firestore onSnapshot notice:', error.message);
              setSyncStatus('error');
            }
          );
        };

        unsubAuth = fb.onAuthStateChanged(fb.auth, (user) => {
          if (!isCancelled) {
            setupListenerForUser(user);
          }
        });
      } catch (err) {
        console.warn('Erreur initialisation dynamique Firebase:', err);
        setSyncStatus('error');
      }
    };

    initSync();

    return () => {
      isCancelled = true;
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      if (unsubAuth) unsubAuth();
    };
  }, [deviceId]);

  // Handle online/offline network events
  useEffect(() => {
    const handleOnline = () => {
      if (localStorage.getItem('physio_user_account')) {
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
    confirmFirstPush,
    acceptFirstPush,
    rejectFirstPush,
    loginWithGoogle,
    logout,
    pushToCloud,
    triggerDebouncedPush,
    pullFromCloud,
    setNetworkState,
  };
}
