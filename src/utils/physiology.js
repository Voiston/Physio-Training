import { calculateEMA, calculateExpDecay } from './mathHelpers';
import { getLocalYYYYMMDD } from './dateHelpers';
import { getDailyAthleteLoad, isPrimary, extractSessionLoad as loadExtract } from './loadHelpers';
import { getTsbZone, calculateTsbPercent } from './zones';

export const DEFAULT_QUALITIES = [
  { id: 'vo2max', name: 'VO2max', g: 7, o: 4, retentionDays: 15, category: 'cardio', impacts: [{ id: 'seuil', ratio: 0.6, confidence: 'sourcé' }, { id: 'ef', ratio: 0.4, confidence: 'sourcé' }, { id: 'leg', ratio: 0.3, confidence: 'estimé' }, { id: 'co2', ratio: 0.4, confidence: 'estimé' }, { id: 'plyo', ratio: 0.3, confidence: 'estimé' }] },
  { id: 'seuil', name: 'Seuil', g: 8, o: 5, retentionDays: 18, category: 'cardio', impacts: [{ id: 'vo2max', ratio: 0.3, confidence: 'sourcé' }, { id: 'ef', ratio: 0.4, confidence: 'sourcé' }, { id: 'leg', ratio: 0.3, confidence: 'estimé' }, { id: 'co2', ratio: 0.3, confidence: 'estimé' }, { id: 'plyo', ratio: 0.2, confidence: 'estimé' }] },
  { id: 'ef', name: 'Endurance Fondamentale', g: 10, o: 6, retentionDays: 30, category: 'cardio', impacts: [{ id: 'leg', ratio: 0.2, confidence: 'estimé' }, { id: 'co2', ratio: 0.2, confidence: 'estimé' }] },
  { id: 'sprint', name: 'Sprint / Alactique', g: 5, o: 3, retentionDays: 5, category: 'mixte', impacts: [{ id: 'seuil', ratio: 0.2, confidence: 'estimé' }, { id: 'vo2max', ratio: 0.25, confidence: 'estimé' }, { id: 'ef', ratio: 0.15, confidence: 'estimé' }, { id: 'leg', ratio: 0.7, confidence: 'sourcé' }, { id: 'plyo', ratio: 0.7, confidence: 'sourcé' }, { id: 'co2', ratio: 0.4, confidence: 'estimé' }] },
  { id: 'pull', name: 'Musculation Pull', g: 8, o: 5, retentionDays: 30, category: 'force' },
  { id: 'push', name: 'Musculation Push', g: 8, o: 5, retentionDays: 30, category: 'force' },
  { id: 'leg', name: 'Musculation Leg', g: 8, o: 5, retentionDays: 30, category: 'force', impacts: [{ id: 'plyo', ratio: 0.3, confidence: 'sourcé' }, { id: 'sprint', ratio: 0.2, confidence: 'sourcé' }] },
  { id: 'plyo', name: 'Plyométrie', g: 5, o: 3, retentionDays: 5, category: 'force', impacts: [{ id: 'leg', ratio: 0.4, confidence: 'sourcé' }, { id: 'sprint', ratio: 0.2, confidence: 'sourcé' }] },
  { id: 'co2', name: 'Tolérance CO2', g: 6, o: 4, retentionDays: 10, category: 'cardio' },
  { id: 'abdos', name: 'Protocole Abdos', g: 7, o: 4, retentionDays: 7, category: 'force' },
  { id: 'gut', name: 'Gut Training', g: 14, o: 7, retentionDays: 14, category: 'cardio' },
  { id: 'descente', name: 'Excentrique Descente', g: 16, o: 10, retentionDays: 21, category: 'force', impacts: [{ id: 'leg', ratio: 0.8, confidence: 'sourcé' }] },
  { id: 'proprio', name: 'Proprioception', g: 5, o: 3, retentionDays: 7, category: 'force' }
];

export const SPORT_IMPACTS = {
  vo2max: {
    run: [
      { id: 'seuil', ratio: 0.6 },
      { id: 'ef', ratio: 0.4 },
      { id: 'leg', ratio: 0.4 },
      { id: 'co2', ratio: 0.4 },
      { id: 'plyo', ratio: 0.4 }
    ],
    bike: [
      { id: 'seuil', ratio: 0.55 },
      { id: 'ef', ratio: 0.4 },
      { id: 'leg', ratio: 0.3 },
      { id: 'co2', ratio: 0.35 }
    ]
  },
  seuil: {
    run: [
      { id: 'vo2max', ratio: 0.3 },
      { id: 'ef', ratio: 0.4 },
      { id: 'leg', ratio: 0.3 },
      { id: 'co2', ratio: 0.3 },
      { id: 'plyo', ratio: 0.2 }
    ],
    bike: [
      { id: 'ef', ratio: 0.4 },
      { id: 'vo2max', ratio: 0.25 },
      { id: 'leg', ratio: 0.25 },
      { id: 'co2', ratio: 0.25 }
    ]
  },
  ef: {
    run: [
      { id: 'leg', ratio: 0.2 },
      { id: 'co2', ratio: 0.2 }
    ],
    bike: [
      { id: 'leg', ratio: 0.15 },
      { id: 'co2', ratio: 0.15 },
      { id: 'gut', ratio: 0.15 }
    ]
  },
  sprint: {
    run: [
      { id: 'leg', ratio: 0.8 },
      { id: 'plyo', ratio: 0.8 },
      { id: 'co2', ratio: 0.6 },
      { id: 'seuil', ratio: 0.3 },
      { id: 'vo2max', ratio: 0.4 },
      { id: 'ef', ratio: 0.2 }
    ],
    bike: [
      { id: 'leg', ratio: 0.65 },
      { id: 'co2', ratio: 0.45 },
      { id: 'seuil', ratio: 0.2 },
      { id: 'vo2max', ratio: 0.25 }
    ]
  }
};

export function getQualityImpacts(qualityId, sport = 'run', qualities = DEFAULT_QUALITIES) {
  if (SPORT_IMPACTS[qualityId]) {
    const sportKey = sport === 'bike' ? 'bike' : 'run';
    return SPORT_IMPACTS[qualityId][sportKey] || [];
  }
  const found = qualities.find(q => q.id === qualityId);
  return found?.impacts || [];
}

