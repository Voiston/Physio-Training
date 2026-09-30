import { Quality, SessionData } from '../hooks/useData';
import { getLocalYYYYMMDD } from './dateHelpers';

export interface QualityWeeklyBreakdown {
  qualityId: string;
  qualityName: string;
  directLoad: number;
  secondaryLoad: number;
  totalLoad: number;
  durationMinutes: number;
  sessionCount: number;
  percentOfTotalLoad: number;
  deltaLoadVsPrevWeek: number;
  percentChangeVsPrevWeek: number | null;
}

export interface SportWeeklyBreakdown {
  load: number;
  durationMinutes: number;
  sessionCount: number;
  percentOfTotal: number;
}

export interface WeekComparison {
  prevWeekId: string | null;
  prevWeekLabel: string | null;
  deltaLoad: number;
  percentLoadChange: number | null; // e.g. +12.5%
  deltaDurationMinutes: number;
  percentDurationChange: number | null;
  deltaSessions: number;
  trend: 'up' | 'down' | 'flat';
  progressionStatus: 'safe' | 'optimal' | 'warning' | 'danger' | 'deload' | 'neutral';
  statusBadge: string;
  statusColor: string;
  advice: string;
}

export interface WeekStats {
  weekId: string; // e.g. "2026-W39"
  weekNumber: number;
  year: number;
  startDate: string; // YYYY-MM-DD (Monday)
  endDate: string; // YYYY-MM-DD (Sunday)
  label: string; // e.g. "Semaine 39 (22 Sep - 28 Sep)"
  shortLabel: string; // e.g. "S39"
  relativeLabel: string; // e.g. "S0 (En cours)", "S-1", "S+1"
  isCurrentWeek: boolean;
  isPastWeek: boolean;
  isFutureWeek: boolean;
  days: string[]; // 7 dates [Mon...Sun]
  totalLoad: number; // Primary sessions total (actual athlete load)
  qualitiesCumulativeLoad: number; // Sum of direct + secondary across all qualities
  totalDurationMinutes: number;
  totalDurationFormatted: string; // e.g. "5h 45m"
  sessionCount: number;
  dailyLoads: { dateStr: string; dayName: string; load: number; duration: number }[];
  meanDailyLoad: number;
  stdDevLoad: number;
  monotony: number;
  strain: number;
  acwr: number | null; // Acute (this week) to Chronic (prior 4 weeks average)
  sports: {
    bike: SportWeeklyBreakdown;
    run: SportWeeklyBreakdown;
    other: SportWeeklyBreakdown;
  };
  qualitiesBreakdown: QualityWeeklyBreakdown[];
  comparison: WeekComparison;
}

/**
 * Retourne le lundi de la semaine contenant la date passée en paramètre
 */
export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  // En JS, 0 = Dimanche, 1 = Lundi, ..., 6 = Samedi
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Calcule le numéro de semaine ISO (1 à 53)
 */
export function getISOWeekNumber(d: Date): { week: number; year: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week: weekNo, year: date.getUTCFullYear() };
}

/**
 * Formate des minutes en affichage lisible (ex: 75 -> "1h 15m", 45 -> "45m")
 */
