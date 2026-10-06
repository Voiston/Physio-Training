/**
 * Module centralisé de gestion des zones physiologiques d'entraînement.
 * Harmonise les seuils TSB exprimés en % de la condition chronique (CTL),
 * éliminant les seuils absolus arbitraires incompatibles entre athlètes de différents volumes.
 */

export interface TsbZoneInfo {
  zoneId: 'INITIALIZING' | 'CRITICAL_FATIGUE' | 'OPTIMAL_OVERLOAD' | 'NEUTRAL_MAINTENANCE' | 'PEAK_TAPERING' | 'DETRAINING_RISK';
  tsb: number;
  ctl: number;
  atl: number;
  tsbPercent: number | null; // % de la CTL : ((CTL - ATL) / CTL) * 100
  title: string;
  badge: string;
  color: 'slate' | 'rose' | 'amber' | 'emerald' | 'sky';
  status: 'neutral' | 'danger' | 'warning' | 'building' | 'optimal' | 'recovery';
  summary: string;
  advice: string;
  prescription: string;
  isReliable: boolean; // faux si CTL < 10 UA (démarrage à froid)
}

/**
 * Calcule le TSB relatif en pourcentage de la CTL.
 * @param ctl Condition chronique (Fitness)
 * @param atl Fatigue aiguë
 * @returns Pourcentage (ex: -18.5 pour -18.5%), ou null si CTL négligeable
 */
export function calculateTsbPercent(ctl: number, atl: number): number | null {
  if (ctl <= 3) return null;
  const tsb = ctl - atl;
  return Math.round((tsb / ctl) * 1000) / 10;
}

/**
 * Évalue la zone TSB en pourcentage de la condition de fond (CTL).
 * 
 * Seuils calibrés :
 * - < -35% : Surcharge aiguë sévère (danger de surmenage)
 * - [-35%, -10%] : Surcharge fonctionnelle stimulante (développement optimal)
 * - [-10%, +5%] : Zone neutre / Consolidation
 * - ]+5%, +25%] : Zone d'affûtage idéale pour compétition (fraîcheur maximale)
 * - > +25% : Sur-fraîcheur prolongée (début de désentraînement si > 7j)
 */