export const BLOCK_PRESETS = [
  {
    id: 'force_max',
    name: 'Force max',
    durationWeeks: 4,
    focusQualities: ['pull', 'push', 'leg', 'abdos', 'descente'],
    description: 'Renforcement musculaire intensif en fréquence de développement (x0.45, 2-3x/sem). Délais nominaux pour les autres qualités.',
    targetMultiplier: 0.45, // g et o réduits de 55% -> incite à répéter 2 à 3 fois par semaine
    maintenanceMultiplier: 1.0, // autres qualités bénéficient du délai nominal plein (maintien)
    color: '#ef4444',
    badge: '🏋️ Force'
  },
  {
    id: 'endurance_force',
    name: 'Endurance de force',
    durationWeeks: 4,
    focusQualities: ['leg', 'pull', 'push', 'abdos', 'plyo'],
    description: 'Répétition fréquente des séances de résistance musculaire (x0.45). Les autres qualités sont maintenues en délai nominal.',
    targetMultiplier: 0.45,
    maintenanceMultiplier: 1.0,
    color: '#f97316',
    badge: '⚡ Endur. Force'
  },
  {
    id: 'aerobie',
    name: 'Aérobie',
    durationWeeks: 6,
    focusQualities: ['ef', 'gut', 'co2'],
    description: 'Développement du volume foncier et des capacités métaboliques (x0.45). Renforcement musculaire espacé en maintien.',
    targetMultiplier: 0.45,
    maintenanceMultiplier: 1.0,
    color: '#06b6d4',
    badge: '🫁 Aérobie'
  },
  {
    id: 'seuil_vma',
    name: 'Seuil / VMA',
    durationWeeks: 3,
    focusQualities: ['seuil', 'vo2max', 'sprint'],
    description: 'Forte sollicitation cardio-vasculaire à haute intensité (x0.45). Renforcement musculaire maintenu en délai nominal.',
    targetMultiplier: 0.45,
    maintenanceMultiplier: 1.0,
    color: '#8b5cf6',
    badge: '🔥 Seuil/VMA'
  },
  {
    id: 'explosivite_plyo',
    name: 'Explosivité / Plyométrie',
    durationWeeks: 3,
    focusQualities: ['plyo', 'sprint', 'leg'],
    description: 'Vitesse de contraction, cycle étirement-détente et puissance des membres inférieurs (x0.45).',
    targetMultiplier: 0.45,
    maintenanceMultiplier: 1.0,
    color: '#ec4899',
    badge: '💥 Plyo/Vitesse'
  }
];

export function computeBlockEndDate(startDateStr, durationWeeks) {
  const [y, m, d] = startDateStr.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const totalDays = durationWeeks * 7 - 1;
  const end = new Date(start);
  end.setDate(start.getDate() + totalDays);
  return getLocalYYYYMMDD(end);
}

export function getActiveBlockForDate(dateStr, blocks = []) {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) return null;
  return blocks.find(b => {
    if (!b || !b.startDate || !b.endDate) return false;
    return dateStr >= b.startDate && dateStr <= b.endDate;
  }) || null;
}

export function getBlockProgress(block, referenceDateStr) {
  if (!block || !block.startDate || !block.endDate) return null;
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const [sy, sm, sd] = block.startDate.split('-').map(Number);
  const [ey, em, ed] = block.endDate.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  const totalMs = end.getTime() - start.getTime();
  const totalDays = Math.round(totalMs / (1000 * 3600 * 24)) + 1;
  const elapsedMs = refDate.getTime() - start.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 3600 * 24)) + 1;

  const currentDay = Math.max(1, Math.min(totalDays, elapsedDays));
  const currentWeek = Math.max(1, Math.min(block.durationWeeks, Math.ceil(currentDay / 7)));
  const remainingDays = Math.max(0, totalDays - currentDay);
  const percent = Math.max(0, Math.min(100, Math.round((currentDay / totalDays) * 100)));

  const isActive = elapsedDays >= 1 && elapsedDays <= totalDays;
  const isUpcoming = elapsedDays < 1;
  const isPast = elapsedDays > totalDays;

  return {
    currentDay,
    totalDays,
    currentWeek,
    totalWeeks: block.durationWeeks,
    remainingDays,
    percent,
    isActive,
    isUpcoming,
    isPast
  };
}

export function getSavedBlockTemplates() {
  try {
    const raw = localStorage.getItem('physio_block_templates');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Upgrade legacy multipliers if present (0.75 -> 0.45, 1.35 -> 1.0)
        return parsed.map(t => ({
          ...t,
          targetMultiplier: t.targetMultiplier === 0.75 ? 0.45 : (t.targetMultiplier ?? 0.45),
          maintenanceMultiplier: t.maintenanceMultiplier === 1.35 ? 1.0 : (t.maintenanceMultiplier ?? 1.0)
        }));
      }
    }
  } catch (e) {}
  return BLOCK_PRESETS;
}

export function saveBlockTemplates(templates) {
  try {
    localStorage.setItem('physio_block_templates', JSON.stringify(templates));
  } catch (e) {}
}

export function reorderQualitiesForBlock(qualities, focusQualities = []) {
  if (!focusQualities || focusQualities.length === 0) return qualities;
  const focused = [];
  const remaining = [];

  focusQualities.forEach(id => {
    const found = qualities.find(q => q.id === id);
    if (found) focused.push(found);
  });

  qualities.forEach(q => {
    if (!focusQualities.includes(q.id)) {
      remaining.push(q);
    }
  });

  return [...focused, ...remaining];
}

