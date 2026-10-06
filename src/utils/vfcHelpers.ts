/**
 * Analyse statistique de la Variabilité de Fréquence Cardiaque (VFC / HRV)
 * et de la Fréquence Cardiaque de repos selon la méthodologie scientifique
 * de référence (Plews et al., 2013; Buchheit, 2014).
 */

export interface VfcAnalysisResult {
  currentValue: number | null;
  dayStatus: 'optimal' | 'low' | 'high' | null;
  baseline7d: number | null;
  baseline60d: number | null;
  sd60d: number | null;
  swc: number | null; // Smallest Worthwhile Change = 0.5 * SD sur ln(rMSSD)
  cv7d: number | null; // Coefficient de variation 7j sur ln(rMSSD) (%)
  acuteCount7d: number;
  lnCurrent: number | null;
  lnBaseline7d: number | null;
  lnBaseline60d: number | null;
  lnSd60d: number | null;
  corridorLower: number | null;
  corridorUpper: number | null;
  status: 'optimal' | 'low' | 'high' | 'initializing';
  badge: string;
  color: 'emerald' | 'rose' | 'sky' | 'slate' | 'amber';
  interpretation: string;
  dataPointsCount: number;
}

export interface HrRestAnalysisResult {
  currentValue: number | null;
  median28d: number | null;
  deltaBpm: number | null;
  status: 'optimal' | 'elevated' | 'low' | 'initializing';
  badge: string;
  color: 'emerald' | 'rose' | 'sky' | 'slate';
  interpretation: string;
  dataPointsCount: number;
}

/**
 * Calcule les statistiques VFC avec bande de normalité (Smallest Worthwhile Change sur ln(rMSSD)).
 * Méthodologie scientifique : Plews et al. 2013, Buchheit 2014.
 * 
 * @param dailyMetrics - Objet Record<dateStr, { vfc?: number, hrRest?: number }>
 * @param referenceDateStr - Date de référence (défaut : aujourd'hui)
 * @param baselineWindowDays - Fenêtre d'historique de base (défaut : 60 jours)
 */
