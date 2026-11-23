import { describe, it, expect } from 'vitest';
import {
  normalizeReadinessScore,
  normalizeIntervalsWellness,
  mapIntervalsSport,
  classifyIntervalsActivity,
  buildSessionFromGarminActivity,
  normalizeIntervalsProxyUrl,
} from '../intervalsMapper';
import { DEFAULT_QUALITIES } from '../physiology';

describe('intervalsMapper', () => {
  it('normalizes Garmin 0-100 readiness and sleepScore to 1-10 scale', () => {
    expect(normalizeReadinessScore({ id: '2026-11-20', readiness: 84 })).toEqual({
      value: 8,
      source: 'readiness',
    });
    expect(normalizeReadinessScore({ id: '2026-11-20', readiness: 7 })).toEqual({
      value: 7,
      source: 'readiness',
    });
    expect(normalizeReadinessScore({ id: '2026-11-20', sleepScore: 92 })).toEqual({
      value: 9,
      source: 'sleepScore',
    });
    expect(normalizeReadinessScore({ id: '2026-11-20', sleepQuality: 2 })).toEqual({
      value: 7,
      source: 'sleepQuality',
    });
  });

  it('filters invalid dates and out-of-range physiological wellness metrics', () => {
    const out = normalizeIntervalsWellness([
      { id: '2026-11-20', hrv: 68.4, restingHR: 47.6, readiness: 82 },
      { id: '2026-02-31', hrv: 70, restingHR: 48 }, // invalid calendar date
      { id: '2026-11-21', hrv: 5, restingHR: 220, sleepScore: 76 }, // out-of-range hrv & hrRest, valid sleepScore
    ]);

    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      dateStr: '2026-11-20',
      vfc: 68,
      hrRest: 48,
      readiness: 8,
      readinessSource: 'readiness',
    });
    expect(out[1]).toEqual({
      dateStr: '2026-11-21',
      readiness: 8,
      readinessSource: 'sleepScore',
    });

    const fallbackOut = normalizeIntervalsWellness([
      {
        id: '2026-11-22',
        hrv: null,
        hrvSDNN: 64.2,
        restingHR: null,
        avgSleepingHR: 51.3,
        readiness: null,
        bodyBattery: 78,
      },
      {
        id: '2026-11-23',
        GarminTrainingReadiness: 74,
      },
    ]);
    expect(fallbackOut).toEqual([
      {
        dateStr: '2026-11-22',
        vfc: 64,
        hrRest: 51,
        readiness: 8,
        readinessSource: 'bodyBattery',
      },
      {
        dateStr: '2026-11-23',
        readiness: 7,
        readinessSource: 'readiness',
      },
    ]);
  });

  it('maps Garmin/Intervals sport types to run, bike, and muscu', () => {
    expect(mapIntervalsSport('Run')).toBe('run');
    expect(mapIntervalsSport('TrailRun')).toBe('run');
    expect(mapIntervalsSport('VirtualRide')).toBe('bike');
    expect(mapIntervalsSport('MountainBikeRide')).toBe('bike');
    expect(mapIntervalsSport('WeightTraining')).toBe('muscu');
  });

  it('classifies activities by title keywords first, then HR zones / IF telemetry', () => {
    const vma = classifyIntervalsActivity(
      {
        id: 'act-1',
        name: 'Séance VMA 30/30 piste',
        type: 'Run',
        start_date_local: '2026-11-20T18:10:00',
        moving_time: 2700,
        distance: 9200,
        average_heartrate: 168,
        icu_intensity: 94,
      },
      DEFAULT_QUALITIES
    );
    expect(vma?.suggestedQualityId).toBe('vo2max');
    expect(vma?.duration).toBe(45);
    expect(vma?.distanceKm).toBe(9.2);
    expect(vma?.suggestedRpeCardio).toBe(8);

    const thresholdByTelemetry = classifyIntervalsActivity(
      {
        id: 'act-2',
        name: 'Sortie midi',
        type: 'Ride',
        start_date_local: '2026-11-21T12:15:00',
        moving_time: 3600,
        icu_intensity: 85,
        icu_hr_zone_times: [300, 900, 1400, 900, 100],
      },
      DEFAULT_QUALITIES
    );
    expect(thresholdByTelemetry?.suggestedQualityId).toBe('seuil');
    expect(thresholdByTelemetry?.sport).toBe('bike');
    expect(thresholdByTelemetry?.suggestedRpeCardio).toBe(7);
    expect(thresholdByTelemetry?.suggestedRpeMusc).toBe(6);

    const easyRun = classifyIntervalsActivity(
      {
        id: 'act-3',
        name: 'Course matinale',
        type: 'Run',
        start_date_local: '2026-11-22T07:30:00',
        moving_time: 3000,
        icu_hr_zone_times: [1200, 1600, 200, 0, 0],
      },
      DEFAULT_QUALITIES
    );
    expect(easyRun?.suggestedQualityId).toBe('ef');
    expect(easyRun?.suggestedRpeCardio).toBe(4);
  });

  it('merges a second same-day activity on the same quality into subSessions without losing data', () => {
    const first = classifyIntervalsActivity(
      {
        id: 'act-am',
        name: 'Footing matin',
        type: 'Run',
        start_date_local: '2026-11-22T07:00:00',
        moving_time: 1800,
      },
      DEFAULT_QUALITIES
    )!;
    const session1 = buildSessionFromGarminActivity(first, 'ef', 4, 4);
    expect(session1.duration).toBe(30);
    expect(session1.load).toBe(120);

    const second = classifyIntervalsActivity(
      {
        id: 'act-pm',
        name: 'Footing soir',
        type: 'Run',
        start_date_local: '2026-11-22T18:00:00',
        moving_time: 2400,
      },
      DEFAULT_QUALITIES
    )!;
    const merged = buildSessionFromGarminActivity(second, 'ef', 5, 5, session1);
    expect(merged.duration).toBe(70);
    expect(merged.load).toBe(120 + 200);
    expect(merged.subSessions).toHaveLength(2);
    expect(merged.subSessions?.[1].id).toBe('icu_act-pm');
  });

  it('validates and normalizes optional proxy URLs while rejecting insecure protocols', () => {
    expect(normalizeIntervalsProxyUrl('https://physio-garmin.user.workers.dev/')).toBe(
      'https://physio-garmin.user.workers.dev'
    );
    expect(normalizeIntervalsProxyUrl('http://localhost:3000/')).toBe('http://localhost:3000');
    expect(normalizeIntervalsProxyUrl('http://evil.example.com')).toBe('');
    expect(normalizeIntervalsProxyUrl('javascript:alert(1)')).toBe('');
    expect(normalizeIntervalsProxyUrl('https://user:pass@proxy.workers.dev')).toBe('');
    expect(normalizeIntervalsProxyUrl('not-a-url')).toBe('');
    expect(normalizeIntervalsProxyUrl(null)).toBe('');
  });
});
