/**
 * Moteur analytique hybride (Force + Endurance / Trail / Vélo) :
 * - Dual-Banister : séparation charge Cardio/Centrale vs Musculaire/Périphérique
 * - Détecteur d'effet d'interférence (Concurrent Training — Hickson / Wilson)
 * - Briefing quotidien composite (Feu tricolore VFC + FC repos + Dual-TSB + Interférence)
 * - Suivi longitudinal de la force (e1RM ajusté au RIR + détection PR temps réel)
 */

import type { EventsByQuality, Quality, SessionData } from '../types';
import type { DailyMetrics } from '../hooks/useMetricsState';
import { addDays, getLocalYYYYMMDD } from './dateHelpers';
import { isPrimary, extractSessionLoad } from './loadHelpers';
import { isCardioQuality, isForceQuality } from './qualities';
import { computeHrRestAnalysis, computeVfcAnalysis } from './vfcHelpers';
import { EXERCISE_CATALOG } from '../data/exerciseCatalog';

// ============================================================================
// 1. EXTRACTION TÉLÉMÉTRIE DISTANCE (KM) & DÉNIVELÉ (D+)
// ============================================================================

/**
 * Extrait la distance (km) et le dénivelé positif (m) d'une séance,
 * depuis ses champs dédiés ou en repli depuis les notes Garmin déjà importées.
 */
export function extractSessionTelemetry(session: SessionData | null | undefined): {
  distanceKm: number;
  elevationGainM: number;
} {
  if (!session || !isPrimary(session)) return { distanceKm: 0, elevationGainM: 0 };

  let distanceKm =
    typeof session.distanceKm === 'number' && Number.isFinite(session.distanceKm) && session.distanceKm > 0
      ? session.distanceKm
      : 0;
  let elevationGainM =
    typeof session.elevationGainM === 'number' &&
    Number.isFinite(session.elevationGainM) &&
    session.elevationGainM > 0
      ? session.elevationGainM
      : 0;

  if (Array.isArray(session.subSessions) && session.subSessions.length > 0 && distanceKm === 0 && elevationGainM === 0) {
    for (const sub of session.subSessions) {
      if (typeof sub.distanceKm === 'number' && Number.isFinite(sub.distanceKm) && sub.distanceKm > 0) {
        distanceKm += sub.distanceKm;
      }
      if (typeof sub.elevationGainM === 'number' && Number.isFinite(sub.elevationGainM) && sub.elevationGainM > 0) {
        elevationGainM += sub.elevationGainM;
      }
    }
  }

  // Repli rétrocompatible pour les séances Garmin importées avant l'ajout des champs dédiés
  if (distanceKm === 0 && typeof session.notes === 'string') {
    const kmMatches = session.notes.matchAll(/(\d+(?:[.,]\d+)?)\s*km\b/gi);
    for (const match of kmMatches) {
      const parsed = Number(match[1].replace(',', '.'));
      if (Number.isFinite(parsed) && parsed > 0 && parsed < 500) {
        distanceKm += parsed;
      }
    }
  }

  if (elevationGainM === 0 && typeof session.notes === 'string') {
    const elevMatches = session.notes.matchAll(/\+(\d+)\s*m\b/gi);
    for (const match of elevMatches) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0 && parsed < 25000) {
        elevationGainM += parsed;
      }
    }
  }

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    elevationGainM: Math.round(elevationGainM),
  };
}

// ============================================================================
// 2. DUAL-BANISTER : CARDIO/CENTRAL VS MUSCULAIRE/PÉRIPHÉRIQUE
// ============================================================================

export interface DualBanisterPoint {
  dateStr: string;
  label: string;
  isToday: boolean;
  isFuture: boolean;
  cardioLoad: number;
  muscLoad: number;
  cardioCtl: number;
  cardioAtl: number;
  cardioTsb: number;
  muscCtl: number;
  muscAtl: number;
  muscTsb: number;
}

export interface DualBanisterResult {
  series: DualBanisterPoint[];
  today: DualBanisterPoint;
  limitingFactor: 'cardio' | 'muscular' | 'both' | 'balanced' | 'fresh';
  limitingLabel: string;
  summary: string;
  cardioShare7d: number;
  muscularShare7d: number;
}

/**
 * Calcule deux modèles Banister parallèles :
 * - Compartiment Cardio/Central (basé sur loadCardio)
 * - Compartiment Musculaire/Périphérique (basé sur loadMusc + bonus mécanique D+ en course/trail)
 */
