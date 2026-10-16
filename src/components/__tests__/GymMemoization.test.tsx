import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { isMemo } from 'react-is';

// Hook state persistant pour simuler le cycle de vie et les re-rendus de LiveGymModal
const hookStateMap = new Map<number, any>();
let currentHookIdx = 0;

function resetHookRunner() {
  currentHookIdx = 0;
  hookStateMap.clear();
}

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: <T,>(init: T | (() => T)) => {
      const idx = currentHookIdx++;
      if (!hookStateMap.has(idx)) {
        hookStateMap.set(idx, typeof init === 'function' ? (init as () => T)() : init);
      }
      const setState = (val: any) => {
        const prev = hookStateMap.get(idx);
        hookStateMap.set(idx, typeof val === 'function' ? val(prev) : val);
      };
      return [hookStateMap.get(idx), setState];
    },
    useRef: <T,>(init: T) => {
      const idx = currentHookIdx++;
      if (!hookStateMap.has(idx)) {
        hookStateMap.set(idx, { current: init });
      }
      return hookStateMap.get(idx);
    },
    useCallback: <T extends Function>(fn: T, deps: any[]): T => {
      const idx = currentHookIdx++;
      const prev = hookStateMap.get(idx);
      if (prev && deps && prev.deps.every((d: any, i: number) => Object.is(d, deps[i]))) {
        return prev.fn;
      }
      hookStateMap.set(idx, { fn, deps });
      return fn;
    },
    useMemo: <T,>(fn: () => T, deps: any[]): T => {
      const idx = currentHookIdx++;
      const prev = hookStateMap.get(idx);
      if (prev && deps && prev.deps.every((d: any, i: number) => Object.is(d, deps[i]))) {
        return prev.val;
      }
      const val = fn();
      hookStateMap.set(idx, { val, deps });
      return val;
    },
    useEffect: vi.fn(),
    useLayoutEffect: vi.fn()
  };
});
vi.mock('../../hooks/useModalA11y', () => ({ useModalA11y: vi.fn() }));

import { GymActiveExercise, type GymActiveExerciseProps } from '../gym/GymActiveExercise';
import { LiveGymModal } from '../LiveGymModal';
import type { Quality, EventsByQuality } from '../../types';

type AnyProps = Record<string, unknown> & { children?: ReactNode };

function findElements(node: ReactNode, pred: (el: ReactElement<AnyProps>) => boolean, acc: ReactElement<AnyProps>[] = []): ReactElement<AnyProps>[] {
  if (Array.isArray(node)) {
    node.forEach(n => findElements(n, pred, acc));
  } else if (node && typeof node === 'object' && 'props' in node) {
    const el = node as ReactElement<AnyProps>;
    if (pred(el)) acc.push(el);
    findElements(el.props.children, pred, acc);
  }
  return acc;
}

const textOf = (node: ReactNode): string =>
  Array.isArray(node) ? node.map(textOf).join('') :
  typeof node === 'string' || typeof node === 'number' ? String(node) :
  node && typeof node === 'object' && 'props' in node ? textOf((node as ReactElement<AnyProps>).props.children) : '';

describe('GymActiveExercise - Efficacité de React.memo (P2-07)', () => {
  const dummyExercise = {
    id: 'ex_2',
    exerciseCatalogId: 'squat',
    name: 'Squat Arrière',
    category: 'lower',
    sets: [
      { id: 's_2_1', setNumber: 1, weightKg: 100, reps: 8, rir: 2, restSeconds: 120, completed: false }
    ]
  };

  const dummyProps: GymActiveExerciseProps = {
    exercise: dummyExercise,
    exerciseIndex: 1,
    adaptiveSuggestion: undefined,
    onUpdateSetValue: vi.fn(),
    onQuickAdjustWeight: vi.fn(),
    onQuickAdjustReps: vi.fn(),
    onValidateSet: vi.fn(),
    onRemoveSet: vi.fn(),
    onAddSet: vi.fn(),
    onRemoveExercise: vi.fn(),
    onApplyAdaptiveSuggestion: vi.fn(),
  };

  beforeEach(() => {
    resetHookRunner();
  });

  it('valide formellement que GymActiveExercise est encapsulé dans React.memo', () => {
    const element = <GymActiveExercise {...dummyProps} />;
    expect(isMemo(element)).toBe(true);
    expect((GymActiveExercise as any).$$typeof).toBe(Symbol.for('react.memo'));
  });

  it('garantit que handleValidateSet reste référentiellement stable entre deux rendus de LiveGymModal', () => {
    const dummyQualities: Quality[] = [
      { id: 'pull', name: 'Tirage / Dos', category: 'force' }
    ];
    const dummyEvents: EventsByQuality = {};

    // 1er rendu : LiveGymModal s'initialise à l'étape 'setup'
    currentHookIdx = 0;
    const tree1 = LiveGymModal({
      isOpen: true,
      onClose: () => {},
      qualities: dummyQualities,
      events: dummyEvents,
      initialDateStr: '2026-10-16',
      onSaveSession: () => {}
    }) as unknown as ReactNode;

    // Clic sur "Démarrer une séance vierge" pour passer à l'étape 'active'
    const startButtons = findElements(tree1, el => el.type === 'button' && textOf(el.props.children).includes('Démarrer une séance vierge'));
    expect(startButtons.length).toBeGreaterThan(0);
    (startButtons[0].props.onClick as () => void)();

    // 2ème rendu : LiveGymModal est maintenant à l'étape 'active' et rend GymActiveExercise
    currentHookIdx = 0;
    const tree2 = LiveGymModal({
      isOpen: true,
      onClose: () => {},
      qualities: dummyQualities,
      events: dummyEvents,
      initialDateStr: '2026-10-16',
      onSaveSession: () => {}
    }) as unknown as ReactNode;

    const activeExercisesRender2 = findElements(tree2, el => el.type === GymActiveExercise);
    expect(activeExercisesRender2.length).toBeGreaterThan(0);
    const validateSetRef1 = activeExercisesRender2[0].props.onValidateSet;
    expect(typeof validateSetRef1).toBe('function');

    // 3ème rendu : Re-rendu de LiveGymModal (par exemple mise à jour d'événements externes ou props)
    currentHookIdx = 0;
    const tree3 = LiveGymModal({
      isOpen: true,
      onClose: () => {},
      qualities: dummyQualities,
      events: { other: {} } as any, // Prop modifiée simulant une réévaluation du parent
      initialDateStr: '2026-10-16',
      onSaveSession: () => {}
    }) as unknown as ReactNode;

    const activeExercisesRender3 = findElements(tree3, el => el.type === GymActiveExercise);
    expect(activeExercisesRender3.length).toBeGreaterThan(0);
    const validateSetRef2 = activeExercisesRender3[0].props.onValidateSet;

    // VALIDATION CRITIQUE : handleValidateSet est strictement stable (===) entre les rendus
    expect(validateSetRef2).toBe(validateSetRef1);
  });
});
