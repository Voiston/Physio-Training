import { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from 'firebase/auth';
import { compressString, decompressString, computeQuotaUsage } from '../utils/compression';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error' | 'unpaired';

export interface UserAccount {
  email: string;
  name?: string;
  avatar?: string;
  provider: 'google';
}

export interface CloudSyncOptions {
  onRemoteDataReceived: (remoteData: unknown, senderDeviceId?: string) => void;
  getExportableData: () => unknown;
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
  } catch (err) { console.warn('[cloudSync] Lecture du localStorage impossible', err); }
  return false;
}

/** Code d'une erreur Firebase (`permission-denied`, `auth/popup-closed-by-user`…), si présent. */
function errorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') return err.code;
  return undefined;
}

/** Message d'une erreur quelconque, si présent. */
function errorMessage(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') return err.message;
  return undefined;
}

/**
 * Enveloppe une promesse avec un délai maximal (timeout) strict pour interdire tout blocage infini.
 */
function withTimeout<T>(promise: Promise<T>, ms = 12000, errorMsg = 'Délai d\'attente de synchronisation dépassé (12s)'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMsg));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Rafraîchit de façon transparente et sécurisée le token d'authentification Google ID.
 * Prévient les déconnexions inopinées après 45-60 min d'utilisation ou mise en veille.
 */
