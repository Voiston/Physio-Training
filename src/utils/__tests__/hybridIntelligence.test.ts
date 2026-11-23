import { describe, it, expect, beforeEach, vi } from 'vitest';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
}
import {
  extractSessionTelemetry,
  computeDualBanister,
  detectTrainingInterference,
  computeDailyBriefing,
  estimateSetE1RM,
  computeStrengthProgression,
  checkLiveSetPR,
} from '../hybridIntelligence';
import {
  PRESET_GYM_TEMPLATES,
  getAllGymTemplates,
  getSavedGymTemplates,
  saveCustomGymTemplate,
  deleteCustomGymTemplate,
} from '../gymTemplates';
import {
  extractGarminTitleSignature,
  getLearnedGarminRules,
  recordGarminClassificationPreference,
  matchLearnedGarminRule,
} from '../garminPreferences';
import { classifyIntervalsActivity } from '../intervalsMapper';
import { computeAllWeeksStats } from '../weekHelpers';
import { DEFAULT_QUALITIES } from '../physiology';
import { EXERCISE_CATALOG } from '../../data/exerciseCatalog';
import type { EventsByQuality, SessionData } from '../../types';
import type { DailyMetrics } from '../../hooks/useMetricsState';

describe('hybridIntelligence — extractSessionTelemetry', () => {
  it('returns dedicated distanceKm and elevationGainM when present', () => {
    const session: SessionData = {
      type: 'primary',
      load: 420,
      duration: 65,
      distanceKm: 12.46,
      elevationGainM: 540.4,
    };
    expect(extractSessionTelemetry(session)).toEqual({
      distanceKm: 12.5,
      elevationGainM: 540,
    });
  });

  it('sums telemetry from subSessions when top-level fields are omitted', () => {
    const session: SessionData = {
      type: 'primary',
      load: 500,
      duration: 80,
      subSessions: [
        { id: '1', load: 300, duration: 45, distanceKm: 8.2, elevationGainM: 210 },
        { id: '2', load: 200, duration: 35, distanceKm: 5.3, elevationGainM: 140 },
      ],
    };
    expect(extractSessionTelemetry(session)).toEqual({
      distanceKm: 13.5,
      elevationGainM: 350,
    });
  });

  it('falls back to parsing legacy Garmin notes when dedicated fields are absent', () => {
    const session: SessionData = {
      type: 'primary',
      load: 480,
      duration: 75,
      notes: 'Trail des crêtes — 14,2 km · +620 m · FC moy 154 bpm',
    };
    expect(extractSessionTelemetry(session)).toEqual({
      distanceKm: 14.2,
      elevationGainM: 620,
    });
  });

  it('returns zeroes for secondary or null sessions', () => {
    expect(extractSessionTelemetry(null)).toEqual({ distanceKm: 0, elevationGainM: 0 });
    expect(
      extractSessionTelemetry({ isSecondary: true, load: 120, distanceKm: 10, elevationGainM: 300 })
    ).toEqual({ distanceKm: 0, elevationGainM: 0 });
  });
});

describe('hybridIntelligence — computeDualBanister', () => {
  it('separates cardio vs muscular fatigue and flags muscular limiting factor on heavy lower + trail D+', () => {
    const refDate = '2026-06-15';
    const events: EventsByQuality = {
      leg: {
        '2026-06-13': { load: 300, loadCardio: 60, loadMusc: 320, duration: 55, sport: 'muscu', isEccentric: true },
        '2026-06-15': { load: 320, loadCardio: 65, loadMusc: 340, duration: 60, sport: 'muscu', isEccentric: true },
      },
      descente: {
        '2026-06-14': { load: 280, loadCardio: 80, loadMusc: 290, duration: 60, sport: 'run', elevationGainM: 900, isEccentric: true },
      },
    };

    const result = computeDualBanister(events, DEFAULT_QUALITIES, 14, 5, 7, 28, refDate);
    expect(result.today.dateStr).toBe(refDate);
    expect(result.today.muscAtl).toBeGreaterThan(result.today.cardioAtl);
    expect(result.today.muscTsb).toBeLessThan(result.today.cardioTsb);
    expect(result.limitingFactor).toBe('muscular');
    expect(result.muscularShare7d).toBeGreaterThan(result.cardioShare7d);
  });

  it('identifies cardio limiting factor when bike/cardio volume heavily exceeds muscular load', () => {
    const refDate = '2026-06-15';
    const events: EventsByQuality = {
      seuil: {
        '2026-06-13': { load: 420, loadCardio: 450, loadMusc: 70, duration: 85, sport: 'bike' },
        '2026-06-14': { load: 410, loadCardio: 440, loadMusc: 65, duration: 80, sport: 'bike' },
        '2026-06-15': { load: 430, loadCardio: 460, loadMusc: 70, duration: 85, sport: 'bike' },
      },
    };

    const result = computeDualBanister(events, DEFAULT_QUALITIES, 14, 5, 7, 28, refDate);
    expect(result.today.cardioTsb).toBeLessThan(result.today.muscTsb);
    expect(result.limitingFactor).toBe('cardio');
    expect(result.cardioShare7d).toBeGreaterThan(60);
  });

  it('identifies fresh state after taper following steady chronic load', () => {
    const refDate = '2026-06-25';
    const events: EventsByQuality = { ef: {} };
    // 25 jours de charge chronique suivis de 10 jours d'affûtage
    for (let day = 1; day <= 15; day++) {
      const dd = String(day).padStart(2, '0');
      events.ef[`2026-06-${dd}`] = {
        load: 450,
        loadCardio: 450,
        loadMusc: 420,
        duration: 75,
        sport: 'run',
      };
    }
    const result = computeDualBanister(events, DEFAULT_QUALITIES, 25, 3, 7, 28, refDate);
    expect(result.today.cardioTsb).toBeGreaterThanOrEqual(2);
    expect(result.today.muscTsb).toBeGreaterThanOrEqual(2);
    expect(result.limitingFactor).toBe('fresh');
  });
});