export function getTrainingRecommendations(qualities, events, dailyMetrics, activeBlock = null, referenceDateStr = null) {
  const refDate = referenceDateStr || getLocalYYYYMMDD(new Date());
  const readiness = dailyMetrics?.[refDate]?.readiness || 7;
  const numQualities = qualities.length || 1;

  const HARD_QUALITIES = new Set(['vo2max', 'seuil', 'sprint', 'pull', 'push', 'leg', 'plyo', 'descente']);

  // Détection de séance intense réalisée la veille (J-1) ou le jour même (J-0) pour alternance physiologique (D3)
  const refDateObj = new Date(refDate);
  const yesterdayObj = new Date(refDateObj);
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = getLocalYYYYMMDD(yesterdayObj);

  let recentHardSessionDone = false;
  Object.entries(events || {}).forEach(([qId, dates]) => {
    if (dates?.[yesterdayStr] && isPrimary(dates[yesterdayStr]) && HARD_QUALITIES.has(qId) && extractSessionLoad(dates[yesterdayStr]) > 150) {
      recentHardSessionDone = true;
    }
    if (dates?.[refDate] && isPrimary(dates[refDate]) && HARD_QUALITIES.has(qId) && extractSessionLoad(dates[refDate]) > 150) {
      recentHardSessionDone = true;
    }
  });

  const list = qualities.map((q, idx) => {
    const rank = idx + 1; // 1 = le plus prioritaire
    const rankWeight = 1 + ((numQualities - idx) / numQualities) * 1.5;

    const isBlockFocus = Boolean(activeBlock?.focusQualities?.includes(q.id));
    const blockWeight = isBlockFocus ? 1.6 : 1.0;
    const isHardQuality = HARD_QUALITIES.has(q.id);

    const cellState = computeCellState(q, refDate, events?.[q.id] || {}, readiness, activeBlock ? [activeBlock] : []);

    // Trouver la dernière date de séance
    const qualityEvents = events?.[q.id] || {};
    const sessionDates = Object.keys(qualityEvents)
      .filter(d => d <= refDate && qualityEvents[d])
      .sort();
    
    let daysSinceLastSession = null;
    let lastSessionData = null;
    if (sessionDates.length > 0) {
      const lastDate = sessionDates[sessionDates.length - 1];
      lastSessionData = qualityEvents[lastDate];
      const diffMs = new Date(refDate).getTime() - new Date(lastDate).getTime();
      daysSinceLastSession = Math.max(0, Math.round(diffMs / (1000 * 3600 * 24)));
    }

    // Calcul du score d'urgence et de pertinence
    let urgencyScore = 0;
    let urgencyLevel = 'OPTIMAL'; // CRITICAL, HIGH, MEDIUM, LOW, OPTIMAL, REST, NEVER
    let urgencyBadge = '✅ Maintenu';
    let urgencyColor = 'emerald';
    let reason = '';
    let actionTip = '';

    if (cellState.isBurnout || cellState.isAcuteFatigueHigh) {
      urgencyLevel = 'REST';
      urgencyScore = -50;
      urgencyBadge = '🛑 Surcharge Aiguë (SNC)';
      urgencyColor = 'rose';
      reason = 'Charge accumulée élevée sur 72h. Fatigue neuromusculaire aiguë.';
      actionTip = 'Privilégier le repos complet ou la régénération active très douce.';
    } else if (daysSinceLastSession === null) {
      // Qualité jamais renseignée / non stimulée
      if (isBlockFocus) {
        urgencyLevel = 'MEDIUM';
        urgencyScore = 60 * rankWeight * blockWeight;
        urgencyBadge = '⚡ Focus Bloc';
        urgencyColor = 'blue';
        reason = `Qualité prioritaire du bloc actif « ${activeBlock.name} », sans séance enregistrée.`;
        actionTip = 'Programmer une première séance pour amorcer le bloc.';
      } else {
        urgencyLevel = 'LOW';
        urgencyScore = 15 * rankWeight;
        urgencyBadge = 'ℹ️ Non stimulée';
        urgencyColor = 'slate';
        reason = 'Aucune séance enregistrée pour cette filière à ce jour.';
        actionTip = 'Optionnel selon vos objectifs de saison.';
      }
    } else if (cellState.status === 'red') {
      const deconditionFactor = Math.min(daysSinceLastSession, 21);
      const baseScore = 75 + deconditionFactor * 1.5;
      urgencyScore = baseScore * rankWeight * blockWeight;

      if (rank <= 3 || isBlockFocus) {
        urgencyLevel = 'CRITICAL';
        urgencyBadge = '🚨 Rappel Recommandé';
        urgencyColor = 'red';
        reason = `Fenêtre de rémanence expirée (${daysSinceLastSession} j sans séance). Rang #${rank} dans votre profil${isBlockFocus ? ' • Focus du bloc actif' : ''}.`;
        actionTip = 'Séance clé à programmer sous 24-48h pour stimuler à nouveau cette filière.';
      } else {
        urgencyLevel = 'HIGH';
        urgencyBadge = '⚠️ Rétention Basse';
        urgencyColor = 'orange';
        reason = `Effet résiduel dissipé (${daysSinceLastSession} j depuis la dernière séance).`;
        actionTip = 'À stimuler prochainement pour entretenir la rémanence.';
      }
    } else if (cellState.status === 'orange') {
      const daysLeft = cellState.daysLeft || 1;
      const baseScore = 65 + (5 - Math.min(daysLeft, 5)) * 4;
      urgencyScore = baseScore * rankWeight * blockWeight;

      if (daysLeft <= 1.2) {
        urgencyLevel = 'HIGH';
        urgencyBadge = '⚡ Rappel sous 24h';
        urgencyColor = 'amber';
        reason = `Fenêtre de rappel critique : expire dans ${daysLeft} j avant bascule en désentraînement.`;
        actionTip = 'Séance de rappel recommandée sans tarder.';
      } else {
        urgencyLevel = 'MEDIUM';
        urgencyBadge = '⏳ Rappel actif';
        urgencyColor = 'yellow';
        reason = `En fenêtre de rappel optimale (reste ${daysLeft} j d'effet résiduel).`;
        actionTip = 'Séance de rappel idéale à caler dans les 24-48 heures.';
      }
    } else {
      // Vert
      const daysLeft = cellState.daysLeft || 1;
      urgencyScore = Math.max(5, (25 - daysLeft) * rankWeight);

      if (daysLeft <= 1.5) {
        urgencyLevel = 'LOW';
        urgencyBadge = '🟢 À surveiller';
        urgencyColor = 'blue';
        reason = `Effet actif encore valide (reste ${daysLeft} j avant fenêtre de rappel).`;
        actionTip = 'Qualité sous contrôle pour l’instant.';
      } else {
        urgencyLevel = 'OPTIMAL';
        urgencyBadge = '✅ Consolidé';
        urgencyColor = 'emerald';
        reason = `Effet résiduel solide (reste ${daysLeft} j de protection active).`;
        actionTip = 'Aucune séance requise pour cette qualité.';
      }
    }

    // Modulation d'alternance des contraintes (D3) : si séance intense récente et filière HARD
    if (recentHardSessionDone && isHardQuality && urgencyScore > 0) {
      urgencyScore = Math.round(urgencyScore * 0.55);
      if (urgencyLevel === 'CRITICAL') urgencyLevel = 'HIGH';
      else if (urgencyLevel === 'HIGH') urgencyLevel = 'MEDIUM';
      reason += ' • [Vigilance alternance : séance intense récente, priorité à la régénération active]';
    } else if (recentHardSessionDone && !isHardQuality && urgencyScore > 0) {
      // Filière aérobie légère ou proprioception favorisée après un jour dur
      urgencyScore = Math.round(urgencyScore * 1.25);
    }

    return {
      quality: q,
      rank,
      isBlockFocus,
      isHardQuality,
      cellState,
      daysSinceLastSession,
      lastSessionData,
      urgencyScore: Math.round(urgencyScore * 10) / 10,
      urgencyLevel,
      urgencyBadge,
      urgencyColor,
      reason,
      actionTip
    };
  });

  return list.sort((a, b) => b.urgencyScore - a.urgencyScore);
}

export function extractSessionLoad(data) {
  if (data === null || data === undefined) return 0;
  if (typeof data === 'number') return data * 5;
  if (typeof data === 'object') {
    if (typeof data.load === 'number') return data.load;
    const duration = Number(data.duration) || 0;
    const rpeM = Number(data.rpeMusculaire ?? data.rpeMusc ?? 5);
    const rpeC = Number(data.rpeCardio ?? 5);
    // Supprimer le multiplicateur fatMod : la fatigue perçue est un marqueur de réponse, pas de stimulus (C3)
    return Math.round(((rpeM + rpeC) / 2) * duration);
  }
  const parsed = Number(data);
  return isNaN(parsed) ? 0 : parsed * 5;
}