async function refreshAuthToken(force = false): Promise<boolean> {
  try {
    const fb = await getFirebase();
    const user = fb.auth.currentUser;
    if (!user) return false;
    await user.getIdToken(force);
    return true;
  } catch (err) {
    console.warn('[cloudSync] Renouvellement du token Google ID échoué:', err);
    return false;
  }
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
    } catch (err) { console.warn('[cloudSync] Compte utilisateur local illisible', err); }
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
  const [qrCodeUrl] = useState<string>('');
  const [syncNotification, setSyncNotification] = useState<string | null>(null);
  const [quotaUsage, setQuotaUsage] = useState<ReturnType<typeof computeQuotaUsage> | null>(null);
  const [syncErrorDetail, setSyncErrorDetail] = useState<string | null>(null);

  const [confirmFirstPush, setConfirmFirstPush] = useState<boolean>(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Mémoire du dernier payload envoyé pour dirty-check (évite les réécritures inutiles)
  const lastPushedDataRef = useRef<string>('');

  // Push local data to Firestore user document
  const pushToCloud = useCallback(
    async (overrideData?: unknown) => {
      if (isRemoteUpdatingRef.current) return;
      if (!navigator.onLine) {
        setSyncStatus('offline');
        setSyncErrorDetail('Appareil hors-ligne : les modifications sont enregistrées localement');
        return;
      }
      
      const fb = await getFirebase();
      if (!fb.auth.currentUser) {
        setSyncStatus('unpaired');
        return;
      }

      const user = fb.auth.currentUser;
      const path = `sync_records/${user.uid}`;

      let stringified = '';
      let compressed = '';
      try {
        await refreshAuthToken(false);
        const dataToSend = overrideData || getExportableDataRef.current();
        stringified = typeof dataToSend === 'string' ? dataToSend : JSON.stringify(dataToSend);

        // Dirty-check : éviter de repousser vers Firestore si le document est rigoureusement identique
        if (!overrideData && lastPushedDataRef.current === stringified) {
          setSyncStatus('synced');
          setSyncErrorDetail(null);
          return;
        }

        setSyncStatus('syncing');

        // Compression Gzip standard (réduction drastique de 85% à 95% du volume réseau et stockage)
        compressed = await compressString(stringified);
        const quota = computeQuotaUsage(compressed.length);
        setQuotaUsage(quota);

        if (quota.isOverQuota) {
          const errMsg = `Plafond de données Cloud dépassé (${(quota.usedChars / 1024).toFixed(1)} Ko sur 500 Ko). Exportez une archive pour libérer de l'espace.`;
          console.error('[Cloud Sync]', errMsg);
          setSyncStatus('error');
          setSyncErrorDetail(errMsg);
          setSyncNotification(`❌ ${errMsg}`);
          return;
        }

        if (quota.isWarning) {
          setSyncNotification(`⚠️ Volume de données élevé (${quota.percent}% du quota cloud utilisé)`);
        }

        const docRef = fb.doc(fb.db, 'sync_records', user.uid);
        await withTimeout(
          fb.setDoc(
            docRef,
            {
              userId: user.uid,
              userEmail: user.email || '',
              key: user.uid,
              data: compressed,
              version: 1,
              lastDeviceId: deviceId,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          ),
          12000,
          'Délai de téléversement Cloud dépassé (12s). Vérifiez votre connexion.'
        );

        lastPushedDataRef.current = stringified;
        setSyncStatus('synced');
        setSyncErrorDetail(null);
        setLastSyncedAt(new Date());
        setConfirmFirstPush(false);
      } catch (err: unknown) {
        // En cas de permission-denied, le token Google ID a pu expirer après 45-60 min d'inactivité.
        // Tentative automatique et transparente de renouvellement forcé du token + seconde tentative immédiate.
        if (errorCode(err) === 'permission-denied' && fb.auth.currentUser && compressed) {
          console.log('[cloudSync] Token potentiellement expiré, renouvellement forcé en cours...');
          const renewed = await refreshAuthToken(true);
          if (renewed) {
            try {
              const docRef = fb.doc(fb.db, 'sync_records', user.uid);
              await withTimeout(
                fb.setDoc(
                  docRef,
                  {
                    userId: user.uid,
                    userEmail: user.email || '',
                    key: user.uid,
                    data: compressed,
                    version: 1,
                    lastDeviceId: deviceId,
                    updatedAt: new Date().toISOString(),
                  },
                  { merge: true }
                ),
                12000,
                'Délai de téléversement Cloud dépassé (12s).'
              );
              lastPushedDataRef.current = stringified;
              setSyncStatus('synced');
              setSyncErrorDetail(null);
              setLastSyncedAt(new Date());
              setConfirmFirstPush(false);
              return;
            } catch (retryErr) {
              console.warn('[cloudSync] Échec persistant après renouvellement forcé du token:', retryErr);
            }
          }
        }

        console.warn('Firestore push error:', err);
        setSyncStatus(navigator.onLine ? 'error' : 'offline');
        const desc = errorCode(err) === 'permission-denied'
          ? 'Accès refusé par les règles de sécurité Firestore (compte Google non autorisé ou session expirée).'
          : errorCode(err) === 'resource-exhausted'
          ? 'Quota Firestore temporairement saturé. Nouvelle tentative dans un instant.'
          : errorMessage(err) || 'Erreur réseau lors de la synchronisation cloud.';
        setSyncErrorDetail(desc);
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

  // Debounced push for interactive user edits (1500 ms pour regrouper les saisies sans saturer Firestore)
  const triggerDebouncedPush = useCallback(() => {
    if (isRemoteUpdatingRef.current) return;
    if (!localStorage.getItem('physio_user_account')) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      pushToCloudRef.current();
    }, 1500);
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
      await refreshAuthToken(false);
      const docRef = fb.doc(fb.db, 'sync_records', user.uid);
      let docSnap;
      try {
        docSnap = await withTimeout(
          fb.getDoc(docRef),
          10000,
          'Délai de récupération Cloud dépassé (10s).'
        );
      } catch (firstErr: unknown) {
        if (errorCode(firstErr) === 'permission-denied' && fb.auth.currentUser) {
          console.log('[cloudSync] Token expiré lors du pull, renouvellement forcé...');
          const renewed = await refreshAuthToken(true);
          if (renewed) {
            docSnap = await withTimeout(
              fb.getDoc(docRef),
              10000,
              'Délai de récupération Cloud dépassé (10s).'
            );
          } else {
            throw firstErr;
          }
        } else {
          throw firstErr;
        }
      }

      if (docSnap.exists()) {
        const record = docSnap.data();
        if (record && record.data) {
          const quota = computeQuotaUsage(record.data.length);
          setQuotaUsage(quota);
          const decompressed = typeof record.data === 'string' ? await decompressString(record.data) : record.data;
          const parsed = typeof decompressed === 'string' ? JSON.parse(decompressed) : decompressed;
          isRemoteUpdatingRef.current = true;
          onRemoteDataReceivedRef.current(parsed, record.lastDeviceId);
          setTimeout(() => {
            isRemoteUpdatingRef.current = false;
          }, 500);

          setSyncStatus('synced');
          setSyncErrorDetail(null);
          setLastSyncedAt(new Date(record.updatedAt || Date.now()));
          setSyncNotification('⚡ Données synchronisées depuis votre compte Google');
          return;
        }
      }
      setSyncStatus('synced');
      setSyncErrorDetail(null);
    } catch (err: unknown) {
      console.warn('Firestore pull notice:', err);
      setSyncStatus('error');
      const desc = errorCode(err) === 'permission-denied'
        ? 'Accès refusé par les règles Firestore (compte non autorisé).'
        : errorMessage(err) || 'Impossible de récupérer vos données depuis le Cloud.';
      setSyncErrorDetail(desc);
      try {
        fb.handleFirestoreError(err, fb.OperationType.GET, path);
      } catch (err) { console.warn("[cloudSync] Journalisation de l'erreur Firestore échouée", err); }
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
    } catch (err: unknown) {
      console.warn('Google sign-in exception:', errorMessage(err) || err);
      try {
        const fb = await getFirebase();
        setSyncStatus(fb.auth.currentUser ? 'synced' : 'unpaired');
      } catch {
        setSyncStatus('unpaired');
      }
      if (errorCode(err) === 'auth/popup-closed-by-user') {
        setSyncNotification('Connexion Google annulée');
      } else if (errorCode(err) === 'auth/cancelled-popup-request') {
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
    } catch (err) { console.warn('[cloudSync] Déconnexion Firebase échouée, purge locale poursuivie', err); }

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
  const currentNetworkStateRef = useRef<boolean>(true);
  const setNetworkState = useCallback(async (enabled: boolean) => {
    if (currentNetworkStateRef.current === enabled) return;
    currentNetworkStateRef.current = enabled;
    if (firebaseModulePromise) {
      try {
        const fb = await firebaseModulePromise;
        if (enabled) {
          await fb.enableNetwork(fb.db);
        } else {
          await fb.disableNetwork(fb.db);
        }
      } catch (err) { console.warn("[cloudSync] Changement d'état réseau Firestore échoué", err); }
    }
  }, []);

  // Déblocage forcé manuel de l'état de synchronisation
  const resetSyncState = useCallback(() => {
    isRemoteUpdatingRef.current = false;
    setSyncStatus('synced');
    setSyncErrorDetail(null);
    setSyncNotification('État de synchronisation débloqué');
  }, []);

  // Watchdog de sécurité anti-blocage : si un état 'syncing' persiste au-delà de 15s sans résolution
  useEffect(() => {
    if (syncStatus === 'syncing') {
      const watchdog = setTimeout(() => {
        console.warn('[cloudSync] Watchdog: synchronisation en cours depuis 15s sans retour réseau. Déblocage automatique.');
        setSyncStatus('synced');
        setSyncNotification('Synchronisation maintenue en local');
      }, 15000);
      return () => clearTimeout(watchdog);
    }
  }, [syncStatus]);

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
            // Si le compte local est configuré, Firebase peut être en train de rafraîchir le token en arrière-plan
            // ou de recharger la persistance depuis IndexedDB/localStorage. Ne pas déconnecter inopinément !
            const savedAccount = localStorage.getItem('physio_user_account');
            if (savedAccount) {
              console.log('[cloudSync] Session en cours de rétablissement (non-nullification préventive)');
              return;
            }
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

                  (async () => {
                    try {
                      const decompressed = typeof record.data === 'string' ? await decompressString(record.data) : record.data;
                      const parsed = typeof decompressed === 'string' ? JSON.parse(decompressed) : decompressed;
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
                  })();
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
              if (errorCode(error) === 'permission-denied' && fb.auth.currentUser) {
                console.log('[cloudSync] onSnapshot: permission-denied, tentative de renouvellement forcé du token...');
                refreshAuthToken(true);
              }
              setSyncStatus('error');
            }
          );
        };

        unsubAuth = fb.onIdTokenChanged(fb.auth, (user) => {
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

  // Rafraîchissement proactif du token d'authentification Google toutes les 25 minutes
  // (un token Google ID expire après 60min, ce renouvellement prévient les déconnexions inopinées)
  useEffect(() => {
    const timer = setInterval(() => {
      if (navigator.onLine && localStorage.getItem('physio_user_account')) {
        console.log('[cloudSync] Rafraîchissement préventif (intervalle 25 min) du token Google ID...');
        refreshAuthToken(true);
      }
    }, 25 * 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  // Rafraîchissement automatique au réveil de l'onglet ou retour au premier plan (focus)
  useEffect(() => {
    const handleWakeup = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && localStorage.getItem('physio_user_account')) {
        console.log('[cloudSync] Réveil de l\'application détecté, vérification du token Google ID...');
        refreshAuthToken(false);
      }
    };

    document.addEventListener('visibilitychange', handleWakeup);
    window.addEventListener('focus', handleWakeup);
    return () => {
      document.removeEventListener('visibilitychange', handleWakeup);
      window.removeEventListener('focus', handleWakeup);
    };
  }, []);

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
    quotaUsage,
    syncErrorDetail,
    confirmFirstPush,
    acceptFirstPush,
    rejectFirstPush,
    loginWithGoogle,
    logout,
    pushToCloud,
    triggerDebouncedPush,
    pullFromCloud,
    setNetworkState,
    resetSyncState,
  };
}
