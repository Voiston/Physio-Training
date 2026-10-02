import { describe, it, expect } from 'vitest';
import { 
  computeFosterMetrics, 
  computeBanisterPerformance, 
  computeCardioVsMuscularBalance,
  computeQualityEMAData
} from '../physiology';
import { getDailyAthleteLoad } from '../loadHelpers';

describe('Phase 1 Physiology Verifications', () => {
  const testDate = '2026-10-01';

  // Cas type de l'audit :
  // Une séance sprint de 100 donne 100 en charge globale dans tous les onglets (pas 320 ou 410 !)
  const eventsWithSecondaries = {
    sprint: {
      [testDate]: { load: 100, duration: 30, sport: 'run', rpeCardio: 8, rpeMusc: 8, isSecondary: false }
    },
    vo2max: {
      [testDate]: { load: 40, duration: 0, isSecondary: true, parentQId: 'sprint' }
    },
    seuil: {
      [testDate]: { load: 30, duration: 0, isSecondary: true, parentQId: 'sprint' }
    },
    leg: {
      [testDate]: { load: 80, duration: 0, isSecondary: true, parentQId: 'sprint' }
    },
    plyo: {
      [testDate]: { load: 80, duration: 0, isSecondary: true, parentQId: 'sprint' }
    },
    co2: {
      [testDate]: { load: 60, duration: 0, isSecondary: true, parentQId: 'sprint' }
    }
  };

  it('A1 Criterion: a 100 load session yields exactly 100 athlete load globally', () => {
    // 1. Single source of truth load
    const athleteLoad = getDailyAthleteLoad(eventsWithSecondaries, testDate);
    expect(athleteLoad).toBe(100);

    // 2. computeFosterMetrics total load on this window
    const foster = computeFosterMetrics(eventsWithSecondaries, testDate, 7);
    expect(foster.totalLoad).toBe(100);

    // 3. computeBanisterPerformance load on testDate
    const banister = computeBanisterPerformance(eventsWithSecondaries, {}, 7, 0, 7, 28);
    const dayData = banister.series.find(s => s.dateStr === testDate);
    expect(dayData).toBeDefined();
    expect(dayData?.load).toBe(100);

    // 4. computeCardioVsMuscularBalance total load
    const balance = computeCardioVsMuscularBalance(eventsWithSecondaries, testDate, 7);
    expect(balance.totalGlobalLoad).toBe(100);
  });

  it('C2 Criterion: ACWR is null when quality has fewer than 4 sessions in past 28 days', () => {
    // Une seule séance sprint
    const sprintEvents = eventsWithSecondaries.sprint;
    const emaData = computeQualityEMAData('sprint', sprintEvents, 45, 0);

    // Doit être null (données insuffisantes) plutôt qu'un ratio aberrant faussement alarmiste
    expect(emaData.current.acwr).toBeNull();
  });

  it('ACWR guard ignores secondary impacts: 4 secondary transfers do NOT trigger a valid ACWR', () => {
    // Une qualité (ex: leg) qui a 4 impacts secondaires transférés mais 0 séance directe
    const secondaryOnlyEvents = {
      '2026-09-20': { load: 50, isSecondary: true, parentQId: 'sprint' },
      '2026-09-22': { load: 50, isSecondary: true, parentQId: 'sprint' },
      '2026-09-25': { load: 50, isSecondary: true, parentQId: 'sprint' },
      '2026-09-28': { load: 50, isSecondary: true, parentQId: 'sprint' },
    };
    const emaData = computeQualityEMAData('leg', secondaryOnlyEvents, 45, 0);
    expect(emaData.current.acwr).toBeNull();
  });
});
