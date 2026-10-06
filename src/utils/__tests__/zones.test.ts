import { describe, it, expect } from 'vitest';
import { getTsbZone, calculateTsbPercent } from '../zones';

describe('zones - TSB Relative Zones (% of CTL)', () => {
  it('detects cold start / initialization when CTL is low or history is short (< 3 * tauFitness = 84 days)', () => {
    const zone1 = getTsbZone(5, 4, 10);
    expect(zone1.zoneId).toBe('INITIALIZING');
    expect(zone1.isReliable).toBe(false);
    expect(zone1.title).toContain('CTL en Phase de Convergence');

    // History of 50 days with tauFitness=28 (requires 84 days) should still be in INITIALIZING
    const zone2 = getTsbZone(100, 150, 50, 28, false);
    expect(zone2.zoneId).toBe('INITIALIZING');
    expect(zone2.isReliable).toBe(false);

    // Unless initialCtl was provided by athlete:
    const zoneWithInit = getTsbZone(100, 150, 50, 28, true);
    expect(zoneWithInit.zoneId).toBe('CRITICAL_FATIGUE');
    expect(zoneWithInit.isReliable).toBe(true);
  });

  it('detects CRITICAL_FATIGUE when TSB% < -35%', () => {
    // CTL = 100, ATL = 150 -> TSB = -50 -> TSB% = -50% (history = 90 days >= 3 * 28)
    const zone = getTsbZone(100, 150, 90);
    expect(zone.zoneId).toBe('CRITICAL_FATIGUE');
    expect(zone.tsbPercent).toBe(-50);
    expect(zone.status).toBe('danger');
    expect(zone.title).toContain('Fatigue Aiguë Élevée');
  });

  it('detects OPTIMAL_OVERLOAD when -35% <= TSB% < -10%', () => {
    // CTL = 100, ATL = 120 -> TSB = -20 -> TSB% = -20% (history = 90 days)
    const zone = getTsbZone(100, 120, 90);
    expect(zone.zoneId).toBe('OPTIMAL_OVERLOAD');
    expect(zone.tsbPercent).toBe(-20);
    expect(zone.status).toBe('building');
  });

  it('detects NEUTRAL_MAINTENANCE when -10% <= TSB% <= +5%', () => {
    // CTL = 100, ATL = 98 -> TSB = +2 -> TSB% = +2% (history = 90 days)
    const zone = getTsbZone(100, 98, 90);
    expect(zone.zoneId).toBe('NEUTRAL_MAINTENANCE');
    expect(zone.status).toBe('neutral');
  });

  it('detects PEAK_TAPERING when +5% < TSB% <= +25%', () => {
    // CTL = 100, ATL = 85 -> TSB = +15 -> TSB% = +15% (history = 90 days)
    const zone = getTsbZone(100, 85, 90);
    expect(zone.zoneId).toBe('PEAK_TAPERING');
    expect(zone.status).toBe('optimal');
    expect(zone.title).toContain('Zone d\'Affûtage');
  });

  it('detects DETRAINING_RISK when TSB% > +25%', () => {
    // CTL = 100, ATL = 60 -> TSB = +40 -> TSB% = +40% (history = 90 days)
    const zone = getTsbZone(100, 60, 90);
    expect(zone.zoneId).toBe('DETRAINING_RISK');
    expect(zone.status).toBe('recovery');
  });
});