export function computeCellState(qDef, targetDateStr, eventsForQuality, readinessForDate = 7, blocks = []) {
  const targetTime = new Date(targetDateStr).getTime();

  // Détection du bloc de préparation spécifique actif pour la date cible
  const activeBlock = getActiveBlockForDate(targetDateStr, blocks);
  const isFocus = !!(activeBlock && activeBlock.focusQualities?.includes(qDef.id));
  const prescriptionMultiplier = isFocus 
    ? (activeBlock.targetMultiplier ?? 0.45) 
    : (activeBlock?.maintenanceMultiplier ?? 1.0);

  let bestStatusPrescription = 'red';
  let daysLeftPrescription = 0;
  let opacityPrescription = 1;
  let currentLevelPrescription = 0;

  let bestStatusPhysio = 'red';
  let daysLeftPhysio = 0;
  let opacityPhysio = 1;
  let currentLevelPhysio = 0;

  let recent3DaysLoad = 0;
  let total28dLoad = 0;
  let sessionCount28d = 0;

  // Calcul de la charge médiane de cette qualité pour doseScale continue
  const pastLoads = [];
  for (const [eventDate, data] of Object.entries(eventsForQuality || {})) {
    const eventTime = new Date(eventDate).getTime();
    const daysSince = Math.round((targetTime - eventTime) / (1000 * 3600 * 24));
    if (daysSince >= 0 && daysSince <= 60) {
      const l = extractSessionLoad(data);
      if (l > 0) pastLoads.push(l);
    }
  }
  pastLoads.sort((a, b) => a - b);
  const refLoad_q = pastLoads.length > 0 ? pastLoads[Math.floor(pastLoads.length / 2)] : 240;

  for (const [eventDate, data] of Object.entries(eventsForQuality || {})) {
    const eventTime = new Date(eventDate).getTime();
    const daysSince = Math.round((targetTime - eventTime) / (1000 * 3600 * 24));

    if (daysSince >= 0) {
      const load = extractSessionLoad(data);

      if (daysSince <= 3) {
        recent3DaysLoad += load;
      }
      if (daysSince <= 28) {
        total28dLoad += load;
        if (load > 0) sessionCount28d++;
      }

      // Dose-réponse continue (B3): doseScale(load / refLoad_q)
      // Sans plancher fixe à 0.75 ni saut artificiel
      let doseScale = 1.0;
      if (load > 0) {
        const ratio = load / refLoad_q;
        doseScale = Math.max(0.2, Math.min(1.4, 0.4 + 0.6 * Math.sqrt(Math.max(0, ratio))));
      } else {
        doseScale = 0.5;
      }

      // 1. Calcul Physiologique Pur (sans multiplicateur de bloc, pour Radar et rémanence réelle - B5)
      const gPhysio = qDef.g * doseScale;
      const oPhysio = qDef.o * doseScale;

      if (daysSince < gPhysio) {
        const dLeft = gPhysio - daysSince;
        if (bestStatusPhysio !== 'green' || dLeft > daysLeftPhysio) {
          bestStatusPhysio = 'green';
          daysLeftPhysio = Math.max(0.1, Math.round(dLeft * 10) / 10);
          opacityPhysio = 1 - (daysSince / gPhysio) * 0.5;
          currentLevelPhysio = 100 - (daysSince / gPhysio) * 20;
        }
      } else if (daysSince < (gPhysio + oPhysio) && bestStatusPhysio !== 'green') {
        const dLeft = (gPhysio + oPhysio) - daysSince;
        if (bestStatusPhysio !== 'orange' || dLeft > daysLeftPhysio) {
          bestStatusPhysio = 'orange';
          daysLeftPhysio = Math.max(0.1, Math.round(dLeft * 10) / 10);
          opacityPhysio = 1 - ((daysSince - gPhysio) / oPhysio) * 0.5;
          currentLevelPhysio = Math.max(0, 60 - ((daysSince - gPhysio) / oPhysio) * 40);
        }
      }

      // 2. Calcul Prescription (avec multiplicateur de bloc x0.45 pour la Grille et les alertes)
      const gPrescription = gPhysio * prescriptionMultiplier;
      const oPrescription = oPhysio * prescriptionMultiplier;

      if (daysSince < gPrescription) {
        const dLeft = gPrescription - daysSince;
        if (bestStatusPrescription !== 'green' || dLeft > daysLeftPrescription) {
          bestStatusPrescription = 'green';
          daysLeftPrescription = Math.max(0.1, Math.round(dLeft * 10) / 10);
          opacityPrescription = 1 - (daysSince / gPrescription) * 0.5;
          currentLevelPrescription = 100 - (daysSince / gPrescription) * 20;
        }
      } else if (daysSince < (gPrescription + oPrescription) && bestStatusPrescription !== 'green') {
        const dLeft = (gPrescription + oPrescription) - daysSince;
        if (bestStatusPrescription !== 'orange' || dLeft > daysLeftPrescription) {
          bestStatusPrescription = 'orange';
          daysLeftPrescription = Math.max(0.1, Math.round(dLeft * 10) / 10);
          opacityPrescription = 1 - ((daysSince - gPrescription) / oPrescription) * 0.5;
          currentLevelPrescription = Math.max(0, 60 - ((daysSince - gPrescription) / oPrescription) * 40);
        }
      }
    }
  }

  // Évaluation de la fatigue aiguë élevée (B8)
  const dailyAverage28d = sessionCount28d > 0 ? (total28dLoad / 28) : 40;
  const isAcuteFatigueHigh = recent3DaysLoad > Math.max(500, dailyAverage28d * 3 * 1.8);
  const isBurnout = isAcuteFatigueHigh;

  let blockStateInfo = null;
  if (activeBlock) {
    blockStateInfo = {
      name: activeBlock.name,
      type: isFocus ? 'focus' : 'maintenance',
      label: isFocus ? 'Fréquence de développement (x0.45)' : 'Maintien nominal (x1.0)'
    };
  }

  let tooltip = 'Qualité dégradée (Rouge)';
  if (bestStatusPrescription === 'green') tooltip = `Effet Actif : Reste ${daysLeftPrescription} jours`;
  if (bestStatusPrescription === 'orange') tooltip = `Fenêtre de rappel : Reste ${daysLeftPrescription} jours`;
  if (blockStateInfo) {
    tooltip += ` • [Bloc ${blockStateInfo.name} : ${blockStateInfo.label}]`;
  }
  if (isAcuteFatigueHigh) tooltip += ' ⚠️ FATIGUE AIGUË ÉLEVÉE (3 jours de charge intense)';

  return { 
    status: bestStatusPrescription, 
    opacity: opacityPrescription, 
    daysLeft: daysLeftPrescription, 
    currentLevel: Math.max(0, currentLevelPrescription), 
    tooltip, 
    isBurnout,
    isAcuteFatigueHigh,
    blockStateInfo,
    physio: {
      status: bestStatusPhysio,
      opacity: opacityPhysio,
      daysLeft: daysLeftPhysio,
      currentLevel: Math.max(0, currentLevelPhysio)
    },
    prescription: {
      status: bestStatusPrescription,
      opacity: opacityPrescription,
      daysLeft: daysLeftPrescription,
      currentLevel: Math.max(0, currentLevelPrescription)
    }
  };
}

