/**
 * Fonctions mathématiques pures et filtres exponentiels physiologiques.
 */

export interface ExpDecayOptions {
  /**
   * Si true, null/undefined/0 décroît vers 0 (séances d'entraînement)
   */
  decayToZero?: boolean;
  /**
   * Valeur initiale de démarrage (ex: CTL initiale au jour -N)
   */
  initialValue?: number | null;
}

/**
 * Filtre à décroissance exponentielle continue selon le modèle de Banister / Coggan PMC.
 * α = 1 - e^(-1/τ)
 * 
 * Propriété physiologique clé :
 * Pour une impulsion initiale de 100 à t=0 suivie de charges nulles (0),
 * la valeur résiduelle à t = τ est exactement 100 * e^(-1) ≈ 36.79% (≈ 37%).
 * 
 * @param dataArray - Tableau chronologique des valeurs journalières
 * @param tau - Constante de temps τ en jours (ex: 7 pour ATL, 28-42 pour CTL, 3/7/21 pour filières)
 * @param options - Options de configuration (decayToZero, initialValue)
 * @returns Tableau des valeurs filtrées
 */
export function calculateExpDecay(
  dataArray: Array<number | null | undefined>,
  tau: number,
  options: ExpDecayOptions = {}
): number[] {
  const { decayToZero = false, initialValue = null } = options;
  if (!Array.isArray(dataArray) || dataArray.length === 0) return [];
  if (tau <= 0) return [...dataArray].map(v => Number(v) || 0);

  const alpha = 1 - Math.exp(-1 / tau);
  const result: number[] = [];
  let currentValue: number | null = initialValue;

  for (let i = 0; i < dataArray.length; i++) {
    const rawVal = dataArray[i];

    if (currentValue === null) {
      if (rawVal !== null && rawVal !== undefined) {
        currentValue = Number(rawVal);
      } else if (decayToZero) {
        currentValue = 0;
      }
    } else {
      let targetVal: number;
      if (rawVal !== null && rawVal !== undefined) {
        targetVal = Number(rawVal);
      } else if (decayToZero) {
        targetVal = 0;
      } else {
        // En l'absence de mesure (ex: VFC non renseignée), on conserve la valeur précédente
        targetVal = currentValue;
      }

      currentValue = (targetVal * alpha) + (currentValue * (1 - alpha));
    }

    result.push(currentValue !== null ? currentValue : 0);
  }

  return result;
}

/**
 * Calculateur EMA physiologique (rétrocompatible avec les appels calculateEMA existants).
 * Utilise la constante continue α = 1 - e^(-1/period) pour respecter
 * scrupuleusement la constante de temps Banister plutôt que la formule boursière 2/(N+1).
 */
export function calculateEMA(
  dataArray: Array<number | null | undefined>,
  period: number,
  decayToZero: boolean = false,
  initialValue: number | null = null
): number[] {
  return calculateExpDecay(dataArray, period, { decayToZero, initialValue });
}
