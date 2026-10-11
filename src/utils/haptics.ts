/**
 * Utilitaire Haptique (Vibration API - navigator.vibrate)
 * Offre un retour physique sur smartphone pour les interactions tactiles critiques :
 * - Validation de séance ou de série
 * - Bascule de modes (Mode Salle, onglets, mode simulation)
 * - Suppression ou alerte
 */

export function isVibrationSupported(): boolean {
  return typeof window !== 'undefined' && 
    typeof navigator !== 'undefined' && 
    typeof navigator.vibrate === 'function';
}

/**
 * Déclenche une vibration de manière sécurisée (avec try/catch silencieux
 * pour éviter les exceptions si le navigateur bloque l'API ou n'a pas les permissions).
 */
export function triggerHaptic(pattern: number | number[] = 20): boolean {
  if (!isVibrationSupported()) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

/**
 * Raccourcis sémantiques pour une expérience haptique cohérente
 */
export const haptics = {
  /** Léger retour tactile au tapotement d'un onglet ou bouton (15ms) */
  tap: () => triggerHaptic(15),

  /** Bascule de mode : Mode Salle, onglet principal, grille/athlète, simulation what-if */
  modeSwitch: () => triggerHaptic([25, 30, 35]),

  /** Validation de séance (sauvegarde d'une séance dans la modale ou fin de série) */
  validate: () => triggerHaptic([35, 40, 65]),

  /** Clôture complète d'une séance d'entraînement en mode salle (célébration) */
  success: () => triggerHaptic([60, 50, 100, 50, 180]),

  /** Avertissement ou suppression (ex: effacer une séance, abandonner un entraînement) */
  warning: () => triggerHaptic([50, 60, 50]),
};

export default haptics;