export function computeDualBanister(
  events: EventsByQuality,
  qualities: Quality[] = [],
  historyDays: number = 35,
  futureDays: number = 7,
  tauFatigue: number = 7,
  tauFitness: number = 28,
  referenceDateStr?: string
): DualBanisterResult {
  const safeTauAtl = Math.max(3, Math.min(14, Number(tauFatigue) || 7));
  const safeTauCtl = Math.max(14, Math.min(60, Number(tauFitness) || 28));
  const alphaAtl = 1 - Math.exp(-1 / safeTauAtl);
  const alphaCtl = 1 - Math.exp(-1 / safeTauCtl);

  const todayDate = referenceDateStr
    ? new Date(`${referenceDateStr}T12:00:00`)
    : new Date();
  const todayStr = getLocalYYYYMMDD(todayDate);

  // Pré-calculer les charges quotidiennes cardio et musculaires (avec 30j de warm-up avant historyDays)
  const warmupDays = 30;
  const totalPast = historyDays + warmupDays;
  const dailyCardio = new Map<string, number>();
  const dailyMusc = new Map<string, number>();

  Object.entries(events || {}).forEach(([qId, qDates]) => {
    if (!qDates) return;
    const isCardio = isCardioQuality(qId, qualities);
    const isForce = isForceQuality(qId, qualities);

    Object.entries(qDates).forEach(([dateStr, session]) => {
      if (!session || !isPrimary(session)) return;
      const totalLoad = extractSessionLoad(session);
      if (totalLoad <= 0) return;

      let cLoad =
        typeof session.loadCardio === 'number' && Number.isFinite(session.loadCardio)
          ? session.loadCardio
          : isForce
          ? totalLoad * 0.45
          : totalLoad;
      let mLoad =
        typeof session.loadMusc === 'number' && Number.isFinite(session.loadMusc)
          ? session.loadMusc
          : isCardio
          ? totalLoad * (session.sport === 'bike' ? 0.55 : 0.78)
          : totalLoad;

      // Pondération mécanique du dénivelé sur la fatigue périphérique en course/trail
      const { elevationGainM } = extractSessionTelemetry(session);
      if (elevationGainM >= 200 && session.sport !== 'bike') {
        const elevBonus = Math.min(180, Math.round((elevationGainM / 100) * 14));
        mLoad += elevBonus;
      }

      // Pondération excentrique si séance marquée excentrique/descente
      if (session.isEccentric || qId === 'descente') {
        mLoad *= 1.15;
      }

      cLoad = Math.max(0, cLoad);
      mLoad = Math.max(0, mLoad);

      dailyCardio.set(dateStr, (dailyCardio.get(dateStr) || 0) + cLoad);
      dailyMusc.set(dateStr, (dailyMusc.get(dateStr) || 0) + mLoad);
    });
  });

  let cardioCtl = 0;
  let cardioAtl = 0;
  let muscCtl = 0;
  let muscAtl = 0;

  const series: DualBanisterPoint[] = [];

  for (let offset = -totalPast; offset <= futureDays; offset++) {
    const dt = addDays(todayDate, offset);
    const dateStr = getLocalYYYYMMDD(dt);
    const cLoad = Math.round(dailyCardio.get(dateStr) || 0);
    const mLoad = Math.round(dailyMusc.get(dateStr) || 0);

    cardioAtl = cardioAtl + alphaAtl * (cLoad - cardioAtl);
    cardioCtl = cardioCtl + alphaCtl * (cLoad - cardioCtl);
    muscAtl = muscAtl + alphaAtl * (mLoad - muscAtl);
    muscCtl = muscCtl + alphaCtl * (mLoad - muscCtl);

    if (offset >= -historyDays) {
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      series.push({
        dateStr,
        label: `${dd}/${mm}`,
        isToday: dateStr === todayStr,
        isFuture: offset > 0,
        cardioLoad: cLoad,
        muscLoad: mLoad,
        cardioCtl: Math.round(cardioCtl * 10) / 10,
        cardioAtl: Math.round(cardioAtl * 10) / 10,
        cardioTsb: Math.round((cardioCtl - cardioAtl) * 10) / 10,
        muscCtl: Math.round(muscCtl * 10) / 10,
        muscAtl: Math.round(muscAtl * 10) / 10,
        muscTsb: Math.round((muscCtl - muscAtl) * 10) / 10,
      });
    }
  }

  const todayPoint =
    series.find((p) => p.isToday) ||
    series[series.length - 1] || {
      dateStr: todayStr,
      label: '',
      isToday: true,
      isFuture: false,
      cardioLoad: 0,
      muscLoad: 0,
      cardioCtl: 0,
      cardioAtl: 0,
      cardioTsb: 0,
      muscCtl: 0,
      muscAtl: 0,
      muscTsb: 0,
    };

  // Répartition 7 derniers jours
  const last7 = series.filter((p) => !p.isFuture).slice(-7);
  const sumC7 = last7.reduce((acc, p) => acc + p.cardioLoad, 0);
  const sumM7 = last7.reduce((acc, p) => acc + p.muscLoad, 0);
  const sumTotal7 = sumC7 + sumM7;
  const cardioShare7d = sumTotal7 > 0 ? Math.round((sumC7 / sumTotal7) * 100) : 50;
  const muscularShare7d = sumTotal7 > 0 ? 100 - cardioShare7d : 50;

  const cTsb = todayPoint.cardioTsb;
  const mTsb = todayPoint.muscTsb;
  const gap = cTsb - mTsb;

  let limitingFactor: DualBanisterResult['limitingFactor'] = 'balanced';
  let limitingLabel = 'Équilibre cardio / musculaire';
  let summary =
    'Vos deux compartiments absorbent la charge de manière homogène. Continuez votre planification hybride.';

  if (cTsb >= 2 && mTsb >= 2) {
    limitingFactor = 'fresh';
    limitingLabel = 'Fraîcheur globale disponible';
    summary =
      'Système cardiovasculaire et tissus musculaires sont tous deux frais : fenêtre idéale pour une séance clé ou un test.';
  } else if (cTsb <= -15 && mTsb <= -15 && Math.abs(gap) < 15) {
    limitingFactor = 'both';
    limitingLabel = 'Fatigue centrale et périphérique';
    summary =
      'Double surcharge cardio et musculaire : privilégiez 24 à 48 h de récupération active (Z1) ou de repos.';
  } else if (mTsb <= -10 && gap >= 8) {
    limitingFactor = 'muscular';
    limitingLabel = 'Facteur limitant : fatigue musculaire';
    summary =
      'Le cœur est plus frais que les tissus musculaires/tendineux : préférez du vélo facile ou du haut du corps.';
  } else if (cTsb <= -10 && gap <= -8) {
    limitingFactor = 'cardio';
    limitingLabel = 'Facteur limitant : fatigue cardio / SNC';
    summary =
      'Système aérobie sollicité mais fraîcheur musculaire supérieure : évitez les hautes intensités cardio aujourd’hui.';
  } else if (cTsb <= -15 && mTsb <= -15) {
    limitingFactor = 'both';
    limitingLabel = 'Fatigue centrale et périphérique';
    summary =
      'Double surcharge cardio et musculaire : privilégiez 24 à 48 h de récupération active (Z1) ou de repos.';
  }

  return {
    series,
    today: todayPoint,
    limitingFactor,
    limitingLabel,
    summary,
    cardioShare7d,
    muscularShare7d,
  };
}