/**
 * Calcule l'historique de charge et les courbes EMA (3, 7, 21 jours)
 * pour une qualité donnée sur une fenêtre temporelle passée et présente.
 */
export function computeQualityEMAData(qualityId, eventsForQuality, daysHistory = 45, daysFuture = 0) {
  const today = new Date();
  const rawData = [];

  for (let i = -daysHistory; i <= daysFuture; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = getLocalYYYYMMDD(d);
    
    let load = 0;
    if (eventsForQuality && eventsForQuality[dateStr]) {
      load = extractSessionLoad(eventsForQuality[dateStr]);
    }
    rawData.push({
      dateStr,
      day: d.getDate(),
      offset: i,
      load
    });
  }

  const loads = rawData.map(d => d.load);
  const ema3 = calculateEMA(loads, 3, true);
  const ema7 = calculateEMA(loads, 7, true);
  const ema21 = calculateEMA(loads, 21, true);

  const series = rawData.map((d, idx) => ({
    ...d,
    ema3: Math.round(ema3[idx] * 10) / 10,
    ema7: Math.round(ema7[idx] * 10) / 10,
    ema21: Math.round(ema21[idx] * 10) / 10,
  }));

  const todayIndex = series.findIndex(s => s.offset === 0);
  const current = todayIndex >= 0 ? series[todayIndex] : series[series.length - 1];
  const prev = todayIndex > 0 ? series[todayIndex - 1] : null;

  // Comparaisons par rapport au jour précédent (J-1)
  const deltaEma3 = prev ? Math.round((current.ema3 - prev.ema3) * 10) / 10 : 0;
  const deltaEma7 = prev ? Math.round((current.ema7 - prev.ema7) * 10) / 10 : 0;
  const deltaEma21 = prev ? Math.round((current.ema21 - prev.ema21) * 10) / 10 : 0;

  // Comparaisons par rapport à la période caractéristique de chaque EMA (J-3, J-7, J-21)
  const prevPeriod3 = todayIndex >= 3 ? series[todayIndex - 3] : prev;
  const prevPeriod7 = todayIndex >= 7 ? series[todayIndex - 7] : prev;
  const prevPeriod21 = todayIndex >= 21 ? series[todayIndex - 21] : prev;

  const periodDelta3 = prevPeriod3 ? Math.round((current.ema3 - prevPeriod3.ema3) * 10) / 10 : deltaEma3;
  const periodDelta7 = prevPeriod7 ? Math.round((current.ema7 - prevPeriod7.ema7) * 10) / 10 : deltaEma7;
  const periodDelta21 = prevPeriod21 ? Math.round((current.ema21 - prevPeriod21.ema21) * 10) / 10 : deltaEma21;

  // Comparaisons par rapport à la semaine précédente (J-7)
  const prevWeek = todayIndex >= 7 ? series[todayIndex - 7] : prev;
  const weekDelta3 = prevWeek ? Math.round((current.ema3 - prevWeek.ema3) * 10) / 10 : deltaEma3;
  const weekDelta7 = prevWeek ? Math.round((current.ema7 - prevWeek.ema7) * 10) / 10 : deltaEma7;
  const weekDelta21 = prevWeek ? Math.round((current.ema21 - prevWeek.ema21) * 10) / 10 : deltaEma21;

  const percent3 = prev && prev.ema3 > 0 ? Math.round((deltaEma3 / prev.ema3) * 1000) / 10 : (deltaEma3 > 0 ? 100 : 0);
  const percent7 = prev && prev.ema7 > 0 ? Math.round((deltaEma7 / prev.ema7) * 1000) / 10 : (deltaEma7 > 0 ? 100 : 0);
  const percent21 = prev && prev.ema21 > 0 ? Math.round((deltaEma21 / prev.ema21) * 1000) / 10 : (deltaEma21 > 0 ? 100 : 0);

  const periodPercent3 = prevPeriod3 && prevPeriod3.ema3 > 0 ? Math.round((periodDelta3 / prevPeriod3.ema3) * 1000) / 10 : (periodDelta3 > 0 ? 100 : 0);
  const periodPercent7 = prevPeriod7 && prevPeriod7.ema7 > 0 ? Math.round((periodDelta7 / prevPeriod7.ema7) * 1000) / 10 : (periodDelta7 > 0 ? 100 : 0);
  const periodPercent21 = prevPeriod21 && prevPeriod21.ema21 > 0 ? Math.round((periodDelta21 / prevPeriod21.ema21) * 1000) / 10 : (periodDelta21 > 0 ? 100 : 0);

  const weekPercent3 = prevWeek && prevWeek.ema3 > 0 ? Math.round((weekDelta3 / prevWeek.ema3) * 1000) / 10 : (weekDelta3 > 0 ? 100 : 0);
  const weekPercent7 = prevWeek && prevWeek.ema7 > 0 ? Math.round((weekDelta7 / prevWeek.ema7) * 1000) / 10 : (weekDelta7 > 0 ? 100 : 0);
  const weekPercent21 = prevWeek && prevWeek.ema21 > 0 ? Math.round((weekDelta21 / prevWeek.ema21) * 1000) / 10 : (weekDelta21 > 0 ? 100 : 0);

  // Validation statistique de l'ACWR par filière :
  // Nécessite au moins 4 séances sur les 28 derniers jours et une EMA 21j significative (> 5 UA)
  // pour éviter les ratios aberrants (ex: 3.8) après une simple reprise d'une qualité peu fréquente.
  const recentSessionsCount28d = rawData
    .filter(d => d.offset <= 0 && d.offset >= -28)
    .filter(d => d.load > 0).length;

  const isAcwrValid = recentSessionsCount28d >= 4 && current && current.ema21 > 5;
  const acwr = isAcwrValid 
    ? Math.round((current.ema7 / current.ema21) * 100) / 100 
    : null;

  const trend = prev 
    ? (current.ema3 > prev.ema3 + 0.5 ? 'up' : current.ema3 < prev.ema3 - 0.5 ? 'down' : 'flat') 
    : 'flat';

  const trend3 = deltaEma3 > 0.1 ? 'up' : deltaEma3 < -0.1 ? 'down' : 'flat';
  const trend7 = deltaEma7 > 0.1 ? 'up' : deltaEma7 < -0.1 ? 'down' : 'flat';
  const trend21 = deltaEma21 > 0.1 ? 'up' : deltaEma21 < -0.1 ? 'down' : 'flat';

  // Sparkline : 14 derniers jours jusqu'à aujourd'hui inclus
  const sparklineStart = Math.max(0, todayIndex - 13);
  const sparkline = series.slice(sparklineStart, todayIndex + 1);

  return {
    qualityId,
    series,
    current: {
      load: current ? current.load : 0,
      ema3: current ? current.ema3 : 0,
      ema7: current ? current.ema7 : 0,
      ema21: current ? current.ema21 : 0,
      prevEma3: prev ? prev.ema3 : 0,
      prevEma7: prev ? prev.ema7 : 0,
      prevEma21: prev ? prev.ema21 : 0,
      prevPeriodEma3: prevPeriod3 ? prevPeriod3.ema3 : 0,
      prevPeriodEma7: prevPeriod7 ? prevPeriod7.ema7 : 0,
      prevPeriodEma21: prevPeriod21 ? prevPeriod21.ema21 : 0,
      prevWeekEma3: prevWeek ? prevWeek.ema3 : 0,
      prevWeekEma7: prevWeek ? prevWeek.ema7 : 0,
      prevWeekEma21: prevWeek ? prevWeek.ema21 : 0,
      delta3: deltaEma3,
      delta7: deltaEma7,
      delta21: deltaEma21,
      periodDelta3,
      periodDelta7,
      periodDelta21,
      weekDelta3,
      weekDelta7,
      weekDelta21,
      percent3,
      percent7,
      percent21,
      periodPercent3,
      periodPercent7,
      periodPercent21,
      weekPercent3,
      weekPercent7,
      weekPercent21,
      trend3,
      trend7,
      trend21,
      acwr,
      trend
    },
    sparkline
  };
}

