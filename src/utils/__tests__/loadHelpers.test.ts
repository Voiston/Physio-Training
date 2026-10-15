import { describe, it, expect } from 'vitest';
import type { SessionData } from '../../hooks/useData';
import { 
  getDailyAthleteLoad, 
  getDailyAthleteDuration, 
  isPrimary, 
  extractSessionLoad,
  getNormalizedSessionLoad,
  getNormalizedSessionDuration,
  computeSessionLoad,
  getAthleteBaselineDailyLoad,
  getDailyAthleteSessionCount
} from '../loadHelpers';

describe('loadHelpers - Single Source of Truth for Athlete Load', () => {
  it('correctly identifies primary vs secondary sessions', () => {
    expect(isPrimary(null)).toBe(false);
    expect(isPrimary(undefined)).toBe(false);
    expect(isPrimary({ load: 150 })).toBe(true);
    expect(isPrimary({ load: 150, isSecondary: false })).toBe(true);
    expect(isPrimary({ load: 50, isSecondary: true })).toBe(false);
  });

  it('extracts session load accurately', () => {
    expect(extractSessionLoad(null)).toBe(0);
    expect(extractSessionLoad(undefined)).toBe(0);
    expect(extractSessionLoad(10)).toBe(450); // legacy format 10 * 45 min
    expect(extractSessionLoad({ load: 250 })).toBe(250);
    expect(extractSessionLoad({ duration: 60, rpeMusc: 8, rpeCardio: 6 })).toBe(420);
  });

  it('eliminates double counting of secondary impacts on athlete load', () => {
    // Cas type de l'audit :
    // Une séance de Sprint (charge 100) qui génère 6 impacts secondaires sur d'autres qualités (total 310)
    const testDate = '2026-10-01';
    const events: Record<string, Record<string, any>> = {
      sprint: {
        [testDate]: { load: 100, duration: 30, sport: 'run', isSecondary: false }
      },
      vo2max: {
        [testDate]: { load: 40, duration: 0, isSecondary: true, parentQId: 'sprint' }
      },
      seuil: {
        [testDate]: { load: 30, duration: 0, isSecondary: true, parentQId: 'sprint' }
      },
      force: {
        [testDate]: { load: 60, duration: 0, isSecondary: true, parentQId: 'sprint' }
      },
      plyo: {
        [testDate]: { load: 70, duration: 0, isSecondary: true, parentQId: 'sprint' }
      },
      ef: {
        [testDate]: { load: 20, duration: 0, isSecondary: true, parentQId: 'sprint' }
      }
    };

    // getDailyAthleteLoad doit retourner EXACTEMENT 100, et non 100 + 40 + 30 + 60 + 70 + 20 = 320 !
    const athleteLoad = getDailyAthleteLoad(events, testDate);
    expect(athleteLoad).toBe(100);

    // Durée réelle de l'athlète : 30 minutes, pas plus
    const athleteDuration = getDailyAthleteDuration(events, testDate);
    expect(athleteDuration).toBe(30);
  });

  it('returns 0 for days without sessions', () => {
    const events = {
      vo2max: { '2026-10-01': { load: 200, isSecondary: false } }
    };
    expect(getDailyAthleteLoad(events, '2026-10-02')).toBe(0);
    expect(getDailyAthleteDuration(events, '2026-10-02')).toBe(0);
  });

  it('computes session load according to physiological domain', () => {
    // Filière Cardio : Durée * RPE Cardio (VO2max 35 min @ RPE 8 = 280 UA)
    expect(computeSessionLoad('vo2max', 35, 8, 6)).toBe(280);
    expect(computeSessionLoad('seuil', 50, 7, 5)).toBe(350);
    expect(computeSessionLoad('ef', 60, 4, 3)).toBe(240);

    // Filière Force : Durée * RPE Musc (* 1.15 si excentrique)
    expect(computeSessionLoad('leg', 45, 6, 8)).toBe(360);
    expect(computeSessionLoad('leg', 45, 6, 8, true)).toBe(414); // 45 * 8 * 1.15 = 414
    expect(computeSessionLoad('pull', 30, 4, 7)).toBe(210);

    // Filière Mixte : Moyenne Cardio & Musc
    expect(computeSessionLoad('sprint', 20, 7, 6)).toBe(130); // (140 + 120) / 2 = 130
    expect(computeSessionLoad('custom_quality', 40, 8, 6)).toBe(280); // (320 + 240) / 2 = 280

    // Durée 0 -> Charge 0
    expect(computeSessionLoad('vo2max', 0, 8, 8)).toBe(0);
  });

  it('calculates athlete baseline daily load from historical events', () => {
    // Cas historique vierge -> fallback standard
    const emptyBaseline = getAthleteBaselineDailyLoad(null);
    expect(emptyBaseline.dailyAvg).toBe(350);
    expect(emptyBaseline.weeklyAvg).toBe(2450);
    expect(emptyBaseline.hasHistoricalData).toBe(false);

    // Cas avec historique récent (ex: 4 séances de 350 UA sur les 7 derniers jours)
    const refDate = new Date('2026-10-15T12:00:00Z');
    const sampleEvents: Record<string, Record<string, any>> = {
      vo2max: {
        '2026-10-14': { load: 350, isSecondary: false },
        '2026-10-12': { load: 350, isSecondary: false },
        '2026-10-10': { load: 350, isSecondary: false },
        '2026-10-08': { load: 350, isSecondary: false }
      }
    };
    const baseline = getAthleteBaselineDailyLoad(sampleEvents, 14, refDate);
    expect(baseline.hasHistoricalData).toBe(true);
    // 4 * 350 = 1400 UA sur 14 jours = 100 UA/j, borné au minimum physiologique de 150 UA/j
    expect(baseline.dailyAvg).toBe(150);
    expect(baseline.weeklyAvg).toBe(1050);
  });

  it('correctly handles multiple sessions (subSessions) on the same day for a quality', () => {
    const testDate = '2026-10-13';
    const multiSessionEvents: Record<string, Record<string, any>> = {
      ef: {
        [testDate]: {
          load: 450, // 270 (matin) + 180 (soir)
          duration: 75, // 45 min + 30 min
          isSecondary: false,
          subSessions: [
            { id: 'sub_1', name: 'Séance 1 (Matin)', duration: 45, load: 270, rpeMusc: 6, rpeCardio: 6 },
            { id: 'sub_2', name: 'Séance 2 (Soir)', duration: 30, load: 180, rpeMusc: 6, rpeCardio: 6 }
          ]
        }
      }
    };

    // getDailyAthleteLoad retourne le total combiné
    expect(getDailyAthleteLoad(multiSessionEvents, testDate)).toBe(450);

    // getDailyAthleteDuration retourne la durée cumulée
    expect(getDailyAthleteDuration(multiSessionEvents, testDate)).toBe(75);

    // getDailyAthleteSessionCount compte bien les 2 séances distinctes
    expect(getDailyAthleteSessionCount(multiSessionEvents, testDate)).toBe(2);
  });

  it('computes isolation as Force with deducted joint load multiplier (0.85)', () => {
    // Séance isolation 20 min @ RPE Musc 8 -> 20 * 8 * 0.85 = 136 UA
    const loadIso = computeSessionLoad('isolation', 20, 2, 8);
    expect(loadIso).toBe(136);

    // Comparaison avec une séance de force standard : 20 * 8 * 1.0 = 160 UA
    const loadStandard = computeSessionLoad('pull', 20, 2, 8);
    expect(loadStandard).toBe(160);
    expect(loadIso).toBeLessThan(loadStandard);
  });

  it('auto-detects legacy RPE (<= 10) vs already consolidated Foster UA (> 10)', () => {
    // Si la valeur est <= 10 (ex: 8), c'est une note RPE sans durée -> forfait 45 min = 8 * 45 = 360 UA
    expect(extractSessionLoad(8)).toBe(360);
    expect(extractSessionLoad(5)).toBe(225);

    // Si la valeur est > 10 (ex: 280), c'est une charge Foster UA déjà consolidée -> conservation directe
    expect(extractSessionLoad(280)).toBe(280);
    expect(extractSessionLoad(450)).toBe(450);
  });
});

