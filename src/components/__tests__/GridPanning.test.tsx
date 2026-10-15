import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Grid from '../Grid';
import type { GridDay, Quality, EventsByQuality } from '../../types';

describe('Grid - Fluidité du Mouse Pan (P2-06)', () => {
  const dummyTimeline: GridDay[] = [
    { 
      offset: 0, 
      dateStr: '2026-10-15', 
      dateObj: new Date('2026-10-15T12:00:00Z'), 
      display: { prefix: 'J+0', date: '15/10' } 
    }
  ];

  const dummyQualities: Quality[] = [
    { id: 'force_max', name: 'Force Maximale', category: 'force' }
  ];

  const dummyEvents: EventsByQuality = {};
  const dummyDailyMetrics = {};
  const dummyQualitiesEMA = {};

  it('affiche scroll-behavior smooth par défaut hors interaction pan', () => {
    const markup = renderToStaticMarkup(
      <Grid
        timeline={dummyTimeline}
        events={dummyEvents}
        qualities={dummyQualities}
        dailyMetrics={dummyDailyMetrics}
        qualitiesEMA={dummyQualitiesEMA}
        onCellClick={() => {}}
        onMetricClick={() => {}}
        onQualityClick={() => {}}
      />
    );

    // Vérifie que le scrollBehavior initial est 'smooth'
    expect(markup).toContain('scroll-behavior:smooth');
  });

  const renderGrid = (over: Partial<Parameters<typeof Grid>[0]> = {}) =>
    renderToStaticMarkup(
      <Grid
        timeline={dummyTimeline}
        events={dummyEvents}
        qualities={dummyQualities}
        dailyMetrics={dummyDailyMetrics}
        qualitiesEMA={dummyQualitiesEMA}
        onCellClick={() => {}}
        onMetricClick={() => {}}
        onQualityClick={() => {}}
        {...over}
      />
    );

  it('rend sans planter une timeline vide (aucun jour à afficher)', () => {
    expect(() => renderGrid({ timeline: [] })).not.toThrow();
  });

  it('rend sans planter sans aucune qualité (liste vide)', () => {
    const markup = renderGrid({ qualities: [] });
    expect(markup).not.toContain('Force Maximale');
  });

  it('tolère des séances corrompues : filière null, séance numérique historique, date inconnue', () => {
    const corrupt = {
      force_max: { '2026-10-15': 7, '1999-01-01': { load: Number.NaN } },
      endurance: null
    } as unknown as EventsByQuality;
    expect(() => renderGrid({ events: corrupt })).not.toThrow();
  });

  it('affiche la readiness absente (ou à 0) en badge neutre, et une valeur valide en couleur', () => {
    type Metrics = Parameters<typeof Grid>[0]['dailyMetrics'];
    const neutral = 'text-slate-500 font-normal';
    expect(renderGrid({ dailyMetrics: { '2026-10-15': { vfc: undefined } } as unknown as Metrics })).toContain(neutral);
    expect(renderGrid({ dailyMetrics: { '2026-10-15': { readiness: 0 } } as unknown as Metrics })).toContain(neutral);
    expect(renderGrid({ dailyMetrics: { '2026-10-15': { readiness: 9 } } as unknown as Metrics })).toContain('bg-emerald-500/20 text-emerald-300');
  });
});