describe('hybridIntelligence — detectTrainingInterference', () => {
  it('detects same-day heavy lower + VO2max interference as critical', () => {
    const events: EventsByQuality = {
      leg: {
        '2026-06-15': { load: 320, duration: 50, sport: 'muscu' },
      },
      vo2max: {
        '2026-06-15': { load: 280, duration: 45, sport: 'run' },
      },
    };
    const analysis = detectTrainingInterference(events, DEFAULT_QUALITIES, '2026-06-15');
    expect(analysis.conflicts.length).toBe(1);
    expect(analysis.conflicts[0].type).toBe('same_day_interference');
    expect(analysis.conflicts[0].severity).toBe('critical');
    expect(analysis.conflictsByDate['2026-06-15']).toHaveLength(1);
    expect(analysis.criticalCount).toBe(1);
  });

  it('detects 24h eccentric-to-intensity collision (Leg J -> VO2max J+1) and simulated flag', () => {
    const events: EventsByQuality = {
      leg: {
        '2026-06-15': { load: 340, duration: 55, sport: 'muscu', isEccentric: true },
      },
      vo2max: {
        '2026-06-16': { load: 260, duration: 40, sport: 'run', isSimulated: true },
      },
    };
    const analysis = detectTrainingInterference(events, DEFAULT_QUALITIES, '2026-06-15');
    expect(analysis.conflicts.some((c) => c.type === 'eccentric_to_intensity')).toBe(true);
    const hit = analysis.conflicts.find((c) => c.type === 'eccentric_to_intensity');
    expect(hit).toBeDefined();
    if (!hit) return;
    expect(hit.dateStr).toBe('2026-06-16');
    expect(hit.severity).toBe('critical');
    expect(hit.isSimulated).toBe(true);
  });

  it('detects double lower stress on consecutive days', () => {
    const events: EventsByQuality = {
      descente: {
        '2026-06-15': { load: 300, duration: 50, sport: 'run', isEccentric: true },
      },
      leg: {
        '2026-06-16': { load: 260, duration: 50, sport: 'muscu' },
      },
    };
    const analysis = detectTrainingInterference(events, DEFAULT_QUALITIES, '2026-06-15');
    expect(analysis.conflicts.some((c) => c.type === 'double_lower_stress')).toBe(true);
    expect(analysis.warningCount).toBe(1);
  });

  it('does not flag Push/Pull upper body paired with easy EF', () => {
    const events: EventsByQuality = {
      push: {
        '2026-06-15': { load: 280, duration: 50, sport: 'muscu' },
      },
      ef: {
        '2026-06-16': { load: 240, duration: 60, sport: 'run' },
      },
    };
    const analysis = detectTrainingInterference(events, DEFAULT_QUALITIES, '2026-06-15');
    expect(analysis.conflicts).toHaveLength(0);
  });
});