/**
 * Calcule les courbes EMA (3, 7, 21 jours) pour l'ensemble des qualités.
 */
export function computeAllQualitiesEMA(qualities, events, daysHistory = 45, daysFuture = 0) {
  const result = {};
  for (const q of qualities) {
    result[q.id] = computeQualityEMAData(q.id, events?.[q.id] || {}, daysHistory, daysFuture);
  }
  return result;
}

/**
 * Calcule les métriques de monotonie et de strain de Foster sur une période de 7 jours.
 * - Monotonie de Foster = Moyenne quotidienne de charge / Écart-type
 * - Strain de Foster = Charge totale hebdo × Monotonie
 */
export function computeFosterMetrics(events, referenceDateStr = null, windowDays = 7) {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const dailyLoads = [];

  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(refDate);
    d.setDate(refDate.getDate() - i);
    const dateStr = getLocalYYYYMMDD(d);

    // Charge réelle de l'athlète (exclut les impacts secondaires pour éviter tout double-comptage)
    const load = getDailyAthleteLoad(events, dateStr);
    dailyLoads.push({ dateStr, load });
  }

  const totalLoad = dailyLoads.reduce((acc, d) => acc + d.load, 0);
  const exactMeanLoad = totalLoad / windowDays;
  const meanLoad = Math.round(exactMeanLoad);

  // Variance calculée sur la moyenne exacte non tronquée pour éviter tout biais numérique
  const variance = dailyLoads.reduce((acc, d) => acc + Math.pow(d.load - exactMeanLoad, 2), 0) / windowDays;
  const stdDev = Math.sqrt(variance);

  // Si l'écart-type est nul mais qu'il y a de la charge (même charge tous les jours sans repos)
  let monotony = 1.0;
  if (stdDev > 0) {
    monotony = Math.round((exactMeanLoad / stdDev) * 100) / 100;
  } else if (exactMeanLoad > 0) {
    monotony = 3.5; // Monotonie maximale
  }

  const strain = Math.round(totalLoad * monotony);

  let riskLevel = 'OPTIMAL'; // OPTIMAL, MODERATE, HIGH, CRITICAL
  let riskBadge = '✅ Équilibré';
  let riskColor = 'emerald';
  let advice = 'Excellente alternance entre séances stimulantes et régénération.';

  if (monotony > 2.0 || strain > 4500) {
    riskLevel = 'CRITICAL';
    riskBadge = '🚨 Risque Surcharge / Maladie';
    riskColor = 'red';
    advice = 'Monotonie critique (> 2.0). Risque élevé d\'infection respiratoire, d\'effondrement immunitaire et de blessure. Intégrez un jour de repos complet.';
  } else if (monotony > 1.5 || strain > 3200) {
    riskLevel = 'HIGH';
    riskBadge = '⚠️ Monotonie Élevée';
    riskColor = 'amber';
    advice = 'Les charges journalières se ressemblent trop. Variez les intensités (jours légers vs jours durs) pour stimuler la surcompensation.';
  } else if (monotony < 1.0 && totalLoad > 0) {
    riskLevel = 'OPTIMAL';
    riskBadge = '🎯 Forte Variabilité Journalière';
    riskColor = 'emerald';
    advice = 'Forte variabilité des charges (alternance de jours très légers et de séances clés) : propice à une excellente assimilation.';
  }

  return {
    windowDays,
    dailyLoads,
    totalLoad,
    meanLoad,
    stdDev: Math.round(stdDev * 10) / 10,
    monotony,
    strain,
    riskLevel,
    riskBadge,
    riskColor,
    advice
  };
}

/**
 * Modèle Banister étendu (Passé + Projection Future) :
 * - ATL (Fatigue aiguë, tau = tauFatigue, ex: 5 à 12j, défaut 7j)
 * - CTL (Condition physique / Fitness chronique, tau = tauFitness, ex: 21 à 45j, défaut 28j)
 * - TSB = CTL - ATL (Training Stress Balance / Readiness / Forme)
 * - Prédiction du pic de forme (TSB apex)
 */