export function computeVfcAnalysis(
  dailyMetrics: Record<string, { vfc?: number; [key: string]: any }>,
  referenceDateStr: string | null = null,
  baselineWindowDays: number = 60
): VfcAnalysisResult {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const refTime = refDate.getTime();

  // Extraire les mesures valides des 60 derniers jours
  const allPastValues: { dateStr: string; val: number; lnVal: number; daysDiff: number }[] = [];
  const acute7dValues: number[] = [];
  const acute7dLnValues: number[] = [];
  let currentValue: number | null = null;

  Object.entries(dailyMetrics || {}).forEach(([dateStr, metrics]) => {
    if (!metrics || metrics.vfc === undefined || metrics.vfc === null || metrics.vfc <= 0) return;
    const itemDate = new Date(dateStr);
    const daysDiff = Math.round((refTime - itemDate.getTime()) / (1000 * 3600 * 24));

    if (daysDiff >= 0 && daysDiff <= baselineWindowDays) {
      const val = Number(metrics.vfc);
      const lnVal = Math.log(val);
      allPastValues.push({ dateStr, val, lnVal, daysDiff });

      if (daysDiff <= 7) {
        acute7dValues.push(val);
        acute7dLnValues.push(lnVal);
      }
      if (daysDiff === 0) {
        currentValue = val;
      }
    }
  });

  // Si aucune valeur aujourd'hui, prendre la dernière valeur réelle enregistrée
  if (currentValue === null && allPastValues.length > 0) {
    allPastValues.sort((a, b) => a.daysDiff - b.daysDiff);
    currentValue = allPastValues[0].val;
  }

  const n = allPastValues.length;

  // Moins de 7 mesures : phase d'étalonnage
  if (n < 7) {
    return {
      currentValue,
      dayStatus: null,
      baseline7d: acute7dValues.length > 0 ? Math.round(acute7dValues.reduce((a, b) => a + b, 0) / acute7dValues.length) : currentValue,
      baseline60d: null,
      sd60d: null,
      swc: null,
      cv7d: null,
      acuteCount7d: acute7dValues.length,
      lnCurrent: currentValue ? Math.round(Math.log(currentValue) * 100) / 100 : null,
      lnBaseline7d: null,
      lnBaseline60d: null,
      lnSd60d: null,
      corridorLower: null,
      corridorUpper: null,
      status: 'initializing',
      badge: '⏳ Étalonnage VFC',
      color: 'slate',
      interpretation: `Historique VFC en cours de constitution (${n}/7 mesures minimales requises, 14-20 pour étalonnage complet). La bande de normalité personnalisée sera active dès 7 mesures.`,
      dataPointsCount: n
    };
  }

  // RÈGLE MÉTHODOLOGIQUE DE PLEWS / BUCHHEIT :
  // Découplage de la base de référence et de la semaine évaluée pour éviter qu'une chute aiguë ne contamine la base
  // Si assez de recul (>14 mesures au total dont au moins 7 en période de base antérieure à J-7),
  // la base de référence exclut la semaine aiguë (J-0 à J-7)
  const priorBaselineValues = allPastValues.filter(v => v.daysDiff > 7);
  const baselineDataset = priorBaselineValues.length >= 7 ? priorBaselineValues : allPastValues;

  // Calcul sur les logarithmes naturels ln(rMSSD) pour corriger l'asymétrie de distribution
  const nBase = baselineDataset.length;
  const meanLn = baselineDataset.reduce((acc, v) => acc + v.lnVal, 0) / nBase;
  const varianceLn = baselineDataset.reduce((acc, v) => acc + Math.pow(v.lnVal - meanLn, 2), 0) / (nBase - 1 || 1);
  const sdLn = Math.sqrt(varianceLn);

  // SWC (Smallest Worthwhile Change) = 0.5 * SD(ln(rMSSD)) (Plews et al.)
  const swcLn = Math.max(0.04, 0.5 * sdLn);

  // Valeurs moyennes de base en ms et en ln
  const baseline60d = Math.round(Math.exp(meanLn) * 10) / 10;
  const corridorLower = Math.round(Math.exp(meanLn - swcLn) * 10) / 10;
  const corridorUpper = Math.round(Math.exp(meanLn + swcLn) * 10) / 10;

  // Moyenne glissante 7 jours en ln et en ms
  const meanAcuteLn = acute7dLnValues.length > 0
    ? acute7dLnValues.reduce((a, b) => a + b, 0) / acute7dLnValues.length
    : meanLn;
  const baseline7d = Math.round(Math.exp(meanAcuteLn) * 10) / 10;

  const sd60d = Math.round((corridorUpper - corridorLower) / 2 * 10) / 10;
  const swc = Math.round((corridorUpper - baseline60d) * 10) / 10;

  // Coefficient de variation aigu sur 7 jours (ln(rMSSD))
  let cv7d: number | null = null;
  if (acute7dLnValues.length >= 2 && meanAcuteLn > 0) {
    const acuteVarianceLn = acute7dLnValues.reduce((acc, v) => acc + Math.pow(v - meanAcuteLn, 2), 0) / (acute7dLnValues.length - 1);
    const acuteSdLn = Math.sqrt(acuteVarianceLn);
    cv7d = Math.round((acuteSdLn / meanAcuteLn) * 1000) / 10;
  }

  // Statut de la valeur du jour par rapport au couloir individuel
  const dayStatus: 'optimal' | 'low' | 'high' | null = currentValue !== null
    ? (currentValue < corridorLower ? 'low' : currentValue > corridorUpper ? 'high' : 'optimal')
    : null;

  // Évaluation du statut autonome
  if (baseline7d < corridorLower) {
    return {
      currentValue,
      dayStatus,
      baseline7d,
      baseline60d,
      sd60d,
      swc,
      cv7d,
      acuteCount7d: acute7dValues.length,
      lnCurrent: currentValue ? Math.round(Math.log(currentValue) * 100) / 100 : null,
      lnBaseline7d: Math.round(meanAcuteLn * 100) / 100,
      lnBaseline60d: Math.round(meanLn * 100) / 100,
      lnSd60d: Math.round(sdLn * 100) / 100,
      corridorLower,
      corridorUpper,
      status: 'low',
      badge: '⚠️ Baisse VFC (< SWC)',
      color: 'rose',
      interpretation: `Fléchissement parasympathique significatif. Votre moyenne 7 jours (${baseline7d} ms, ln: ${(meanAcuteLn).toFixed(2)}) est sous votre corridor de référence (${corridorLower}-${corridorUpper} ms). Fatigue systémique ou assimilation incomplète.`,
      dataPointsCount: n
    };
  }

  if (baseline7d > corridorUpper) {
    const isParasympatheticSaturation = cv7d !== null && cv7d < 3.0;
    return {
      currentValue,
      dayStatus,
      baseline7d,
      baseline60d,
      sd60d,
      swc,
      cv7d,
      acuteCount7d: acute7dValues.length,
      lnCurrent: currentValue ? Math.round(Math.log(currentValue) * 100) / 100 : null,
      lnBaseline7d: Math.round(meanAcuteLn * 100) / 100,
      lnBaseline60d: Math.round(meanLn * 100) / 100,
      lnSd60d: Math.round(sdLn * 100) / 100,
      corridorLower,
      corridorUpper,
      status: 'high',
      badge: isParasympatheticSaturation ? '⚠️ VFC Figée (Saturation)' : '⚡ VFC Élevée (> SWC)',
      color: isParasympatheticSaturation ? 'amber' : 'sky',
      interpretation: isParasympatheticSaturation
        ? `Hyperactivité parasympathique (${baseline7d} ms vs seuil haut ${corridorUpper} ms) avec variabilité très figée (CV: ${cv7d}% < 3%). Signal potentiel de saturation parasympathique consécutive à une fatigue accumulée. À corréler à vos sensations d'énergie.`
        : `Hyperactivité parasympathique (${baseline7d} ms vs seuil haut ${corridorUpper} ms). Excellente fraîcheur ou surcompensation consécutive à un cycle de charge bien absorbé.`,
      dataPointsCount: n
    };
  }

  return {
    currentValue,
    dayStatus,
    baseline7d,
    baseline60d,
    sd60d,
    swc,
    cv7d,
    acuteCount7d: acute7dValues.length,
    lnCurrent: currentValue ? Math.round(Math.log(currentValue) * 100) / 100 : null,
    lnBaseline7d: Math.round(meanAcuteLn * 100) / 100,
    lnBaseline60d: Math.round(meanLn * 100) / 100,
    lnSd60d: Math.round(sdLn * 100) / 100,
    corridorLower,
    corridorUpper,
    status: 'optimal',
    badge: '✅ VFC dans le Corridor',
    color: 'emerald',
    interpretation: `Tonus autonome équilibré. Votre moyenne 7 jours (${baseline7d} ms) s'inscrit parfaitement dans votre corridor de variabilité individuel (${corridorLower} à ${corridorUpper} ms).`,
    dataPointsCount: n
  };
}

