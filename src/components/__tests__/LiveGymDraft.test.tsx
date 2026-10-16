import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LiveGymModal, STORAGE_DRAFT_KEY } from '../LiveGymModal';
import type { Quality, EventsByQuality } from '../../types';

describe('LiveGymModal - Réinitialisation de draftExists (REG-02)', () => {
  const dummyQualities: Quality[] = [
    { id: 'pull', name: 'Tirage / Dos', category: 'force' }
  ];
  const dummyEvents: EventsByQuality = {};

  const mockStore: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(mockStore)) {
      delete mockStore[key];
    }
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, value: string) => { mockStore[key] = value; },
      removeItem: (key: string) => { delete mockStore[key]; },
      clear: () => {
        for (const key of Object.keys(mockStore)) {
          delete mockStore[key];
        }
      }
    });
  });

  it('affiche le bandeau de reprise lorsqu un brouillon valide est présent en mémoire', () => {
    const validDraft = {
      qualityId: 'pull',
      dateStr: '2026-10-16',
      startedAt: Date.now() - 60000,
      isPaused: false,
      exercises: [
        {
          id: 'ex_1',
          exerciseCatalogId: 'pull_ups',
          name: 'Tractions',
          sets: [{ id: 's_1', setNumber: 1, weightKg: 0, reps: 10, rir: 2, completed: true }]
        }
      ]
    };
    mockStore[STORAGE_DRAFT_KEY] = JSON.stringify(validDraft);

    const html = renderToStaticMarkup(
      <LiveGymModal
        isOpen={true}
        onClose={() => {}}
        qualities={dummyQualities}
        events={dummyEvents}
        initialDateStr="2026-10-16"
        onSaveSession={() => {}}
      />
    );

    expect(html).toContain('Séance en cours détectée');
    expect(html).toContain('Reprendre');
  });

  it('n affiche PAS le bandeau de reprise lorsque aucun brouillon n est présent', () => {
    delete mockStore[STORAGE_DRAFT_KEY];

    const html = renderToStaticMarkup(
      <LiveGymModal
        isOpen={true}
        onClose={() => {}}
        qualities={dummyQualities}
        events={dummyEvents}
        initialDateStr="2026-10-16"
        onSaveSession={() => {}}
      />
    );

    expect(html).not.toContain('Séance en cours détectée');
  });

  it('restaure fidèlement les temps de repos spécifiques par série (restSeconds) depuis detailSets', async () => {
    const { buildClonedSets } = await import('../LiveGymModal');
    const rawExercise = {
      sets: 2,
      detailSets: [
        { weightKg: 80, reps: 8, rir: 2, restSeconds: 120, completed: true },
        { weightKg: 85, reps: 6, rir: 1, restSeconds: 180, completed: true }
      ]
    };

    const cloned = buildClonedSets(rawExercise, 0, 10, 90);
    expect(cloned).toHaveLength(2);
    expect(cloned[0].restSeconds).toBe(120);
    expect(cloned[1].restSeconds).toBe(180);
  });
});
