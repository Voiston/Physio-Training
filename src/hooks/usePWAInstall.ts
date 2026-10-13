import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * Détecte si l'appareil est un appareil iOS (iPhone, iPad, iPod).
 * Prend en compte iPadOS qui s'identifie avec un User-Agent "Macintosh"
 * mais dispose de points de contact tactiles multiples (maxTouchPoints > 1).
 */
export function detectIsIOS(
  uaOverride?: string,
  touchPointsOverride?: number,
  platformOverride?: string
): boolean {
  const ua = (
    uaOverride ?? (typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '')
  ).toLowerCase();

  if (!ua) return false;

  // iPhones, iPods, iPads classiques
  if (/iphone|ipad|ipod/.test(ua)) return true;

  const touchPoints =
    touchPointsOverride ??
    (typeof navigator !== 'undefined' && typeof navigator.maxTouchPoints === 'number'
      ? navigator.maxTouchPoints
      : 0);

  const platform =
    platformOverride ??
    (typeof navigator !== 'undefined' && (navigator as { platform?: string }).platform
      ? (navigator as { platform?: string }).platform
      : '');

  // iPadOS (Safari sur iPad envoie souvent un UA Macintosh de bureau)
  const isIPadOS =
    (ua.includes('macintosh') || platform === 'MacIntel') &&
    typeof touchPoints === 'number' &&
    touchPoints > 1;

  return Boolean(isIPadOS);
}

/**
 * Détecte si l'application s'exécute déjà en mode PWA autonome (Standalone).
 */
export function detectIsInstalled(standaloneOverride?: boolean): boolean {
  if (typeof standaloneOverride === 'boolean') return standaloneOverride;
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    (window.navigator as unknown as { standalone?: boolean })?.standalone === true
  );
}

// ---------------------------------------------------------------------------
// Store de module Singleton
// Capture unique de l'événement `beforeinstallprompt` dès le démarrage de l'app.
// Toutes les instances de usePWAInstall (ex: en-tête desktop, tiroir mobile monté ultérieurement)
// partagent exactement le même état et le même prompt différé.
// ---------------------------------------------------------------------------

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let isInstalledState = false;
let isInitialized = false;
const listeners = new Set<() => void>();

function notifySubscribers() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignorer les erreurs des abonnés détachés
    }
  });
}

/**
 * Initialise l'écoute globale de l'installation PWA.
 * Idéalement appelée au plus tôt dans main.tsx.
 */
export function initPWAInstall(): void {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  isInstalledState = detectIsInstalled();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    // Empêcher la bannière automatique par défaut du navigateur
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener('appinstalled', () => {
    isInstalledState = true;
    deferredPrompt = null;
    notifySubscribers();
  });

  try {
    const mql = window.matchMedia?.('(display-mode: standalone)');
    mql?.addEventListener?.('change', (e) => {
      if (e.matches) {
        isInstalledState = true;
        deferredPrompt = null;
        notifySubscribers();
      }
    });
  } catch {
    // Fallback pour les navigateurs ne supportant pas addEventListener sur MediaQueryList
  }
}

// Auto-initialisation au chargement du module si dans le navigateur
if (typeof window !== 'undefined') {
  initPWAInstall();
}

/**
 * Déclenche l'affichage du prompt d'installation natif du navigateur.
 */
export async function promptPWAInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      isInstalledState = true;
      deferredPrompt = null;
      notifySubscribers();
      return true;
    }
  } catch (err) {
    console.error('Erreur lors du prompt PWA :', err);
  }
  return false;
}

/**
 * Fournit l'état courant de l'installation PWA pour les composants React.
 */
export function getPWAInstallSnapshot() {
  return {
    isInstallable: !!deferredPrompt,
    isInstalled: isInstalledState || detectIsInstalled(),
    isIOS: detectIsIOS(),
  };
}

/**
 * Hook React pour consommer le store d'installation PWA.
 * Synchronisé en temps réel sur toutes les instances de l'application.
 */
export function usePWAInstall() {
  const [state, setState] = useState(() => getPWAInstallSnapshot());

  useEffect(() => {
    const update = () => {
      setState(getPWAInstallSnapshot());
    };

    listeners.add(update);
    // Rafraîchissement au montage
    update();

    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    isInstallable: state.isInstallable,
    isInstalled: state.isInstalled,
    isIOS: state.isIOS,
    install: promptPWAInstall,
  };
}
