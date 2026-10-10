import { describe, it, expect } from 'vitest';
import { 
  computeSessionMuscularBreakdown, 
  computeWeeklyMuscularSummary,
  getVolumeLandmark,
  EXERCISE_CATALOG,
  MUSCLE_GROUPS,
  findLastExercisePerformance,
  computeAdaptiveProgression
} from '../muscleHelpers';

describe('Muscle Helpers & Physiological Modeling', () => {
  it('computes breakdown accurately for a compound lower workout (Squat + RDL)', () => {
    const exercises = [
      { id: 'squat', name: 'Squat', sets: 4, reps: 8, rpe: 8 },
      { id: 'rdl', name: 'RDL', sets: 3, reps: 10, rpe: 8 }
    ];

    const result = computeSessionMuscularBreakdown(exercises);

    // Total sets & reps
    expect(result.totalSets).toBe(7);
    expect(result.totalReps).toBe(4 * 8 + 3 * 10); // 32 + 30 = 62
    expect(result.weightedAvgRpe).toBe(8);
    expect(result.suggestedDuration).toBe(Math.round(7 * 3.5)); // 25 min

    // Quadriceps : 4 * 1.0 = 4.0
    expect(result.muscleLoads.quadriceps.effectiveSets).toBe(4);
    expect(result.muscleLoads.quadriceps.directSets).toBe(4);

    // Ischios : 3 * 1.0 (de RDL) = 3.0
    expect(result.muscleLoads.ischios.effectiveSets).toBe(3);
    expect(result.muscleLoads.ischios.directSets).toBe(3);

    // Fessiers : 4 * 0.7 (Squat) + 3 * 0.8 (RDL) = 2.8 + 2.4 = 5.2
    expect(result.muscleLoads.glutes.effectiveSets).toBe(5.2);
  });

  it('computes breakdown for Bench Press & Pull Ups', () => {
    const exercises = [
      { id: 'bench_press', name: 'Développé couché', sets: 4, reps: 8, rpe: 8.5 },
      { id: 'pull_ups', name: 'Tractions', sets: 4, reps: 8, rpe: 9 }
    ];

    const result = computeSessionMuscularBreakdown(exercises);
    expect(result.totalSets).toBe(8);

    // Pectoraux : 4 * 1.0 = 4
    expect(result.muscleLoads.pectoraux.effectiveSets).toBe(4);
    // Triceps : 4 * 0.65 = 2.6
    expect(result.muscleLoads.triceps.effectiveSets).toBe(2.6);
    // Dorsaux : 4 * 1.0 = 4
    expect(result.muscleLoads.dorsaux.effectiveSets).toBe(4);
    // Biceps : 4 * 0.7 = 2.8
    expect(result.muscleLoads.biceps.effectiveSets).toBe(2.8);
  });

  it('evaluates volume landmarks correctly (Israetel / Schoenfeld)', () => {
    expect(getVolumeLandmark(4).status).toBe('under');
    expect(getVolumeLandmark(8).status).toBe('mev');
    expect(getVolumeLandmark(15).status).toBe('mav');
    expect(getVolumeLandmark(24).status).toBe('mrv');
  });

  it('aggregates weekly muscular summary across multiple sessions with ratios', () => {
    const events = {
      leg: {
        '2026-10-05': {
          duration: 60,
          load: 480,
          isSecondary: false,
          exercises: [
            { id: 'squat', name: 'Squat', sets: 4, reps: 8, rpe: 8 },
            { id: 'rdl', name: 'RDL', sets: 4, reps: 8, rpe: 8 }
          ]
        },
        '2026-10-08': {
          duration: 45,
          load: 360,
          isSecondary: false,
          exercises: [
            { id: 'leg_curl', name: 'Leg curl', sets: 4, reps: 10, rpe: 8 },
            { id: 'leg_extension', name: 'Leg extension', sets: 4, reps: 12, rpe: 8 }
          ]
        }
      },
      push: {
        '2026-10-06': {
          duration: 50,
          load: 400,
          isSecondary: false,
          exercises: [
            { id: 'bench_press', name: 'Développé couché', sets: 5, reps: 8, rpe: 8 }
          ]
        }
      },
      pull: {
        '2026-10-07': {
          duration: 50,
          load: 400,
          isSecondary: false,
          exercises: [
            { id: 'pull_ups', name: 'Tractions', sets: 5, reps: 8, rpe: 8 }
          ]
        }
      }
    };

    const summary = computeWeeklyMuscularSummary(events, '2026-10-05', '2026-10-11');
    expect(summary.totalSessionsWithExercises).toBe(4);

    // Quad: 4 (Squat) + 4 (Leg extension) = 8
    expect(summary.muscles.quadriceps.effectiveSets).toBe(8);
    expect(summary.muscles.quadriceps.volumeStatus).toBe('mev');

    // Ischios: 4 (RDL) + 4 (Leg curl) = 8
    expect(summary.muscles.ischios.effectiveSets).toBe(8);

    // H:Q ratio = 8 / 8 = 1.0
    expect(summary.hqRatio).toBe(1);

    // Pull:Push ratio
    // Push sets: Pectoraux (5), Triceps (5 * 0.65 = 3.3), Deltoïdes ant (5 * 0.5 = 2.5)
    // Pull sets: Dorsaux (5), Biceps (5 * 0.7 = 3.5), Trapèzes (5 * 0.5 = 2.5)
    expect(summary.pushPullRatio).toBeDefined();
  });

  it('handles micro-sessions: 5 sets of biceps curl with short duration & targeted stimulus', () => {
    const exercises = [
      { id: 'biceps_curl', name: 'Curl Biceps', sets: 5, reps: 10, rir: 2, rpe: 8 }
    ];

    const result = computeSessionMuscularBreakdown(exercises, [], true);
    expect(result.totalSets).toBe(5);
    // Micro-session duration: Math.max(5, Math.round(5 * 2)) = 10 min
    expect(result.suggestedDuration).toBe(10);
    expect(result.suggestedRpeMusc).toBe(8);

    // Biceps has 5 direct sets, Dorsaux has 0 sets
    expect(result.muscleLoads.biceps.effectiveSets).toBe(5);
    expect(result.muscleLoads.biceps.directSets).toBe(5);
    expect(result.muscleLoads.dorsaux.effectiveSets).toBe(0);
  });

  it('aggregates micro-session logged under isolation quality without touching pull back window', () => {
    const events: Record<string, any> = {
      isolation: {
        '2026-10-09': {
          duration: 10,
          load: 80,
          isSecondary: false,
          exercises: [
            { id: 'biceps_curl', name: 'Curl Biceps', sets: 5, reps: 10, rir: 2, rpe: 8 }
          ]
        }
      }
    };

    const summary = computeWeeklyMuscularSummary(events, '2026-10-05', '2026-10-11');
    expect(summary.totalSessionsWithExercises).toBe(1);
    expect(summary.muscles.biceps.effectiveSets).toBe(5);
    expect(summary.muscles.dorsaux.effectiveSets).toBe(0);
    // Events for 'pull' remain completely unpopulated
    expect(events.pull).toBeUndefined();
  });

  describe('Adaptive Load Suggestion (RIR & Fatigue)', () => {
    it('finds the last exercise performance chronologically across multiple qualities', () => {
      const events: Record<string, any> = {
        pull: {
          '2026-10-01': {
            exercises: [
              { id: 'biceps_curl', name: 'Curl Biceps', sets: 4, reps: 10, weightKg: 14, rir: 2 }
            ],
            fatigue: 4
          }
        },
        isolation: {
          '2026-10-06': {
            exercises: [
              { id: 'biceps_curl', name: 'Curl Biceps', sets: 5, reps: 10, weightKg: 15, rir: 3 }
            ],
            fatigue: 3
          }
        }
      };

      // Searching before 2026-10-10 should find the 2026-10-06 isolation session
      const last = findLastExercisePerformance(events, 'biceps_curl', '2026-10-10');
      expect(last).not.toBeNull();
      expect(last?.date).toBe('2026-10-06');
      expect(last?.qualityId).toBe('isolation');
      expect(last?.exercise.weightKg).toBe(15);
      expect(last?.exercise.rir).toBe(3);

      // Searching before 2026-10-05 should find the 2026-10-01 pull session
      const older = findLastExercisePerformance(events, 'biceps_curl', '2026-10-05');
      expect(older).not.toBeNull();
      expect(older?.date).toBe('2026-10-01');
      expect(older?.exercise.weightKg).toBe(14);
    });

    it('returns new status when exercise has no recorded history', () => {
      const suggestion = computeAdaptiveProgression(null);
      expect(suggestion.hasHistory).toBe(false);
      expect(suggestion.status).toBe('new');
      expect(suggestion.suggestedWeightKg).toBeUndefined();
    });

    it('suggests progressive load increase (+2.5% to +5%) for high RIR and low fatigue', () => {
      const lastPerf = {
        date: '2026-10-05',
        qualityId: 'push',
        exercise: { id: 'bench_press', name: 'Développé couché', sets: 4, reps: 8, weightKg: 80, rir: 3 },
        sessionFatigue: 3
      };

      // RIR 3 (+3.5%) + Fatigue 3 (+1.0%) = +4.5% on 80 kg = 83.6 kg -> rounded to 83.5 kg (+3.5 kg)
      const suggestion = computeAdaptiveProgression(lastPerf, 3);
      expect(suggestion.hasHistory).toBe(true);
      expect(suggestion.status).toBe('increase');
      expect(suggestion.suggestedWeightKg).toBe(83.5);
      expect(suggestion.weightDeltaKg).toBe(3.5);
      expect(suggestion.suggestedRir).toBe(2);
    });

    it('suggests moderate bump (+2%) on optimal RIR 2 with normal fatigue', () => {
      const lastPerf = {
        date: '2026-10-05',
        qualityId: 'isolation',
        exercise: { id: 'biceps_curl', name: 'Curl Biceps', sets: 4, reps: 10, weightKg: 20, rir: 2 },
        sessionFatigue: 4
      };

      // RIR 2 (+2.0%) + Fatigue 4 (+0.5%) = +2.5% on 20 kg = 20.5 kg (+0.5 kg)
      const suggestion = computeAdaptiveProgression(lastPerf, 4);
      expect(suggestion.hasHistory).toBe(true);
      expect(suggestion.status).toBe('increase');
      expect(suggestion.suggestedWeightKg).toBe(20.5);
      expect(suggestion.weightDeltaKg).toBe(0.5);
    });

    it('reduces load for 0 RIR (muscular failure) and elevated fatigue', () => {
      const lastPerf = {
        date: '2026-10-05',
        qualityId: 'push',
        exercise: { id: 'bench_press', name: 'Développé couché', sets: 4, reps: 6, weightKg: 100, rir: 0 },
        sessionFatigue: 8
      };

      // RIR 0 (-2.5%) + Fatigue 8 (-2.5%) = -5% on 100 kg = 95 kg (-5 kg)
      const suggestion = computeAdaptiveProgression(lastPerf, 8);
      expect(suggestion.hasHistory).toBe(true);
      expect(suggestion.status).toBe('decrease');
      expect(suggestion.suggestedWeightKg).toBe(95);
      expect(suggestion.weightDeltaKg).toBe(-5);
      expect(suggestion.suggestedRir).toBe(3); // Safer buffer after failure
    });

    it('handles bodyweight exercise by progressing reps', () => {
      const lastPerf = {
        date: '2026-10-05',
        qualityId: 'pull',
        exercise: { id: 'pull_ups', name: 'Tractions', sets: 4, reps: 8, rir: 3 },
        sessionFatigue: 3
      };

      const suggestion = computeAdaptiveProgression(lastPerf, 3);
      expect(suggestion.hasHistory).toBe(true);
      expect(suggestion.status).toBe('increase');
      expect(suggestion.suggestedWeightKg).toBeUndefined();
      expect(suggestion.suggestedReps).toBe(9); // +1 rep
    });
  });
});