// ============================================================================
// 3. DÉTECTEUR D'EFFET D'INTERFÉRENCE (CONCURRENT TRAINING — HICKSON / WILSON)
// ============================================================================

export type InterferenceSeverity = 'critical' | 'warning';

export interface InterferenceConflict {
  id: string;
  dateStr: string;
  relatedDateStr: string;
  severity: InterferenceSeverity;
  type: 'eccentric_to_intensity' | 'same_day_interference' | 'double_lower_stress';
  title: string;
  detail: string;
  recommendation: string;
  qualityIds: string[];
  isSimulated: boolean;
}

export interface InterferenceAnalysis {
  conflicts: InterferenceConflict[];
  conflictsByDate: Record<string, InterferenceConflict[]>;
  upcomingConflicts: InterferenceConflict[];
  criticalCount: number;
  warningCount: number;
}

const LOWER_HEAVY_IDS = new Set(['leg', 'descente', 'plyo']);
const HIGH_INTENSITY_CARDIO_IDS = new Set(['vo2max', 'sprint', 'seuil']);
const NEURAL_SPEED_IDS = new Set(['vo2max', 'sprint', 'plyo']);

/**
 * Analyse les collisions temporelles (0 à 48h) entre force lourde / excentrique
 * et haute intensité cardio / neuromusculaire.
 */