export function formatMinutes(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

const MONTH_NAMES_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const DAY_NAMES_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/**
 * Analyse la progression de charge entre deux semaines
 */
export function analyzeLoadProgression(currentLoad: number, prevLoad: number): {
  status: 'safe' | 'optimal' | 'warning' | 'danger' | 'deload' | 'neutral';
  badge: string;
  color: string;
  advice: string;
  percent: number | null;
} {
  if (prevLoad === 0 && currentLoad === 0) {
    return {
      status: 'neutral',
      badge: '— Neutre',
      color: 'slate',
      advice: 'Aucune charge enregistrée sur ces périodes.',
      percent: null
    };
  }
  if (prevLoad === 0 && currentLoad > 0) {
    return {
      status: 'optimal',
      badge: '🚀 Reprise (+100%)',
      color: 'emerald',
      advice: 'Reprise progressive de l\'entraînement.',
      percent: 100
    };
  }

  const delta = currentLoad - prevLoad;
  const percent = Math.round((delta / prevLoad) * 100);

  if (percent < -20) {
    return {
      status: 'deload',
      badge: `📉 Décharge (${percent}%)`,
      color: 'sky',
      advice: 'Semaine de surcompensation ou de régénération active. Idéal pour assimiler les blocs intenses.',
      percent
    };
  }
  if (percent >= -20 && percent <= 5) {
    return {
      status: 'safe',
      badge: `⚖️ Maintien (${percent >= 0 ? `+${percent}` : percent}%)`,
      color: 'slate',
      advice: 'Charge stabilisée. Idéal en phase de consolidation des acquis.',
      percent
    };
  }
  if (percent > 5 && percent <= 15) {
    return {
      status: 'optimal',
      badge: `✅ Progression Optimale (+${percent}%)`,
      color: 'emerald',
      advice: 'Respect parfait de la règle des +10% de Gabbett : adaptation tissulaire sans surcharge excessive.',
      percent
    };
  }
  if (percent > 15 && percent <= 30) {
    return {
      status: 'warning',
      badge: `⚠️ Surchauffe (+${percent}%)`,
      color: 'amber',
      advice: 'Augmentation rapide du volume/intensité. Veillez particulièrement au sommeil et à la nutrition.',
      percent
    };
  }
  return {
    status: 'danger',
    badge: `🚨 Pic de Charge Sévère (+${percent}%)`,
    color: 'rose',
    advice: 'Augmentation brutale de plus de 30% : zone à haut risque de microlésions ou tendinopathies.',
    percent
  };
}

/**
 * Calcule l'ensemble des statistiques hebdomadaires
 */
export function computeAllWeeksStats(
  events: Record<string, Record<string, SessionData>>,
  qualities: Quality[],
  weeksPast: number = 6,
  weeksFuture: number = 2
): WeekStats[] {
  const today = new Date();
  const currentMonday = getMonday(today);
  const currentMondayStr = getLocalYYYYMMDD(currentMonday);

  const rawWeeks: {
    monday: Date;
    days: { date: Date; dateStr: string; dayName: string }[];
    isCurrent: boolean;
    isPast: boolean;
    isFuture: boolean;
    relativeOffset: number;
  }[] = [];

  // Générer la liste des semaines de -weeksPast à +weeksFuture
  for (let w = -weeksPast; w <= weeksFuture; w++) {
    const monday = new Date(currentMonday);
    monday.setDate(currentMonday.getDate() + (w * 7));
    const mondayStr = getLocalYYYYMMDD(monday);

    const days = [];
    for (let d = 0; d < 7; d++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + d);
      days.push({
        date: dayDate,
        dateStr: getLocalYYYYMMDD(dayDate),
        dayName: DAY_NAMES_FR[dayDate.getDay()]
      });
    }

    rawWeeks.push({
      monday,
      days,
      isCurrent: mondayStr === currentMondayStr,
      isPast: w < 0,
      isFuture: w > 0,
      relativeOffset: w
    });
  }

  // Map des qualités pour lookup rapide
  const qualityMap = new Map<string, Quality>(qualities.map(q => [q.id, q]));

  // Première passe : calcul des métriques brutes par semaine
  const computedList: WeekStats[] = rawWeeks.map(rw => {
    const { week: weekNo, year } = getISOWeekNumber(rw.monday);
    const sundayDate = rw.days[6].date;
    const weekId = `${year}-W${String(weekNo).padStart(2, '0')}`;

    const startDateStr = rw.days[0].dateStr;
    const endDateStr = rw.days[6].dateStr;

    const startD = rw.days[0].date.getDate();
    const startM = MONTH_NAMES_FR[rw.days[0].date.getMonth()];
    const endD = sundayDate.getDate();
    const endM = MONTH_NAMES_FR[sundayDate.getMonth()];

    const label = `Semaine ${weekNo} (${startD} ${startM} - ${endD} ${endM})`;
    const shortLabel = `S${weekNo}`;
    
    let relativeLabel = `S${rw.relativeOffset >= 0 ? `+${rw.relativeOffset}` : rw.relativeOffset}`;
    if (rw.relativeOffset === 0) relativeLabel = 'S0 (En cours)';

    let totalLoad = 0;
    let qualitiesCumulativeLoad = 0;
    let totalDurationMinutes = 0;
    let sessionCount = 0;

    const sportsData = {
      bike: { load: 0, durationMinutes: 0, sessionCount: 0, percentOfTotal: 0 },
      run: { load: 0, durationMinutes: 0, sessionCount: 0, percentOfTotal: 0 },
      other: { load: 0, durationMinutes: 0, sessionCount: 0, percentOfTotal: 0 }
    };

    // Suivi par qualité pour cette semaine
    const qualityStatsMap = new Map<string, { directLoad: number; secondaryLoad: number; duration: number; count: number }>();
    qualities.forEach(q => {
      qualityStatsMap.set(q.id, { directLoad: 0, secondaryLoad: 0, duration: 0, count: 0 });
    });

    const dailyLoads: { dateStr: string; dayName: string; load: number; duration: number }[] = [];

    rw.days.forEach(day => {
      let dayLoad = 0;
      let dayDuration = 0;

      // Parcourir toutes les qualités pour ce jour
      qualities.forEach(q => {
        const session = events[q.id]?.[day.dateStr];
        if (session) {
          const sLoad = Number(session.load) || 0;
          const sDuration = Number(session.duration) || 0;
          const isSec = !!session.isSecondary;

          // Cumul pour la qualité
          const qEntry = qualityStatsMap.get(q.id);
          if (qEntry) {
            if (isSec) {
              qEntry.secondaryLoad += sLoad;
            } else {
              qEntry.directLoad += sLoad;
              qEntry.duration += sDuration;
              qEntry.count += 1;
            }
          }
          qualitiesCumulativeLoad += sLoad;

          // Pour le total athlète de la journée (uniquement séances directes/principales pour éviter les doublons de volume)
          if (!isSec) {
            dayLoad += sLoad;
            dayDuration += sDuration;
            sessionCount += 1;

            // Répartition sports
            const sp = session.sport === 'bike' ? 'bike' : session.sport === 'run' ? 'run' : 'other';
            sportsData[sp].load += sLoad;
            sportsData[sp].durationMinutes += sDuration;
            sportsData[sp].sessionCount += 1;
          }
        }
      });

      totalLoad += dayLoad;
      totalDurationMinutes += dayDuration;
      dailyLoads.push({
        dateStr: day.dateStr,
        dayName: day.dayName,
        load: dayLoad,
        duration: dayDuration
      });
    });

    // Pourcentages des sports
    if (totalLoad > 0) {
      sportsData.bike.percentOfTotal = Math.round((sportsData.bike.load / totalLoad) * 100);
      sportsData.run.percentOfTotal = Math.round((sportsData.run.load / totalLoad) * 100);
      sportsData.other.percentOfTotal = Math.round((sportsData.other.load / totalLoad) * 100);
    }

    // Ventilation par qualité
    const qualitiesBreakdown: QualityWeeklyBreakdown[] = qualities.map(q => {
      const stats = qualityStatsMap.get(q.id) || { directLoad: 0, secondaryLoad: 0, duration: 0, count: 0 };
      const qTotal = stats.directLoad + stats.secondaryLoad;
      const pct = totalLoad > 0 ? Math.round((qTotal / totalLoad) * 100) : 0;

      return {
        qualityId: q.id,
        qualityName: q.name,
        directLoad: stats.directLoad,
        secondaryLoad: stats.secondaryLoad,
        totalLoad: qTotal,
        durationMinutes: stats.duration,
        sessionCount: stats.count,
        percentOfTotalLoad: pct,
        deltaLoadVsPrevWeek: 0,
        percentChangeVsPrevWeek: null
      };
    });

    // Monotonie et Strain de Foster sur la semaine
    const meanDailyLoad = Math.round(totalLoad / 7);
    const variance = dailyLoads.reduce((acc, d) => acc + Math.pow(d.load - meanDailyLoad, 2), 0) / 7;
    const stdDevLoad = Math.round(Math.sqrt(variance) * 10) / 10;
    let monotony = 1.0;
    if (stdDevLoad > 0) {
      monotony = Math.round((meanDailyLoad / stdDevLoad) * 100) / 100;
    } else if (meanDailyLoad > 0) {
      monotony = 3.5;
    }
    const strain = Math.round(totalLoad * monotony);

    return {
      weekId,
      weekNumber: weekNo,
      year,
      startDate: startDateStr,
      endDate: endDateStr,
      label,
      shortLabel,
      relativeLabel,
      isCurrentWeek: rw.isCurrent,
      isPastWeek: rw.isPast,
      isFutureWeek: rw.isFuture,
      days: rw.days.map(d => d.dateStr),
      totalLoad,
      qualitiesCumulativeLoad,
      totalDurationMinutes,
      totalDurationFormatted: formatMinutes(totalDurationMinutes),
      sessionCount,
      dailyLoads,
      meanDailyLoad,
      stdDevLoad,
      monotony,
      strain,
      acwr: null, // Calculé dans la 2ème passe
      sports: sportsData,
      qualitiesBreakdown,
      comparison: {
        prevWeekId: null,
        prevWeekLabel: null,
        deltaLoad: 0,
        percentLoadChange: null,
        deltaDurationMinutes: 0,
        percentDurationChange: null,
        deltaSessions: 0,
        trend: 'flat',
        progressionStatus: 'neutral',
        statusBadge: '— Neutre',
        statusColor: 'slate',
        advice: ''
      }
    };
  });

  // Deuxième passe : calcul des deltas vs semaine précédente (S-1) et ACWR
  for (let i = 0; i < computedList.length; i++) {
    const cur = computedList[i];
    const prev = i > 0 ? computedList[i - 1] : null;

    if (prev) {
      const deltaLoad = cur.totalLoad - prev.totalLoad;
      const progression = analyzeLoadProgression(cur.totalLoad, prev.totalLoad);
      const deltaDuration = cur.totalDurationMinutes - prev.totalDurationMinutes;
      const percentDuration = prev.totalDurationMinutes > 0
        ? Math.round((deltaDuration / prev.totalDurationMinutes) * 100)
        : null;
      const deltaSessions = cur.sessionCount - prev.sessionCount;

      cur.comparison = {
        prevWeekId: prev.weekId,
        prevWeekLabel: prev.shortLabel,
        deltaLoad,
        percentLoadChange: progression.percent,
        deltaDurationMinutes: deltaDuration,
        percentDurationChange: percentDuration,
        deltaSessions,
        trend: deltaLoad > 10 ? 'up' : deltaLoad < -10 ? 'down' : 'flat',
        progressionStatus: progression.status,
        statusBadge: progression.badge,
        statusColor: progression.color,
        advice: progression.advice
      };

      // Mettre à jour les deltas par qualité
      cur.qualitiesBreakdown.forEach(qb => {
        const prevQb = prev.qualitiesBreakdown.find(p => p.qualityId === qb.qualityId);
        if (prevQb) {
          qb.deltaLoadVsPrevWeek = qb.totalLoad - prevQb.totalLoad;
          if (prevQb.totalLoad > 0) {
            qb.percentChangeVsPrevWeek = Math.round((qb.deltaLoadVsPrevWeek / prevQb.totalLoad) * 100);
          }
        }
      });
    }

    // ACWR (Acute:Chronic Workload Ratio)
    // Aiguë = charge de la semaine en cours
    // Chronique = moyenne des 3 à 4 semaines précédentes
    const chronicWeeks = computedList.slice(Math.max(0, i - 4), i);
    if (chronicWeeks.length > 0) {
      const chronicAvg = chronicWeeks.reduce((acc, w) => acc + w.totalLoad, 0) / chronicWeeks.length;
      if (chronicAvg > 0) {
        cur.acwr = Math.round((cur.totalLoad / chronicAvg) * 100) / 100;
      }
    }
  }

  return computedList;
}

export type QualitySortField = 'load' | 'duration' | 'sessions' | 'name' | 'default';

/**
 * Trie la liste des ventilations par qualité
 */
export function sortQualitiesBreakdown(
  breakdown: QualityWeeklyBreakdown[],
  sortBy: QualitySortField,
  descending: boolean = true
): QualityWeeklyBreakdown[] {
  const list = [...breakdown];
  list.sort((a, b) => {
    let diff = 0;
    if (sortBy === 'load') diff = a.totalLoad - b.totalLoad;
    else if (sortBy === 'duration') diff = a.durationMinutes - b.durationMinutes;
    else if (sortBy === 'sessions') diff = a.sessionCount - b.sessionCount;
    else if (sortBy === 'name') return descending ? b.qualityName.localeCompare(a.qualityName) : a.qualityName.localeCompare(b.qualityName);
    else return 0; // default order preserved

    return descending ? -diff : diff;
  });
  return list;
}
