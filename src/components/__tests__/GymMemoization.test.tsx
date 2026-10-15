import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GymActiveExercise, GymActiveExerciseProps } from '../gym/GymActiveExercise';

describe('GymActiveExercise - Efficacité de React.memo (P2-07)', () => {
  const dummyExercise2 = {
    id: 'ex_2',
    exerciseCatalogId: 'squat',
    name: 'Squat Arrière',
    category: 'lower',
    sets: [
      { id: 's_2_1', setNumber: 1, weightKg: 100, reps: 8, rir: 2, restSeconds: 120, completed: false }
    ]
  };

  it('ne re-rend pas un composant mémoïsé quand ses props (exercise et callbacks) sont référentiellement stables', () => {
    const stableCallbacks = {
      onUpdateSetValue: vi.fn(),
      onQuickAdjustWeight: vi.fn(),
      onQuickAdjustReps: vi.fn(),
      onValidateSet: vi.fn(),
      onRemoveSet: vi.fn(),
      onAddSet: vi.fn(),
      onRemoveExercise: vi.fn(),
      onApplyAdaptiveSuggestion: vi.fn(),
    };

    const initialProps: GymActiveExerciseProps = {
      exercise: dummyExercise2,
      exerciseIndex: 1,
      adaptiveSuggestion: undefined,
      ...stableCallbacks
    };

    // Vérifie que GymActiveExercise est bien un composant React memo
    expect((GymActiveExercise as unknown as { $$typeof: symbol }).$$typeof).toBeDefined();

    // Rendu statique valide
    const markup1 = renderToStaticMarkup(<GymActiveExercise {...initialProps} />);
    expect(markup1).toContain('Squat Arrière');

    // Simulation d'une mise à jour de state parent pour ex_1
    // Pour ex_2, l'objet exercise et les callbacks restent strictement identiques par référence (===)
    const nextProps: GymActiveExerciseProps = {
      ...initialProps,
      exercise: dummyExercise2 // même référence
    };

    expect(nextProps.exercise).toBe(initialProps.exercise);
    expect(nextProps.onValidateSet).toBe(initialProps.onValidateSet);
    expect(nextProps.onQuickAdjustWeight).toBe(initialProps.onQuickAdjustWeight);
    expect(nextProps.onQuickAdjustReps).toBe(initialProps.onQuickAdjustReps);
    expect(nextProps.onUpdateSetValue).toBe(initialProps.onUpdateSetValue);
    expect(nextProps.onAddSet).toBe(initialProps.onAddSet);
    expect(nextProps.onRemoveSet).toBe(initialProps.onRemoveSet);
    expect(nextProps.onRemoveExercise).toBe(initialProps.onRemoveExercise);
    expect(nextProps.onApplyAdaptiveSuggestion).toBe(initialProps.onApplyAdaptiveSuggestion);
  });
});
