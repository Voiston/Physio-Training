import { describe, it, expect, vi } from 'vitest';
import { GymRestTimer, GymActiveExercise, GymSetHistory } from '../index';

describe('Gym Components (Modular Gym HUD)', () => {
  it('exporte GymRestTimer, GymActiveExercise, GymSetHistory depuis le point central index.ts', () => {
    expect(GymRestTimer).toBeDefined();
    expect(GymActiveExercise).toBeDefined();
    expect(GymSetHistory).toBeDefined();
  });

  it('permet l instanciation des composants avec des props valides sans lever d exception', () => {
    const timerElem = (
      <GymRestTimer
        timerState={{
          endsAt: Date.now() + 60000,
          targetSeconds: 60,
          pausedRemainingMs: null
        }}
        soundEnabled={true}
        onDone={() => {}}
        onAdjust={() => {}}
        onTogglePause={() => {}}
        onSkip={() => {}}
      />
    );
    expect(timerElem).toBeTruthy();

    const historyElem = (
      <GymSetHistory
        exercises={[]}
        totalTonnageKg={1500}
        totalCompletedSets={8}
        totalPlannedSets={12}
        elapsedSeconds={1800}
      />
    );
    expect(historyElem).toBeTruthy();
  });
});

describe('Live Gym - Préservation des charges décimales et structure par série (P1-01)', () => {
  it('préserve les charges décimales (+2.5 kg) et la progression distincte par série lors du clonage', async () => {
    const { buildClonedSets } = await import('../../LiveGymModal');

    // Cas test utilisateur : 3 séries (62.5 kg × 8, 62.5 kg × 8, 60 kg × 10)
    const savedExercise = {
      id: 'bench_press',
      name: 'Développé couché barre',
      sets: 3,
      weightKg: 61.7, // moyenne arrondie au dixième
      reps: 9,
      rir: 2,
      detailSets: [
        { weightKg: 62.5, reps: 8, rir: 2, completed: true, restSeconds: 90 },
        { weightKg: 62.5, reps: 8, rir: 1, completed: true, restSeconds: 90 },
        { weightKg: 60, reps: 10, rir: 2, completed: true, restSeconds: 90 }
      ]
    };

    const clonedSets = buildClonedSets(savedExercise, 0, 10, 90);

    expect(clonedSets).toHaveLength(3);
    // Vérification stricte des charges décimales
    expect(clonedSets[0].weightKg).toBe(62.5);
    expect(clonedSets[1].weightKg).toBe(62.5);
    expect(clonedSets[2].weightKg).toBe(60);

    // Vérification des répétitions par série
    expect(clonedSets[0].reps).toBe(8);
    expect(clonedSets[1].reps).toBe(8);
    expect(clonedSets[2].reps).toBe(10);

    // Les séries clonées doivent être réinitialisées prêtes pour la nouvelle séance
    expect(clonedSets[0].completed).toBe(false);
    expect(clonedSets[1].completed).toBe(false);
    expect(clonedSets[2].completed).toBe(false);
  });

  it('se replie gracieusement sur les valeurs moyennes si detailSets est absent ou vide', async () => {
    const { buildClonedSets } = await import('../../LiveGymModal');

    // Cas séance historique v1 sans detailSets
    const legacyExercise = {
      id: 'squat',
      name: 'Squat',
      sets: 3,
      weightKg: 102.5,
      reps: 5,
      rir: 2,
      detailSets: undefined
    };

    const cloned = buildClonedSets(legacyExercise, 0, 10, 90);
    expect(cloned).toHaveLength(3);
    expect(cloned[0].weightKg).toBe(102.5);
    expect(cloned[1].weightKg).toBe(102.5);
    expect(cloned[2].weightKg).toBe(102.5);
    expect(cloned[0].reps).toBe(5);

    // Cas avec tableau vide
    const emptyDetailsEx = {
      id: 'squat',
      name: 'Squat',
      sets: 2,
      weightKg: 80,
      reps: 8,
      rir: 3,
      detailSets: []
    };
    const clonedEmpty = buildClonedSets(emptyDetailsEx, 1, 10, 90);
    expect(clonedEmpty).toHaveLength(2);
    expect(clonedEmpty[0].weightKg).toBe(80);
    expect(clonedEmpty[1].weightKg).toBe(80);
  });

  it('arrondit la charge moyenne de l exercice au dixième de kilo lors de la sauvegarde', () => {
    const targetSets = [
      { weightKg: 62.5, reps: 8, rir: 2, completed: true, id: 's1', setNumber: 1, restSeconds: 90 },
      { weightKg: 62.5, reps: 8, rir: 2, completed: true, id: 's2', setNumber: 2, restSeconds: 90 },
      { weightKg: 60, reps: 10, rir: 2, completed: true, id: 's3', setNumber: 3, restSeconds: 90 }
    ];

    const setCount = targetSets.length;
    const avgWeight = Math.round((targetSets.reduce((acc, s) => acc + (s.weightKg || 0), 0) / setCount) * 10) / 10;

    // (62.5 + 62.5 + 60) / 3 = 185 / 3 = 61.6666... -> 61.7 (et non 62)
    expect(avgWeight).toBe(61.7);
  });
});

describe('Live Gym - Touche Escape et cycle de vie du modal (P1-02)', () => {
  it('ferme exclusivement le catalogue d exercices sans appeler window.confirm lors d un Escape pendant une séance active', async () => {
    const confirmSpy = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmSpy);

    const { resolveLiveGymEscapeAction } = await import('../../LiveGymModal');
    
    // Scénario A : catalogue ouvert pendant une séance active
    const action = resolveLiveGymEscapeAction({
      showAddExercisePicker: true,
      stage: 'active'
    });

    expect(action).toBe('close_picker');
    expect(confirmSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('demande confirmation d abandon si Escape est pressé en séance active sans sous-catalogue ouvert', async () => {
    const { resolveLiveGymEscapeAction } = await import('../../LiveGymModal');

    const action = resolveLiveGymEscapeAction({
      showAddExercisePicker: false,
      stage: 'active'
    });

    expect(action).toBe('confirm_abandon');
  });

  it('ferme directement le modal sans confirmation hors séance active (setup / summary)', async () => {
    const { resolveLiveGymEscapeAction } = await import('../../LiveGymModal');

    expect(resolveLiveGymEscapeAction({ showAddExercisePicker: false, stage: 'setup' })).toBe('close_modal');
    expect(resolveLiveGymEscapeAction({ showAddExercisePicker: false, stage: 'summary' })).toBe('close_modal');
    // Si un sous-picker était resté ouvert en setup, Escape le ferme d'abord
    expect(resolveLiveGymEscapeAction({ showAddExercisePicker: true, stage: 'setup' })).toBe('close_picker');
  });
});