describe('hybridIntelligence — computeDailyBriefing', () => {
  it('returns green traffic light when biometrics & Dual-Banister are balanced with no conflicts', () => {
    const todayStr = '2026-06-15';
    const dual = computeDualBanister({}, DEFAULT_QUALITIES, 14, 3, 7, 28, todayStr);
    const interference = detectTrainingInterference({}, DEFAULT_QUALITIES, todayStr);
    const briefing = computeDailyBriefing({
      dailyMetrics: {
        '2026-06-15': { readiness: 8 },
      },
      dualBanister: dual,
      interference,
      todayStr,
    });
    expect(briefing.status).toBe('green');
    expect(briefing.signals).toHaveLength(4);
  });

  it('returns amber traffic light when a critical interference conflict occurs today/tomorrow', () => {
    const todayStr = '2026-06-15';
    const events: EventsByQuality = {
      leg: { '2026-06-15': { load: 210, loadCardio: 80, loadMusc: 140, duration: 45, sport: 'muscu' } },
      vo2max: { '2026-06-16': { load: 200, loadCardio: 200, loadMusc: 120, duration: 40, sport: 'run' } },
    };
    const dual = computeDualBanister({}, DEFAULT_QUALITIES, 14, 3, 7, 28, todayStr);
    const interference = detectTrainingInterference(events, DEFAULT_QUALITIES, todayStr);
    const briefing = computeDailyBriefing({
      dailyMetrics: {},
      dualBanister: dual,
      interference,
      todayStr,
    });
    expect(briefing.status).toBe('amber');
    expect(briefing.activeConflictsCount).toBe(1);
  });

  it('returns red traffic light when readiness is critical (<=4) or acute Dual-TSB crashes', () => {
    const todayStr = '2026-06-15';
    const dual = computeDualBanister({}, DEFAULT_QUALITIES, 14, 3, 7, 28, todayStr);
    const interference = detectTrainingInterference({}, DEFAULT_QUALITIES, todayStr);
    const metrics: Record<string, DailyMetrics> = {
      '2026-06-15': { readiness: 3 },
    };
    const briefing = computeDailyBriefing({
      dailyMetrics: metrics,
      dualBanister: dual,
      interference,
      todayStr,
    });
    expect(briefing.status).toBe('red');
  });
});

describe('hybridIntelligence — e1RM, Strength Progression & Live PR check', () => {
  it('computes RIR-adjusted Epley e1RM accurately and clamps effective reps at 15', () => {
    // 100 kg x 5 reps @ RIR 1 -> effectiveReps = 6 -> 100 * (1 + 6/30) = 120.0
    expect(estimateSetE1RM(100, 5, 1)).toBe(120);
    // Single max rep @ RIR 0 -> returns weight itself
    expect(estimateSetE1RM(115, 1, 0)).toBe(115);
    // Clamped at 15 effective reps: 60 * (1 + 15/30) = 90
    expect(estimateSetE1RM(60, 20, 3)).toBe(90);
    // Invalid inputs
    expect(estimateSetE1RM(0, 5, 1)).toBe(0);
    expect(estimateSetE1RM(80, 0, 1)).toBe(0);
  });

  it('tracks longitudinal progression, detects PRs across sessions, and evaluates checkLiveSetPR', () => {
    const events: EventsByQuality = {
      leg: {
        '2026-05-01': {
          load: 300,
          duration: 50,
          exercises: [
            {
              id: 'ex1',
              exerciseCatalogId: 'squat_barre',
              name: 'Squat Barre (Back Squat)',
              sets: 3,
              reps: 5,
              weightKg: 90,
              rir: 2,
              detailSets: [
                { reps: 5, weightKg: 90, rir: 2, completed: true },
                { reps: 5, weightKg: 95, rir: 2, completed: true },
              ],
            },
          ],
        },
        '2026-05-15': {
          load: 330,
          duration: 55,
          exercises: [
            {
              id: 'ex2',
              exerciseCatalogId: 'squat_barre',
              name: 'Squat Barre (Back Squat)',
              sets: 3,
              reps: 5,
              weightKg: 100,
              rir: 1,
              detailSets: [
                { reps: 5, weightKg: 100, rir: 1, completed: true },
              ],
            },
          ],
        },
      },
    };

    const summary = computeStrengthProgression(events);
    expect(summary.totalStrengthSessions).toBe(2);
    expect(summary.exercises).toHaveLength(1);
    const squat = summary.exercises[0];
    expect(squat.bestE1RM).toBe(120);
    expect(squat.sessionCount).toBe(2);
    expect(squat.points[0].isPR).toBe(false);
    expect(squat.points[1].isPR).toBe(true);
    expect(squat.deltaPercent).toBeGreaterThan(0);
    expect(summary.totalPRCount).toBe(1);

    // Live set beating 120 kg e1RM: 105 kg x 5 @ RIR 1 -> 126 kg
    const prHit = checkLiveSetPR('squat_barre', 'Squat Barre (Back Squat)', 105, 5, 1, events);
    expect(prHit.isPR).toBe(true);
    expect(prHit.newE1RM).toBe(126);
    expect(prHit.previousBestE1RM).toBe(120);

    // Live set below 120 kg e1RM
    const noPr = checkLiveSetPR('squat_barre', 'Squat Barre (Back Squat)', 90, 5, 2, events);
    expect(noPr.isPR).toBe(false);
  });
});

