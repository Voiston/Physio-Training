import { describe, it, expect, vi, afterEach } from 'vitest';
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

describe('getInitialDailyMetrics - localStorage dégradé', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubStorage(entries: Record<string, string>) {
    const keys = Object.keys(entries);
    vi.stubGlobal('localStorage', {
      get length() { return keys.length; },
      key: (i: number) => keys[i] ?? null,
      getItem: (k: string) => entries[k] ?? null
    });
  }

  it('ne garde que les métriques autorisées avec une valeur numérique', () => {
    stubStorage({
      '2026-10-01_vfc': '65',
      '2026-10-01_hrRest': 'abc',
      '2026-10-01_steps': '9000',
      '2026-10-02_readiness': '7.8',
      'physio_settings': '{}',
      'bad_vfc': '50'
    });
    expect(getInitialDailyMetrics()).toEqual({
      '2026-10-01': { vfc: 65 },
      '2026-10-02': { readiness: 7 }
    });
  });

  it('renvoie un objet vide et journalise quand localStorage lève une exception', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('localStorage', {
      get length(): number { throw new Error('SecurityError'); }
    });
    expect(getInitialDailyMetrics()).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[metrics]'), expect.any(Error));
  });

  it('renvoie un objet vide quand localStorage est vide', () => {
    stubStorage({});
    expect(getInitialDailyMetrics()).toEqual({});
  });
});