export function computeBanisterPerformance(
  events, 
  dailyMetrics = {}, 
  daysHistory = 30, 
  daysFuture = 14,
  tauFatigue = 7,
  tauFitness = 28,
  initialCtl = null
) {
  const today = new Date();

  // Déterminer la date de la plus ancienne séance enregistrée pour connaître l'historique réel
  let earliestSessionDate = null;
  Object.values(events || {}).forEach(qDates => {
    if (qDates) {
      Object.entries(qDates).forEach(([dateStr, session]) => {
        if (session && isPrimary(session) && extractSessionLoad(session) > 0) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            if (!earliestSessionDate || d < earliestSessionDate) {
              earliestSessionDate = d;
            }
          }
        }
      });
    }
  });

  const historyDays = earliestSessionDate 
    ? Math.max(0, Math.round((today.getTime() - earliestSessionDate.getTime()) / (1000 * 3600 * 24)))
    : 0;

  // Période d'échauffement mathématique : au moins 90 jours passés pour assurer la convergence de la CTL (tau=28j)
  const warmupDays = Math.max(90, daysHistory + 60);
  const fullRawData = [];

  for (let i = -warmupDays; i <= daysFuture; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = getLocalYYYYMMDD(d);

    // Charge réelle de l'athlète (exclut les impacts secondaires pour éviter toute surévaluation)
    const load = getDailyAthleteLoad(events, dateStr);

    const vfc = dailyMetrics?.[dateStr]?.vfc || null;
    const readiness = dailyMetrics?.[dateStr]?.readiness || null;

    fullRawData.push({
      dateStr,
      day: d.getDate(),
      month: d.getMonth() + 1,
      offset: i,
      isToday: i === 0,
      isFuture: i > 0,
      load,
      vfc,
      readiness
    });
  }

  const loads = fullRawData.map(d => d.load);
  const atlArray = calculateExpDecay(loads, tauFatigue, { decayToZero: true });
  const ctlArray = calculateExpDecay(loads, tauFitness, { decayToZero: true, initialValue: initialCtl });

  const fullSeries = fullRawData.map((d, idx) => {
    const atl = Math.round(atlArray[idx] * 10) / 10;
    const ctl = Math.round(ctlArray[idx] * 10) / 10;
    const tsb = Math.round((ctl - atl) * 10) / 10;
    const tsbPercent = calculateTsbPercent(ctl, atl);

    // ACWR couplé classique
    const acwr = ctl > 0 ? Math.round((atl / ctl) * 100) / 100 : 1;

    // ACWR non couplé (aiguë J-0..J-6 vs chronique non couplée J-7..J-27)
    let acwrUncoupled = acwr;
    if (idx >= 27) {
      const acuteLoads = loads.slice(idx - 6, idx + 1);
      const chronicLoads = loads.slice(idx - 27, idx - 6);
      const acuteMean = acuteLoads.reduce((a, b) => a + b, 0) / 7;
      const chronicMean = chronicLoads.reduce((a, b) => a + b, 0) / 21;
      if (chronicMean > 0) {
        acwrUncoupled = Math.round((acuteMean / chronicMean) * 100) / 100;
      }
    }

    return {
      ...d,
      atl, // Fatigue aiguë (tauFatigue j)
      ctl, // Fitness chronique (tauFitness j)
      tsb, // Forme absolue (CTL - ATL)
      tsbPercent, // Forme relative en % de la CTL
      acwr,
      acwrUncoupled
    };
  });

  // Ne renvoyer pour l'affichage que la fenêtre demandée [-daysHistory, daysFuture]
  const displayStartIndex = fullSeries.findIndex(s => s.offset === -daysHistory);
  const series = displayStartIndex >= 0 ? fullSeries.slice(displayStartIndex) : fullSeries;

  const todayIndex = series.findIndex(s => s.isToday);
  const current = todayIndex >= 0 ? series[todayIndex] : series[0];
  const futureSeries = series.filter(s => s.isFuture);

  // Recherche du pic de forme dans les jours futurs
  let peakDay = null;
  if (futureSeries.length > 0) {
    let maxTsb = -999;
    futureSeries.forEach(s => {
      if (s.tsb > maxTsb) {
        maxTsb = s.tsb;
        peakDay = s;
      }
    });
  }

  // Zone centrale TSB selon les pourcentages de CTL
  const tsbZone = getTsbZone(current.ctl, current.atl, historyDays);

  return {
    tauFatigue,
    tauFitness,
    series,
    current,
    todayIndex,
    futureSeries,
    peakDay,
    historyDays,
    isWarmedUp: historyDays >= 21,
    tsbZone
  };
}

/**
 * Analyse d'affûtage (Tapering) en vue d'un objectif ou d'une compétition
 */
export function getTaperingAnalysis(
  targetCompetition, 
  events, 
  dailyMetrics = {},
  tauFatigue = 7,
  tauFitness = 28,
  initialCtl = null
) {
  if (!targetCompetition || !targetCompetition.date) return null;

  const today = new Date();
  const [ty, tm, td] = targetCompetition.date.split('-').map(Number);
  const compDate = new Date(ty, tm - 1, td);

  const diffMs = compDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 3600 * 24));

  // Modèle Banister sur 30j passés et projection jusqu'à la compétition
  const projectionDays = Math.max(7, Math.min(30, Math.max(0, daysRemaining) + 3));
  const banister = computeBanisterPerformance(events, dailyMetrics, 30, projectionDays, tauFatigue, tauFitness, initialCtl);

  const compDayData = banister.series.find(s => s.dateStr === targetCompetition.date) || 
                      banister.futureSeries[banister.futureSeries.length - 1] || 
                      banister.current;

  const targetTsb = targetCompetition.targetTsb ?? 15;
  const targetTsbUnit = targetCompetition.targetTsbUnit || 'points';
  const projectedTsb = compDayData?.tsb ?? 0;
  const projectedTsbPercent = calculateTsbPercent(compDayData?.ctl ?? 0, compDayData?.atl ?? 0);
  const tsbGap = Math.round((projectedTsb - targetTsb) * 10) / 10;
  const tsbZone = getTsbZone(compDayData?.ctl ?? 0, compDayData?.atl ?? 0, banister.historyDays);

  // Monotonie sur les 7 derniers jours
  const foster = computeFosterMetrics(events);

  // Évaluation de la phase d'affûtage
  let status = 'BUILD'; // BUILD, TAPER_START, TAPER_OPTIMAL, TAPER_OVERREACHING, PEAK
  let statusBadge = '🏋️ Phase de Développement';
  let statusColor = 'blue';
  let advice = '';

  // Compter les séances futures planifiées entre aujourd'hui et le Jour J
  let futureSessionsCount = 0;
  banister.series
    .filter(s => s.offset > 0 && s.dateStr <= targetCompetition.date)
    .forEach(s => {
      if (s.load > 0) futureSessionsCount += 1;
    });

  if (daysRemaining > 21) {
    status = 'BUILD';
    statusBadge = '⚡ Cycle de Charge';
    statusColor = 'blue';
    advice = 'Consolidez votre volume et votre charge chronique (CTL). Vous avez le temps d\'accumuler du travail sans risque immédiat pour le pic.';
  } else if (daysRemaining > 10) {
    status = 'TAPER_START';
    statusBadge = '📉 Début d\'Affûtage';
    statusColor = 'cyan';
    advice = 'Amorcez la réduction progressive du volume (-40% à -50%) tout en maintenant l\'intensité cible pour conserver le recrutement neuromusculaire.';
  } else if (daysRemaining > 0) {
    const isOptimalTsb = (projectedTsbPercent !== null && projectedTsbPercent >= 5 && projectedTsbPercent <= 25) || (projectedTsb >= 10 && projectedTsb <= 25);
    if (isOptimalTsb) {
      if (futureSessionsCount === 0) {
        status = 'TAPER_PASSIVE';
        statusBadge = '💤 Repos Passif Projeté';
        statusColor = 'sky';
        advice = `Hypothèse de repos total jusqu'au Jour J (aucune séance future planifiée). TSB passif projeté : +${projectedTsb}${projectedTsbPercent !== null ? ` (+${projectedTsbPercent}% de la CTL)` : ''}. Planifiez vos rappels d'affûtage dans la grille pour une modélisation active.`;
      } else {
        status = 'TAPER_OPTIMAL';
        statusBadge = '🎯 Affûtage Actif (Pic de Forme)';
        statusColor = 'emerald';
        advice = `Planification d'affûtage active (${futureSessionsCount} séance(s) planifiée(s)). TSB prévu le Jour J : +${projectedTsb}${projectedTsbPercent !== null ? ` (+${projectedTsbPercent}% de la CTL)` : ''} (cible : +${targetTsb}).`;
      }
    } else if ((projectedTsbPercent !== null && projectedTsbPercent < 5) || projectedTsb < 10) {
      status = 'TAPER_OVERREACHING';
      statusBadge = '⚠️ Fatigue Résiduelle Élevée';
      statusColor = 'amber';
      advice = `Votre TSB prévu est trop bas (+${projectedTsb}${projectedTsbPercent !== null ? `, ${projectedTsbPercent}% CTL` : ''}). Diminuez la charge pour évacuer la fatigue (ATL) avant l'épreuve.`;
    } else {
      status = 'PEAK';
      statusBadge = '🕊️ Légèreté / Risque Désaffûtage';
      statusColor = 'yellow';
      advice = `TSB très élevé (+${projectedTsb}${projectedTsbPercent !== null ? `, +${projectedTsbPercent}% CTL` : ''}). Attention au manque de tonus neuromusculaire : prévoyez 1 ou 2 rappels courts et nerveux sous 48h.`;
    }
  } else if (daysRemaining === 0) {
    status = 'PEAK';
    statusBadge = '🏁 Jour J : Compétition !';
    statusColor = 'emerald';
    advice = `C'est le grand jour ! TSB actuel : ${banister.current.tsb}. Donnez le meilleur de vous-même.`;
  } else {
    status = 'POST';
    statusBadge = '🏅 Épreuve Terminée';
    statusColor = 'slate';
    advice = 'Phase de récupération post-effort active recommandée.';
  }

  return {
    targetCompetition,
    daysRemaining,
    banister,
    compDayData,
    targetTsb,
    targetTsbUnit,
    projectedTsb,
    projectedTsbPercent,
    tsbGap,
    tsbZone,
    foster,
    futureSessionsCount,
    status,
    statusBadge,
    statusColor,
    advice
  };
}