describe('P1-03 : Cohérence des multiplicateurs de charge et totaux quotidiens (Grid vs PhysiologyDashboard)', () => {
  it('normalise de manière identique la charge et la durée via getNormalizedSessionLoad et getNormalizedSessionDuration', () => {
    // Événement numérique 6 (échelle RPE <= 10 -> forfait 45 min = 6 * 45 = 270 UA)
    expect(getNormalizedSessionLoad(6)).toBe(270);
    expect(getNormalizedSessionDuration(6)).toBe(45);

    // Événement numérique déjà consolidé en UA (> 10)
    expect(getNormalizedSessionLoad(180)).toBe(180);
    expect(getNormalizedSessionDuration(180)).toBe(45);

    // Objet SessionData
    const sessionObj = { load: 210, duration: 35, isSecondary: false };
    expect(getNormalizedSessionLoad(sessionObj)).toBe(210);
    expect(getNormalizedSessionDuration(sessionObj)).toBe(35);

    // Données invalides ou nulles
    expect(getNormalizedSessionLoad(null)).toBe(0);
    expect(getNormalizedSessionLoad(undefined)).toBe(0);
    expect(getNormalizedSessionDuration(null)).toBe(0);
    expect(getNormalizedSessionDuration(undefined)).toBe(0);
  });

  it('garantit une égalité stricte entre le total de Grid.tsx, PhysiologyDashboard.tsx et getDailyAthleteLoad sur un jeu mixte', () => {
    const testDate = '2026-10-15';

    // Jeu mixte d'événements :
    // 1. Séance objet standard : 150 UA, 30 min (principale)
    // 2. Séance numérique historique 6 : 6 * 45 = 270 UA, 45 min (principale)
    // 3. Impact secondaire généré : 80 UA, 0 min (isSecondary = true -> doit être exclu)
    const mixedEvents: Record<string, Record<string, unknown>> = {
      force: {
        [testDate]: { load: 150, duration: 30, isSecondary: false }
      },
      vo2max: {
        [testDate]: 6 // Valeur numérique RPE
      },
      recup: {
        [testDate]: { load: 80, duration: 0, isSecondary: true }
      }
    };

    // 1. Calcul canonique du moteur athlète
    const athleteLoad = getDailyAthleteLoad(mixedEvents as unknown as Record<string, Record<string, SessionData>>, testDate);
    const athleteDuration = getDailyAthleteDuration(mixedEvents as unknown as Record<string, Record<string, SessionData>>, testDate);

    // 150 + 270 = 420 UA (l'impact secondaire de 80 est exclu)
    expect(athleteLoad).toBe(420);
    expect(athleteDuration).toBe(75); // 30 min + 45 min

    // 2. Simulation de la logique dailyTotals dans Grid.tsx
    let gridDailyLoad = 0;
    let gridDailyDuration = 0;
    let gridSessionCount = 0;

    Object.keys(mixedEvents).forEach(qId => {
      const s = mixedEvents[qId]?.[testDate];
      if (s && isPrimary(s)) {
        gridDailyLoad += extractSessionLoad(s);
        gridDailyDuration += getNormalizedSessionDuration(s);
        gridSessionCount += 1;
      }
    });

    expect(gridDailyLoad).toBe(420);
    expect(gridDailyDuration).toBe(75);
    expect(gridSessionCount).toBe(2);

    // 3. Simulation de la logique chartData dans PhysiologyDashboard.tsx
    let dashboardDailyLoad = 0;
    const dashboardSessions: Array<{ load: number; duration: number }> = [];

    Object.keys(mixedEvents).forEach(qId => {
      const item = mixedEvents[qId]?.[testDate];
      if (item) {
        const sLoad = extractSessionLoad(item);
        const duration = getNormalizedSessionDuration(item);
        const isPrimarySession = isPrimary(item);

        if (isPrimarySession) {
          dashboardDailyLoad += sLoad;
        }

        if ((sLoad > 0 || duration > 0) && isPrimarySession) {
          dashboardSessions.push({ load: sLoad, duration });
        }
      }
    });

    expect(dashboardDailyLoad).toBe(420);
    expect(dashboardSessions).toHaveLength(2);

    // 4. Vérification de la stricte égalité inter-composants
    expect(gridDailyLoad).toBe(dashboardDailyLoad);
    expect(gridDailyLoad).toBe(athleteLoad);
    expect(gridDailyDuration).toBe(athleteDuration);
  });
});