export function getTsbZone(
  ctl: number, 
  atl: number, 
  historyDays: number = 30,
  tauFitness: number = 28,
  hasInitialCtl: boolean = false
): TsbZoneInfo {
  const tsb = Math.round((ctl - atl) * 10) / 10;
  const tsbPercent = calculateTsbPercent(ctl, atl);

  // Convergence mathématique du filtre CTL : requiert 3 * tauFitness (ex: 84j pour tau=28, 126j pour tau=42)
  // pour garantir > 95% de convergence et éliminer tout biais d'accélération artificielle.
  // Si un CTL initial a été calibré par l'athlète, la neutralisation est levée immédiatement.
  const minRequiredDays = hasInitialCtl ? 0 : Math.round(tauFitness * 3);
  if ((!hasInitialCtl && historyDays < minRequiredDays) || ctl < 10 || tsbPercent === null) {
    return {
      zoneId: 'INITIALIZING',
      tsb,
      ctl,
      atl,
      tsbPercent: null,
      title: 'CTL en Phase de Convergence',
      badge: hasInitialCtl ? '⏳ Initialisation' : `⏳ Étalonnage CTL (${historyDays}/${minRequiredDays} j)`,
      color: 'slate',
      status: 'neutral',
      summary: `Historique de charge en phase de convergence (${historyDays}/${minRequiredDays} jours requis, CTL actuelle: ${Math.round(ctl)} UA). Le modèle PMC requiert 3 constantes de temps (3τ = ${minRequiredDays} j) pour stabiliser mathématiquement la condition de fond sans biais de démarrage à froid. Les ratios relatifs sont neutralisés pendant cette phase pour prévenir tout faux positif.`,
      advice: 'Entraînez-vous selon vos sensations RPE habituelles pendant la phase de calibration.',
      prescription: 'Maintenir une régularité sans chercher à interpréter les ratios de fraîcheur.',
      isReliable: false
    };
  }

  // 1. Surcharge Critique (TSB% < -35%)
  if (tsbPercent < -35) {
    return {
      zoneId: 'CRITICAL_FATIGUE',
      tsb,
      ctl,
      atl,
      tsbPercent,
      title: 'Fatigue Aiguë Élevée (Surcharge Critique)',
      badge: `🚨 Surcharge Forte (${tsbPercent}%)`,
      color: 'rose',
      status: 'danger',
      summary: `Déficit de fraîcheur marqué (TSB : ${tsb > 0 ? `+${tsb}` : tsb}, soit ${tsbPercent}% de votre CTL). La fatigue aiguë (${atl} UA) dépasse très largement votre capacité de charge chronique (${ctl} UA).`,
      advice: 'Fatigue aiguë importante par rapport à votre condition de fond. Privilégiez 24 à 48h de régénération active ou repos pour assimiler ce bloc.',
      prescription: 'Séance d\'endurance fondamentale légère (RPE 3-4) ou récupération complète.',
      isReliable: true
    };
  }

  // 2. Surcharge Stimulante / Développement (-35% <= TSB% < -10%)
  if (tsbPercent < -10) {
    return {
      zoneId: 'OPTIMAL_OVERLOAD',
      tsb,
      ctl,
      atl,
      tsbPercent,
      title: 'Surcharge Fonctionnelle (Développement)',
      badge: `⚡ Surcharge Stimulante (${tsbPercent}%)`,
      color: 'emerald',
      status: 'building',
      summary: `Stimulus d'entraînement efficace bien proportionné (TSB : ${tsb}, ${tsbPercent}% de la CTL). L'accumulation de fatigue (${atl} UA) génère les adaptations nécessaires au développement de votre condition physique.`,
      advice: 'Parfaite zone de travail pour un bloc de développement. Assurez-vous d\'une bonne nutrition et d\'un sommeil de qualité.',
      prescription: 'Poursuivez les séances qualitatives du bloc actif en surveillant la VFC matinale.',
      isReliable: true
    };
  }

  // 3. Zone d'Équilibre / Neutre (-10% <= TSB% <= +5%)
  if (tsbPercent <= 5) {
    return {
      zoneId: 'NEUTRAL_MAINTENANCE',
      tsb,
      ctl,
      atl,
      tsbPercent,
      title: 'Zone d\'Équilibre (Entretien)',
      badge: `⚖️ Équilibre (${tsbPercent > 0 ? `+${tsbPercent}` : tsbPercent}%)`,
      color: 'slate',
      status: 'neutral',
      summary: `Équilibre stable entre charge récente (${atl} UA) et condition chronique (${ctl} UA). TSB proche de l'équilibre (${tsb > 0 ? `+${tsb}` : tsb}).`,
      advice: 'Condition stabilisée. Propice aux séances techniques ou à la transition entre cycles de développement.',
      prescription: 'Séances à intensité spécifique ou maintien sans fatigue excessive.',
      isReliable: true
    };
  }

  // 4. Zone d'Affûtage / Compétition (+5% < TSB% <= +25%)
  if (tsbPercent <= 25) {
    return {
      zoneId: 'PEAK_TAPERING',
      tsb,
      ctl,
      atl,
      tsbPercent,
      title: 'Zone d\'Affûtage (Pic de Forme)',
      badge: `🎯 Fraîcheur Optimale (+${tsbPercent}%)`,
      color: 'amber',
      status: 'optimal',
      summary: `Excellente fraîcheur neuromusculaire (TSB : +${tsb}, +${tsbPercent}% de la CTL) tout en préservant l'essentiel de votre condition de fond (${ctl} UA).`,
      advice: 'Fenêtre idéale pour un objectif ou une compétition majeure. Réduction optimale de la fatigue sans perte d\'adaptations.',
      prescription: 'Rappels brefs d\'allure spécifique ou de puissance (déblocage), volume très allégé.',
      isReliable: true
    };
  }

  // 5. Sur-Fraîcheur / Risque de désentraînement (> +25%)
  return {
    zoneId: 'DETRAINING_RISK',
    tsb,
    ctl,
    atl,
    tsbPercent,
    title: 'Sur-Fraîcheur (Risque de Désentraînement)',
    badge: `📉 Sur-Affûtage (+${tsbPercent}%)`,
    color: 'sky',
    status: 'recovery',
    summary: `Fraîcheur très élevée (TSB : +${tsb}, +${tsbPercent}% de la CTL). Si cette période de repos se prolonge au-delà de 7 à 10 jours, votre condition de fond (${ctl} UA) commencera à s'éroder.`,
    advice: 'Si vous n\'êtes pas en veille de compétition majeure, prévoyez une réactivation progressive de la charge.',
    prescription: 'Réintroduire une séance de rappel d\'intensité modérée pour réenclencher la dynamique.',
    isReliable: true
  };
}