describe('gymTemplates — presets & localStorage persistence', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  it('exposes 3 hybrid presets and persists/deletes custom templates', () => {
    expect(PRESET_GYM_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    expect(getSavedGymTemplates()).toHaveLength(0);
    expect(getAllGymTemplates().length).toBe(PRESET_GYM_TEMPLATES.length);

    const saved = saveCustomGymTemplate({
      name: 'Force Trail Perso',
      qualityId: 'leg',
      description: 'Bloc 4 semaines',
      estimatedMinutes: 50,
      exercises: [
        {
          exerciseCatalogId: 'squat_barre',
          name: 'Squat Barre',
          category: 'Legs',
          sets: 4,
          reps: 5,
          weightKg: 80,
          rir: 2,
          restSeconds: 150,
        },
      ],
    });
    expect(saved).toHaveLength(1);
    expect(getAllGymTemplates().length).toBe(PRESET_GYM_TEMPLATES.length + 1);

    const afterDelete = deleteCustomGymTemplate(saved[0].id);
    expect(afterDelete).toHaveLength(0);
    expect(getSavedGymTemplates()).toHaveLength(0);
  });

  it('ensures every preset exercise matches EXERCISE_CATALOG and uses valid restSeconds options', () => {
    const validIds = new Set(EXERCISE_CATALOG.map((e) => e.id));
    const validRest = new Set([45, 60, 90, 120, 180]);
    for (const tpl of PRESET_GYM_TEMPLATES) {
      for (const ex of tpl.exercises) {
        expect(validIds.has(ex.exerciseCatalogId)).toBe(true);
        expect(validRest.has(ex.restSeconds)).toBe(true);
      }
    }
  });
});

describe('garminPreferences — learning & automatic classification', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  it('extracts normalized signature ignoring stop-words and standalone numbers', () => {
    expect(extractGarminTitleSignature('Sortie Home Trainer 45')).toBe('home trainer');
    expect(extractGarminTitleSignature('Séance Piste Annecy 12')).toBe('piste annecy');
  });

  it('records user override and prioritizes learned rule in classifyIntervalsActivity', () => {
    recordGarminClassificationPreference({
      title: 'Home Trainer Zwift Watopia',
      sport: 'bike',
      qualityId: 'seuil',
      rpeCardio: 8,
      rpeMusc: 7,
    });

    const rules = getLearnedGarminRules();
    expect(rules).toHaveLength(1);
    expect(matchLearnedGarminRule('Home Trainer Zwift Watopia', 'bike', rules)?.qualityId).toBe('seuil');

    const classified = classifyIntervalsActivity(
      {
        id: 'act_99',
        name: 'Home Trainer Zwift Watopia',
        type: 'VirtualRide',
        start_date_local: '2026-06-15T18:00:00',
        moving_time: 3600,
        distance: 34500,
        total_elevation_gain: 420,
      },
      DEFAULT_QUALITIES,
      [],
      rules
    );

    expect(classified).not.toBeNull();
    if (!classified) return;
    expect(classified.suggestedQualityId).toBe('seuil');
    expect(classified.suggestedRpeCardio).toBe(8);
    expect(classified.suggestedRpeMusc).toBe(7);
    expect(classified.classificationReason).toContain('Appris de vos validations');
    expect(classified.distanceKm).toBe(34.5);
    expect(classified.elevationGainM).toBe(420);
  });
});

describe('weekHelpers — weekly distanceKm & elevationGainM aggregation', () => {
  it('aggregates weekly km and D+ from dedicated telemetry fields and legacy notes', () => {
    const refDate = new Date('2026-06-17T12:00:00');
    const events: EventsByQuality = {
      ef: {
        '2026-06-15': { load: 300, duration: 60, sport: 'run', distanceKm: 11.5, elevationGainM: 250 },
        '2026-06-17': { load: 420, duration: 80, sport: 'run', notes: 'Trail 14.5 km · +550 m' },
      },
    };

    const weeks = computeAllWeeksStats(events, DEFAULT_QUALITIES, 1, 0, refDate);
    const currentWeek = weeks.find((w) => w.isCurrentWeek);
    expect(currentWeek).toBeDefined();
    if (!currentWeek) return;
    expect(currentWeek.totalDistanceKm).toBe(26);
    expect(currentWeek.totalElevationGainM).toBe(800);
  });
});