/**
 * Calcule l'analyse de la Fréquence Cardiaque de Repos relative à la médiane personnelle.
 * 
 * @param dailyMetrics - Objet Record<dateStr, { hrRest?: number, [key: string]: any }>
 * @param referenceDateStr - Date de référence
 */
export function computeHrRestAnalysis(
  dailyMetrics: Record<string, { hrRest?: number; [key: string]: any }>,
  referenceDateStr: string | null = null
): HrRestAnalysisResult {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const refTime = refDate.getTime();

  const values28d: number[] = [];
  let currentValue: number | null = null;

  Object.entries(dailyMetrics || {}).forEach(([dateStr, metrics]) => {
    if (!metrics || metrics.hrRest === undefined || metrics.hrRest === null || metrics.hrRest <= 0) return;
    const itemDate = new Date(dateStr);
    const daysDiff = Math.round((refTime - itemDate.getTime()) / (1000 * 3600 * 24));

    if (daysDiff >= 0 && daysDiff <= 28) {
      values28d.push(Number(metrics.hrRest));
      if (daysDiff === 0) {
        currentValue = Number(metrics.hrRest);
      }
    }
  });

  const n = values28d.length;

  if (n < 7) {
    return {
      currentValue,
      median28d: null,
      deltaBpm: null,
      status: 'initializing',
      badge: '⏳ Étalonnage FC Repos',
      color: 'slate',
      interpretation: `Historique en cours (${n}/7 jours). Les alertes d'élévation cardiaque s'activeront dès 7 mesures.`,
      dataPointsCount: n
    };
  }

  // Calcul de la médiane sur 28 jours
  values28d.sort((a, b) => a - b);
  const mid = Math.floor(values28d.length / 2);
  const median28d = values28d.length % 2 !== 0 
    ? values28d[mid] 
    : Math.round((values28d[mid - 1] + values28d[mid]) / 2);

  // Si la mesure du jour n'a pas été saisie, renvoyer la baseline existante plutôt qu'un faux état d'étalonnage
  if (currentValue === null) {
    return {
      currentValue: null,
      median28d,
      deltaBpm: null,
      status: 'optimal',
      badge: `Médiane : ${median28d} bpm`,
      color: 'slate',
      interpretation: `FC de repos non saisie ce matin. Votre médiane de référence sur 28 jours est de ${median28d} bpm (${n} mesures disponibles).`,
      dataPointsCount: n
    };
  }

  const deltaBpm = currentValue - median28d;

  if (deltaBpm >= 5) {
    return {
      currentValue,
      median28d,
      deltaBpm,
      status: 'elevated',
      badge: `⚠️ FC Repos Élevée (+${deltaBpm} bpm)`,
      color: 'rose',
      interpretation: `Votre FC de repos du jour (${currentValue} bpm) est supérieure de ${deltaBpm} bpm à votre médiane habituelle (${median28d} bpm). Signe potentiel de fatigue résiduelle, déshydratation ou infection débutante.`,
      dataPointsCount: n
    };
  }

  if (deltaBpm <= -5) {
    return {
      currentValue,
      median28d,
      deltaBpm,
      status: 'low',
      badge: `🍃 FC Repos Basse (${deltaBpm} bpm)`,
      color: 'sky',
      interpretation: `FC de repos particulièrement basse (${currentValue} bpm vs médiane ${median28d} bpm). Excellente récupération parasympathique.`,
      dataPointsCount: n
    };
  }

  return {
    currentValue,
    median28d,
    deltaBpm,
    status: 'optimal',
    badge: `✅ FC Repos Normale (${currentValue} bpm)`,
    color: 'emerald',
    interpretation: `FC de repos stable (${currentValue} bpm), alignée avec votre ligne de base médiane (${median28d} bpm).`,
    dataPointsCount: n
  };
}
