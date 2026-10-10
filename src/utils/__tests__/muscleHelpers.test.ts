import { describe, it, expect } from 'vitest';
import { 
  computeSessionMuscularBreakdown, 
  computeWeeklyMuscularSummary,
  getVolumeLandmark,
  EXERCISE_CATALOG,
  MUSCLE_GROUPS 
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
});
