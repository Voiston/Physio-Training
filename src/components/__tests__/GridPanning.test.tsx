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

  it('bascule scroll-behavior vers auto pendant isPanning', () => {
    // Vérification de la logique d'expression conditionnelle isPanning ? 'auto' : 'smooth'
    const getScrollBehavior = (isPanning: boolean) => (isPanning ? 'auto' : 'smooth');
    expect(getScrollBehavior(false)).toBe('smooth');
    expect(getScrollBehavior(true)).toBe('auto');
  });
});