/**
 * Calcul TRIMP Multi-Facteurs : Balance Cardiovasculaire vs Musculo-Squelettique
 * Détermine si la fatigue actuelle est principalement respiratoire/cardiaque ou tissulaire/musculaire
 */
export function computeCardioVsMuscularBalance(events, referenceDateStr = null, windowDays = 7) {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const dailyBreakdown = [];
  let totalCardioLoad = 0;
  let totalMuscLoad = 0;
  let totalGlobalLoad = 0;
  let totalEccentricSessions = 0;

  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(refDate);
    d.setDate(refDate.getDate() - i);
    const dateStr = getLocalYYYYMMDD(d);

    let dayCardio = 0;
    let dayMusc = 0;
    let dayGlobal = 0;
    let dayHasEccentric = false;

    Object.values(events || {}).forEach(qEvents => {
      if (qEvents && qEvents[dateStr]) {
        const item = qEvents[dateStr];
        // Exclure les impacts secondaires pour éviter de fausser la balance réelle de l'athlète
        if (!isPrimary(item)) return;

        let cLoad = 0;
        let mLoad = 0;
        let gLoad = 0;

        if (typeof item === 'object') {
          gLoad = Number(item.load) || 0;
          const dur = Number(item.duration) || 0;
          const rpeC = Number(item.rpeCardio) || 0;
          const rpeM = Number(item.rpeMusc || item.rpeMusculaire) || 0;
          const isEcc = Boolean(item.isEccentric);

          if (item.loadCardio !== undefined) {
            cLoad = Number(item.loadCardio) || 0;
          } else if (dur > 0 && rpeC > 0) {
            cLoad = dur * rpeC;
          } else {
            cLoad = gLoad;
          }

          if (item.loadMusc !== undefined) {
            mLoad = Number(item.loadMusc) || 0;
          } else if (dur > 0 && rpeM > 0) {
            mLoad = Math.round(dur * rpeM * (isEcc ? 1.35 : 1.0));
          } else {
            mLoad = gLoad;
          }

          if (isEcc) {
            dayHasEccentric = true;
          }
        } else if (typeof item === 'number') {
          gLoad = item * 5;
          cLoad = gLoad;
          mLoad = gLoad;
        }

        dayCardio += cLoad;
        dayMusc += mLoad;
        dayGlobal += gLoad;
      }
    });

    if (dayHasEccentric) totalEccentricSessions++;
    totalCardioLoad += dayCardio;
    totalMuscLoad += dayMusc;
    totalGlobalLoad += dayGlobal;

    dailyBreakdown.push({
      dateStr,
      day: d.getDate(),
      cardioLoad: dayCardio,
      muscLoad: dayMusc,
      globalLoad: dayGlobal,
      hasEccentric: dayHasEccentric
    });
  }

  const combined = totalCardioLoad + totalMuscLoad;
  const cardioPercent = combined > 0 ? Math.round((totalCardioLoad / combined) * 100) : 50;
  const muscPercent = 100 - cardioPercent;

  // Score d'asymétrie (-100 à +100) : > 0 = Cardio domine, < 0 = Musculaire domine
  const asymmetryScore = combined > 0 ? Math.round(((totalCardioLoad - totalMuscLoad) / combined) * 100) : 0;

  let state = 'BALANCED'; // 'CARDIO_DOMINANT' | 'MUSCULAR_DOMINANT' | 'BALANCED'
  let badge = '⚖️ Équilibre Cardio-Musculaire';
  let color = 'emerald';
  let description = 'Charge harmonieusement répartie entre appareil cardiorespiratoire et chaîne musculo-squelettique.';
  let recommendation = 'Toutes les filières peuvent être abordées sans contre-indication de fatigue locale.';

  if (asymmetryScore >= 20) {
    state = 'CARDIO_DOMINANT';
    badge = '🫀 Jambes Fraîches / Cardio Sollicité';
    color = 'sky';
    description = 'Votre système cardiorespiratoire a absorbé l\'essentiel du stress récent. Vos muscles et articulations restent relativement frais.';
    recommendation = 'Idéal pour : renforcement musculaire, force max, travail technique, pliométrie légère ou côtes courtes sans montée en zone rouge cardiaque.';
  } else if (asymmetryScore <= -20) {
    state = 'MUSCULAR_DOMINANT';
    badge = '🦵 Cardio Disponible / Jambes Lourdes';
    color = 'red';
    description = 'Tension mécanique, courbatures et stress tissulaire élevés. Votre cœur et vos poumons sont prêts mais vos fibres musculaires demandent de la régénération.';
    recommendation = 'Idéal pour : séance cardio portée à basse intensité (vélo, home-trainer, natation, marche inclinée) pour favoriser le drainage sans impacts articulaires.';
  }

  return {
    windowDays,
    dailyBreakdown,
    totalCardioLoad,
    totalMuscLoad,
    totalGlobalLoad,
    totalEccentricSessions,
    cardioPercent,
    muscPercent,
    asymmetryScore,
    state,
    badge,
    color,
    description,
    recommendation
  };
}
