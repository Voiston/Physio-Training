import { describe, it, expect } from 'vitest';
import { useBlocksState } from '../useBlocksState';
import { useSimulationState } from '../useSimulationState';
import { useMetricsState, DEFAULT_PHYSIO_SETTINGS, getInitialDailyMetrics } from '../useMetricsState';

describe('Composed Sub-Hooks of useData', () => {
  it('exporte les sous-hooks useBlocksState, useSimulationState, useMetricsState', () => {
    expect(typeof useBlocksState).toBe('function');
    expect(typeof useSimulationState).toBe('function');
    expect(typeof useMetricsState).toBe('function');
  });

  it('fournit les constantes physiologiques par défaut pour useMetricsState', () => {
    expect(DEFAULT_PHYSIO_SETTINGS.tauFatigue).toBe(7);
    expect(DEFAULT_PHYSIO_SETTINGS.tauFitness).toBe(28);
    expect(DEFAULT_PHYSIO_SETTINGS.profileName).toBe('Standard');
  });

  it('getInitialDailyMetrics retourne un dictionnaire de métriques initiales', () => {
    const metrics = getInitialDailyMetrics();
    expect(typeof metrics).toBe('object');
  });
});