export function detectTrainingInterference(
  events: EventsByQuality,
  qualities: Quality[] = [],
  referenceDateStr?: string
): InterferenceAnalysis {
  const qualityNameById = new Map<string, string>();
  qualities.forEach((q) => qualityNameById.set(q.id, q.name));
  const qName = (id: string) => qualityNameById.get(id) || id;

  // Regrouper toutes les séances primaires par date
  const byDate = new Map<
    string,
    Array<{ qId: string; session: SessionData; load: number; isSimulated: boolean }>
  >();

  Object.entries(events || {}).forEach(([qId, qDates]) => {
    if (!qDates) return;
    Object.entries(qDates).forEach(([dateStr, session]) => {
      if (!session || !isPrimary(session)) return;
      const load = extractSessionLoad(session);
      if (load <= 0) return;
      const list = byDate.get(dateStr) || [];
      list.push({ qId, session, load, isSimulated: Boolean(session.isSimulated) });
      byDate.set(dateStr, list);
    });
  });

  const sortedDates = Array.from(byDate.keys()).sort();
  const conflicts: InterferenceConflict[] = [];
  const seenIds = new Set<string>();

  const pushConflict = (conflict: InterferenceConflict) => {
    if (seenIds.has(conflict.id)) return;
    seenIds.add(conflict.id);
    conflicts.push(conflict);
  };

  for (let i = 0; i < sortedDates.length; i++) {
    const d1 = sortedDates[i];
    const daySessions = byDate.get(d1) || [];

    // 1. Conflit même jour : Force jambes lourde + Cardio intense (mTOR vs AMPK / fatigue centrale)
    const lowerHeavySameDay = daySessions.filter(
      (s) =>
        LOWER_HEAVY_IDS.has(s.qId) ||
        (s.session.isEccentric && s.load >= 200)
    );
    const cardioIntenseSameDay = daySessions.filter(
      (s) => HIGH_INTENSITY_CARDIO_IDS.has(s.qId) && s.load >= 150
    );

    if (lowerHeavySameDay.length > 0 && cardioIntenseSameDay.length > 0) {
      const heavy = lowerHeavySameDay[0];
      const cardio = cardioIntenseSameDay[0];
      const isCrit = heavy.qId === 'leg' || heavy.qId === 'descente' || cardio.qId === 'vo2max';
      pushConflict({
        id: `same_day_${d1}_${heavy.qId}_${cardio.qId}`,
        dateStr: d1,
        relatedDateStr: d1,
        severity: isCrit ? 'critical' : 'warning',
        type: 'same_day_interference',
        title: `Interférence même jour : ${qName(heavy.qId)} + ${qName(cardio.qId)}`,
        detail:
          'Combiner force/excentrique bas du corps et haute intensité cardio sur 24h réduit les adaptations force (signal mTOR) et la qualité d’allure.',
        recommendation:
          'Espacez d’au moins 6 à 8h (cardio intense en premier ou force en premier selon votre priorité de bloc), ou décalez l’une des deux séances de 24h.',
        qualityIds: [heavy.qId, cardio.qId],
        isSimulated: heavy.isSimulated || cardio.isSimulated,
      });
    }

    // 2. Conflit J -> J+1 : Force jambes / Excentrique Descente suivi <24-36h par VO2max / Sprint / Plyo
    const nextDateStr = getLocalYYYYMMDD(addDays(new Date(`${d1}T12:00:00`), 1));
    const nextDaySessions = byDate.get(nextDateStr) || [];

    if (lowerHeavySameDay.length > 0 && nextDaySessions.length > 0) {
      const heavy = lowerHeavySameDay[0];

      const nextSpeedOrIntensity = nextDaySessions.find(
        (s) => NEURAL_SPEED_IDS.has(s.qId) && s.qId !== heavy.qId && s.load >= 120
      );
      if (nextSpeedOrIntensity) {
        pushConflict({
          id: `ecc_int_${d1}_${nextDateStr}_${heavy.qId}_${nextSpeedOrIntensity.qId}`,
          dateStr: nextDateStr,
          relatedDateStr: d1,
          severity: 'critical',
          type: 'eccentric_to_intensity',
          title: `Collision 24h : ${qName(heavy.qId)} → ${qName(nextSpeedOrIntensity.qId)}`,
          detail:
            'Les micro-lésions excentriques culminent à 24–48h : placer une séance explosive ou VO2max le lendemain augmente le risque tendineux et dégrade la puissance.',
          recommendation:
            'Intercalez un jour d’Endurance Fondamentale (Z1/Z2), de vélo souple ou de haut du corps avant cette séance intense.',
          qualityIds: [heavy.qId, nextSpeedOrIntensity.qId],
          isSimulated: heavy.isSimulated || nextSpeedOrIntensity.isSimulated,
        });
      }

      const nextHeavyLower = nextDaySessions.find(
        (s) =>
          (LOWER_HEAVY_IDS.has(s.qId) || s.session.isEccentric) &&
          s.load >= 180
      );
      if (nextHeavyLower) {
        pushConflict({
          id: `double_lower_${d1}_${nextDateStr}_${heavy.qId}_${nextHeavyLower.qId}`,
          dateStr: nextDateStr,
          relatedDateStr: d1,
          severity: 'warning',
          type: 'double_lower_stress',
          title: `Double stress bas du corps : ${qName(heavy.qId)} → ${qName(nextHeavyLower.qId)}`,
          detail:
            'Deux séances exigeantes sur les membres inférieurs en 2 jours consécutifs limitent la récupération tendineuse et neuromusculaire.',
          recommendation:
            'Décalez la 2e séance bas du corps de 24h ou remplacez-la par du haut du corps / gainage.',
          qualityIds: [heavy.qId, nextHeavyLower.qId],
          isSimulated: heavy.isSimulated || nextHeavyLower.isSimulated,
        });
      }
    }
  }

  // Tri du plus récent / critique en premier
  conflicts.sort((a, b) => {
    const dateDiff = b.dateStr.localeCompare(a.dateStr);
    if (dateDiff !== 0) return dateDiff;
    return a.severity === 'critical' && b.severity !== 'critical' ? -1 : 1;
  });

  const conflictsByDate: Record<string, InterferenceConflict[]> = {};
  for (const c of conflicts) {
    if (!conflictsByDate[c.dateStr]) conflictsByDate[c.dateStr] = [];
    conflictsByDate[c.dateStr].push(c);
  }

  const todayRef = referenceDateStr || getLocalYYYYMMDD(new Date());
  const windowStart = getLocalYYYYMMDD(addDays(new Date(`${todayRef}T12:00:00`), -2));
  const windowEnd = getLocalYYYYMMDD(addDays(new Date(`${todayRef}T12:00:00`), 7));

  const upcomingConflicts = conflicts.filter(
    (c) => c.dateStr >= windowStart && c.dateStr <= windowEnd
  );

  return {
    conflicts,
    conflictsByDate,
    upcomingConflicts,
    criticalCount: upcomingConflicts.filter((c) => c.severity === 'critical').length,
    warningCount: upcomingConflicts.filter((c) => c.severity === 'warning').length,
  };
}

