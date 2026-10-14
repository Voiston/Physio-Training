import { useState, useEffect } from 'react';

/**
 * Hook d'état persistant synchronisé avec localStorage.
 * Garantit la pureté des fonctions de mise à jour de state en isolant l'écriture
 * localStorage dans un useEffect (conformité React 19 / StrictMode).
 */
export function usePersistentState<T>(key: string, initialValue: T | (() => T)) {
  const [state, setState] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      if (item !== null) {
        return JSON.parse(item);
      }
    } catch (e) {
      console.warn(`Erreur de lecture localStorage pour ${key}:`, e);
    }
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.error(`Erreur d'écriture localStorage pour ${key}:`, e);
    }
  }, [key, state]);

  return [state, setState] as const;
}
