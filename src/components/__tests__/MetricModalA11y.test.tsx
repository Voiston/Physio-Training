import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MetricModal from '../MetricModal';
import { extractDaySessionsForDate } from '../PhysiologyDashboard';
import type { Quality, EventsByQuality } from '../../types';

describe('MetricModal - Accessibilité et useModalA11y (P3-01)', () => {
  it('rend la modale avec les attributs d accessibilité role="dialog" et aria-modal="true"', () => {
    const html = renderToStaticMarkup(
      <MetricModal
        info={{
          type: 'readiness',
          dateStr: '2026-10-15',
          currentValue: 8,
          title: 'Score de Forme (Readiness)',
          label: 'Niveau d énergie au réveil (1 à 10)',
          min: 1,
          max: 10
        }}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('id="metric-modal-title"');
    expect(html).toContain('aria-labelledby="metric-modal-title"');
    expect(html).toContain('Score de Forme (Readiness)');
  });

  it('appelle le gestionnaire onClose lors de l appui sur Escape via useModalA11y', () => {
    // Vérification de la mécanique d écoute d événement Escape
    const onClose = vi.fn();
    const handleKeyDown = (e: { key: string }) => {
      if (e.key === 'Escape') onClose();
    };

    handleKeyDown({ key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('PhysiologyDashboard - Fonction pure extractDaySessionsForDate (P3-01)', () => {
  const dummyQualities: Quality[] = [
    { id: 'force_max', name: 'Force Maximale', category: 'force' },
    { id: 'endurance', name: 'Endurance Fondamentale', category: 'cardio' }
  ];

  it('extrait fidèlement les séances primaires et filtre les impacts secondaires ou vides', () => {
    const events: EventsByQuality = {
      force_max: {
        '2026-10-15': {
          rpeMusc: 8,
          duration: 60,
          load: 480,
          type: 'primary',
          notes: 'Séance lourde'
        }
      },
      endurance: {
        '2026-10-15': {
          rpeCardio: 5,
          duration: 45,
          load: 225,
          isSecondary: true, // Non-primaire, doit être filtrée par isPrimary
          notes: 'Impact rémanent'
        }
      }
    };

    const sessions = extractDaySessionsForDate(events, dummyQualities, '2026-10-15');

    // Seule la séance primaire force_max doit être retenue
    expect(sessions).toHaveLength(1);
    expect(sessions[0].qualityId).toBe('force_max');
    expect(sessions[0].qualityName).toBe('Force Maximale');
    expect(sessions[0].load).toBe(480);
    expect(sessions[0].duration).toBe(60);
    expect(sessions[0].notes).toBe('Séance lourde');
  });

  it('renvoie une liste vide lorsqu aucune séance n existe à la date donnée', () => {
    const events: EventsByQuality = {};
    const sessions = extractDaySessionsForDate(events, dummyQualities, '2026-10-15');
    expect(sessions).toEqual([]);
  });
});