// ============================================================================
// 4. BRIEFING QUOTIDIEN COMPOSITE (« AUJOURD'HUI EN 5 SECONDES »)
// ============================================================================

export type BriefingTrafficLight = 'green' | 'amber' | 'red';

export interface DailyBriefingSignal {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}

export interface DailyBriefingResult {
  status: BriefingTrafficLight;
  badgeText: string;
  headline: string;
  actionTip: string;
  signals: DailyBriefingSignal[];
  activeConflictsCount: number;
  topConflict: InterferenceConflict | null;
}

export function computeDailyBriefing(params: {
  dailyMetrics: Record<string, DailyMetrics>;
  dualBanister: DualBanisterResult;
  interference: InterferenceAnalysis;
  todayStr?: string;
}): DailyBriefingResult {
  const { dailyMetrics, dualBanister, interference } = params;
  const todayStr = params.todayStr || getLocalYYYYMMDD(new Date());
  const tomorrowStr = getLocalYYYYMMDD(addDays(new Date(`${todayStr}T12:00:00`), 1));

  const todayMetrics = dailyMetrics?.[todayStr];
  const vfcAnalysis = computeVfcAnalysis(dailyMetrics, todayStr);
  const hrAnalysis = computeHrRestAnalysis(dailyMetrics, todayStr);

  const todayConflicts = [
    ...(interference.conflictsByDate[todayStr] || []),
    ...(interference.conflictsByDate[tomorrowStr] || []),
  ];
  const criticalToday = todayConflicts.some((c) => c.severity === 'critical');

  let redPoints = 0;
  let amberPoints = 0;
  const signals: DailyBriefingSignal[] = [];

  // Signal 1 : VFC
  if (vfcAnalysis.currentValue !== null) {
    const isRed = vfcAnalysis.status === 'low';
    const isWarn =
      !isRed &&
      (vfcAnalysis.status === 'high' || vfcAnalysis.dayStatus === 'low');
    if (isRed) redPoints += 2;
    else if (isWarn) amberPoints += 1;
    signals.push({
      label: 'VFC',
      value: `${Math.round(vfcAnalysis.currentValue)} ms`,
      tone: isRed
        ? 'bad'
        : isWarn
        ? 'warn'
        : vfcAnalysis.status === 'initializing'
        ? 'neutral'
        : 'good',
    });
  } else {
    signals.push({ label: 'VFC', value: '—', tone: 'neutral' });
  }

  // Signal 2 : FC repos
  if (hrAnalysis.currentValue !== null) {
    const isRed = hrAnalysis.status === 'elevated' && (hrAnalysis.deltaBpm ?? 0) >= 5;
    const isWarn = hrAnalysis.status === 'elevated' && !isRed;
    if (isRed) redPoints += 2;
    else if (isWarn) amberPoints += 1;
    signals.push({
      label: 'FC repos',
      value: `${Math.round(hrAnalysis.currentValue)} bpm`,
      tone: isRed
        ? 'bad'
        : isWarn
        ? 'warn'
        : hrAnalysis.status === 'initializing'
        ? 'neutral'
        : 'good',
    });
  } else if (typeof todayMetrics?.readiness === 'number') {
    const r = todayMetrics.readiness;
    if (r <= 4) redPoints += 2;
    else if (r <= 6) amberPoints += 1;
    signals.push({
      label: 'Readiness',
      value: `${r}/10`,
      tone: r <= 4 ? 'bad' : r <= 6 ? 'warn' : 'good',
    });
  } else {
    signals.push({ label: 'FC repos', value: '—', tone: 'neutral' });
  }

  // Signal 3 : TSB Cardio
  const cTsb = dualBanister.today.cardioTsb;
  if (cTsb <= -22) redPoints += 2;
  else if (cTsb <= -12) amberPoints += 1;
  signals.push({
    label: 'TSB Cardio',
    value: `${cTsb >= 0 ? '+' : ''}${Math.round(cTsb)}`,
    tone: cTsb <= -22 ? 'bad' : cTsb <= -12 ? 'warn' : 'good',
  });

  // Signal 4 : TSB Musculaire
  const mTsb = dualBanister.today.muscTsb;
  if (mTsb <= -22) redPoints += 2;
  else if (mTsb <= -12) amberPoints += 1;
  signals.push({
    label: 'TSB Muscu',
    value: `${mTsb >= 0 ? '+' : ''}${Math.round(mTsb)}`,
    tone: mTsb <= -22 ? 'bad' : mTsb <= -12 ? 'warn' : 'good',
  });

  if (criticalToday) amberPoints += 1;

  let status: BriefingTrafficLight = 'green';
  let badgeText = 'Feu vert';
  let headline = 'Séance clé autorisée';
  let actionTip =
    dualBanister.limitingFactor === 'fresh'
      ? 'Fraîcheur cardio et musculaire optimale : idéal pour une séance prioritaire ou un test.'
      : 'Indicateurs au vert : vous pouvez exécuter votre séance hybride prévue à 100 %.';

  if (redPoints >= 2) {
    status = 'red';
    badgeText = 'Feu rouge';
    headline = 'Récupération ou EF Z1 recommandée';
    actionTip =
      'Fatigue significative détectée (biométrie ou charge aiguë) : privilégiez du repos, de la mobilité ou 30–40 min en Z1 très souple.';
  } else if (amberPoints >= 1) {
    status = 'amber';
    badgeText = 'Feu orange';
    headline =
      dualBanister.limitingFactor === 'muscular'
        ? 'Charge musculaire élevée · préservez les jambes'
        : 'Allégez le volume (−20 %) ou ajustez la priorité';
    actionTip =
      todayConflicts.length > 0
        ? todayConflicts[0].recommendation
        : dualBanister.summary;
  }

  return {
    status,
    badgeText,
    headline,
    actionTip,
    signals,
    activeConflictsCount: todayConflicts.length,
    topConflict: todayConflicts[0] || null,
  };
}

