import { describe, it, expect } from 'vitest';
import { 
  computeFosterMetrics, 
  computeBanisterPerformance, 
  computeCardioVsMuscularBalance,
  computeQualityEMAData,
  computeCellState
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

  it('Monotonicity Criterion: computeCellState currentLevel decreases strictly monotonically with days', () => {
    const qVo2 = { id: 'vo2max', name: 'VO2max', g: 7, o: 4, retentionDays: 15, category: 'cardio' };

    // Simulate single session on day 0, and evaluate state on subsequent days
    const baseDate = new Date('2026-10-01');
    const evts = {
      '2026-10-01': { load: 100, duration: 40, rpeCardio: 8, isSecondary: false }
    };

    let prevLevel = 101;
    // Test across green, orange and expired (red) windows
    for (let dayOffset = 0; dayOffset <= 25; dayOffset++) {
      const evalDate = new Date(baseDate);
      evalDate.setDate(baseDate.getDate() + dayOffset);
      const evalStr = evalDate.toISOString().split('T')[0];

      const state = computeCellState(qVo2, evts, evalStr);
      // Niveau doit être strictement décroissant ou égal (pas de bond de 20% à 55% !)
      expect(state.currentLevel).toBeLessThanOrEqual(prevLevel);
      prevLevel = state.currentLevel;
    }
  });

  it('Warmup Invariance: computeQualityEMAData produces identical converged current EMA regardless of daysHistory', () => {
    // Generate 30 days of consistent training
    const historyEvents: Record<string, any> = {};
    const ref = new Date();
    for (let i = 1; i <= 30; i++) {
      const d = new Date(ref);
      d.setDate(ref.getDate() - i);
      const str = d.toISOString().split('T')[0];
      historyEvents[str] = { load: 100, isSecondary: false, isPrimary: true };
    }

    // Call with 14 days vs 45 days
    const res14 = computeQualityEMAData('vo2max', historyEvents, 14, 0);
    const res45 = computeQualityEMAData('vo2max', historyEvents, 45, 0);

    // Both must yield the exact same converged current EMA21
    expect(res14.current.ema21).toBe(res45.current.ema21);
    expect(res14.current.ema7).toBe(res45.current.ema7);
    expect(res14.current.acwr).toBe(res45.current.acwr);
  });

  it('initialCtl seeds ATL and CTL harmoniously without artificial +100% TSB surge', () => {
    const emptyEvents = {};
    const initialCtl = 60;
    const banister = computeBanisterPerformance(emptyEvents, {}, 14, 0, 7, 28, initialCtl);
    const todayData = banister.series.find(s => s.isToday);
    expect(todayData).toBeDefined();
    // Sans le bug (ATL à 0 donnant +100% TSB), ATL et CTL démarrent tous deux en cohérence
    expect(todayData?.ctl).toBe(57.9);
    expect(todayData?.atl).toBe(52);
    expect(todayData?.tsb).toBe(5.9);
    // TSB% est de +10.2%, évitant l'artefact trompeur de sur-fraîcheur extrême à +100%
    expect(todayData?.tsbPercent).toBe(10.2);
  });
});