// ============================================================================
// 5. SUIVI LONGITUDINAL DE LA FORCE (e1RM AJUSTÉ AU RIR & PR EN DIRECT)
// ============================================================================

export interface StrengthPoint {
  dateStr: string;
  label: string;
  e1rm: number;
  bestWeightKg: number;
  bestReps: number;
  bestRir: number;
  tonnageKg: number;
  isPR: boolean;
}

export interface ExerciseStrengthHistory {
  exerciseKey: string;
  exerciseName: string;
  category: string;
  currentE1RM: number;
  bestE1RM: number;
  bestSetLabel: string;
  deltaPercent: number | null;
  sessionCount: number;
  lastDateStr: string;
  points: StrengthPoint[];
}

export interface StrengthProgressionSummary {
  exercises: ExerciseStrengthHistory[];
  totalPRCount: number;
  recentPRs: Array<{ exerciseName: string; e1rm: number; dateStr: string; setLabel: string }>;
  totalStrengthSessions: number;
}

/**
 * Formule d'Epley ajustée au RIR (Reps In Reserve) pour estimer le 1RM réel.
 * Borne les répétitions effectives à [1, 15] pour éviter la dérive sur les très hautes reps.
 */
export function estimateSetE1RM(weightKg: number, reps: number, rir: number = 0): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 0;
  if (!Number.isFinite(reps) || reps <= 0) return 0;
  const safeRir = Number.isFinite(rir) ? Math.max(0, Math.min(5, rir)) : 0;
  const effectiveReps = Math.min(15, reps + safeRir);
  if (effectiveReps <= 1) return Math.round(weightKg * 10) / 10;
  return Math.round(weightKg * (1 + effectiveReps / 30) * 10) / 10;
}

function normalizeExerciseKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Construit l'historique e1RM et la détection de PR pour chaque exercice enregistré avec charge externe.
 */
export function computeStrengthProgression(events: EventsByQuality): StrengthProgressionSummary {
  const perExerciseByDate = new Map<
    string,
    {
      name: string;
      category: string;
      byDate: Map<
        string,
        { e1rm: number; bestWeightKg: number; bestReps: number; bestRir: number; tonnageKg: number }
      >;
    }
  >();

  let totalStrengthSessions = 0;

  const inspectExercises = (dateStr: string, exercises: SessionData['exercises']) => {
    if (!Array.isArray(exercises) || exercises.length === 0) return;
    let countedSession = false;

    for (const ex of exercises) {
      if (!ex || typeof ex.name !== 'string' || !ex.name.trim()) continue;
      const key = ex.exerciseCatalogId ? String(ex.exerciseCatalogId) : normalizeExerciseKey(ex.name);
      if (!key) continue;

      let bestE1RM = 0;
      let bestWeightKg = 0;
      let bestReps = 0;
      let bestRir = 0;
      let tonnageKg = 0;

      const detailSets = Array.isArray(ex.detailSets) ? ex.detailSets : [];
      if (detailSets.length > 0) {
        for (const ds of detailSets) {
          if (ds.completed === false) continue;
          const w = Number(ds.weightKg) || 0;
          const r = Number(ds.reps) || 0;
          const rir = typeof ds.rir === 'number' ? ds.rir : Number(ex.rir ?? 2);
          if (w > 0 && r > 0) {
            tonnageKg += w * r;
            const est = estimateSetE1RM(w, r, rir);
            if (est > bestE1RM) {
              bestE1RM = est;
              bestWeightKg = w;
              bestReps = r;
              bestRir = rir;
            }
          }
        }
      } else {
        const w = Number(ex.weightKg) || 0;
        const r = Number(ex.reps) || 0;
        const sets = Math.max(1, Number(ex.sets) || 1);
        const rir = Number(ex.rir ?? 2);
        if (w > 0 && r > 0) {
          tonnageKg += w * r * sets;
          bestE1RM = estimateSetE1RM(w, r, rir);
          bestWeightKg = w;
          bestReps = r;
          bestRir = rir;
        }
      }

      if (bestE1RM <= 0) continue;
      countedSession = true;

      if (!perExerciseByDate.has(key)) {
        const catalogDef = ex.exerciseCatalogId
          ? EXERCISE_CATALOG.find((item) => item.id === ex.exerciseCatalogId)
          : EXERCISE_CATALOG.find((item) => normalizeExerciseKey(item.name) === key);
        const categoryLabel =
          catalogDef?.category === 'lower'
            ? 'Bas du corps'
            : catalogDef?.category === 'upper_push'
            ? 'Push'
            : catalogDef?.category === 'upper_pull'
            ? 'Pull'
            : catalogDef?.category === 'core'
            ? 'Core'
            : 'Force';

        perExerciseByDate.set(key, {
          name: ex.name.trim(),
          category: categoryLabel,
          byDate: new Map(),
        });
      }
      const bucket = perExerciseByDate.get(key)!;
      const prev = bucket.byDate.get(dateStr);
      if (!prev || bestE1RM > prev.e1rm) {
        bucket.byDate.set(dateStr, {
          e1rm: bestE1RM,
          bestWeightKg,
          bestReps,
          bestRir,
          tonnageKg: (prev?.tonnageKg || 0) + Math.round(tonnageKg),
        });
      } else {
        prev.tonnageKg += Math.round(tonnageKg);
      }
    }

    if (countedSession) totalStrengthSessions++;
  };

  Object.values(events || {}).forEach((qDates) => {
    if (!qDates) return;
    Object.entries(qDates).forEach(([dateStr, session]) => {
      if (!session || !isPrimary(session)) return;
      if (Array.isArray(session.exercises) && session.exercises.length > 0) {
        inspectExercises(dateStr, session.exercises);
      }
      if (Array.isArray(session.subSessions)) {
        session.subSessions.forEach((sub) => {
          if (Array.isArray(sub.exercises) && sub.exercises.length > 0) {
            inspectExercises(dateStr, sub.exercises);
          }
        });
      }
    });
  });

  const exercises: ExerciseStrengthHistory[] = [];
  const allPRs: Array<{ exerciseName: string; e1rm: number; dateStr: string; setLabel: string }> = [];

  perExerciseByDate.forEach((entry, key) => {
    const dates = Array.from(entry.byDate.keys()).sort();
    let runningBest = 0;
    let bestPoint: StrengthPoint | null = null;
    const points: StrengthPoint[] = [];

    for (const d of dates) {
      const item = entry.byDate.get(d)!;
      const isPR = item.e1rm > runningBest && runningBest > 0;
      if (item.e1rm > runningBest) {
        runningBest = item.e1rm;
      }
      const [, mm, dd] = d.split('-');
      const pt: StrengthPoint = {
        dateStr: d,
        label: `${dd}/${mm}`,
        e1rm: item.e1rm,
        bestWeightKg: item.bestWeightKg,
        bestReps: item.bestReps,
        bestRir: item.bestRir,
        tonnageKg: item.tonnageKg,
        isPR,
      };
      if (!bestPoint || pt.e1rm >= bestPoint.e1rm) {
        bestPoint = pt;
      }
      if (isPR) {
        allPRs.push({
          exerciseName: entry.name,
          e1rm: pt.e1rm,
          dateStr: d,
          setLabel: `${pt.bestWeightKg} kg × ${pt.bestReps} (RIR ${pt.bestRir})`,
        });
      }
      points.push(pt);
    }

    const first = points[0];
    const last = points[points.length - 1];
    const deltaPercent =
      points.length >= 2 && first.e1rm > 0
        ? Math.round(((last.e1rm - first.e1rm) / first.e1rm) * 1000) / 10
        : null;

    exercises.push({
      exerciseKey: key,
      exerciseName: entry.name,
      category: entry.category,
      currentE1RM: last.e1rm,
      bestE1RM: runningBest,
      bestSetLabel: bestPoint
        ? `${bestPoint.bestWeightKg} kg × ${bestPoint.bestReps} (RIR ${bestPoint.bestRir})`
        : '',
      deltaPercent,
      sessionCount: points.length,
      lastDateStr: last.dateStr,
      points,
    });
  });

  // Trier par nombre de séances puis date la plus récente
  exercises.sort((a, b) => {
    if (b.sessionCount !== a.sessionCount) return b.sessionCount - a.sessionCount;
    return b.lastDateStr.localeCompare(a.lastDateStr);
  });

  allPRs.sort((a, b) => b.dateStr.localeCompare(a.dateStr));

  return {
    exercises,
    totalPRCount: allPRs.length,
    recentPRs: allPRs.slice(0, 6),
    totalStrengthSessions,
  };
}

/**
 * Vérifie en direct (dans le Mode Salle) si une série validée constitue un nouveau PR e1RM.
 */
export function checkLiveSetPR(
  exerciseCatalogId: string,
  exerciseName: string,
  weightKg: number,
  reps: number,
  rir: number,
  historicalEvents: EventsByQuality
): { isPR: boolean; newE1RM: number; previousBestE1RM: number } {
  const newE1RM = estimateSetE1RM(weightKg, reps, rir);
  if (newE1RM <= 0) return { isPR: false, newE1RM: 0, previousBestE1RM: 0 };

  const summary = computeStrengthProgression(historicalEvents);
  const normKey = normalizeExerciseKey(exerciseName);
  const match = summary.exercises.find(
    (e) => e.exerciseKey === exerciseCatalogId || normalizeExerciseKey(e.exerciseName) === normKey
  );

  const previousBestE1RM = match?.bestE1RM || 0;
  return {
    isPR: previousBestE1RM > 0 && newE1RM > previousBestE1RM,
    newE1RM,
    previousBestE1RM,
  };
}
