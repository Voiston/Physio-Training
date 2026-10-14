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

describe('zones - edge cases', () => {
  it('calculateTsbPercent returns null for negligible, zero or negative CTL', () => {
    expect(calculateTsbPercent(0, 0)).toBeNull();
    expect(calculateTsbPercent(3, 1)).toBeNull();
    expect(calculateTsbPercent(-20, 10)).toBeNull();
    expect(calculateTsbPercent(100, 100)).toBe(0);
  });

  it('stays INITIALIZING (unreliable) with zero load or CTL just under the 10 UA floor', () => {
    const zero = getTsbZone(0, 0, 200);
    expect(zero.zoneId).toBe('INITIALIZING');
    expect(zero.tsbPercent).toBeNull();
    expect(zero.isReliable).toBe(false);

    expect(getTsbZone(9.9, 30, 200).zoneId).toBe('INITIALIZING');
  });

  it('applies exact boundaries: -35% is overload, -10% neutral, +5% neutral, +25% tapering', () => {
    expect(getTsbZone(100, 135, 90).zoneId).toBe('OPTIMAL_OVERLOAD');
    expect(getTsbZone(100, 110, 90).zoneId).toBe('NEUTRAL_MAINTENANCE');
    expect(getTsbZone(100, 95, 90).zoneId).toBe('NEUTRAL_MAINTENANCE');
    expect(getTsbZone(100, 75, 90).zoneId).toBe('PEAK_TAPERING');
  });

  it('requires 3 * tauFitness days of history unless an initial CTL is set', () => {
    expect(getTsbZone(100, 150, 125, 42).zoneId).toBe('INITIALIZING');
    expect(getTsbZone(100, 150, 126, 42).zoneId).toBe('CRITICAL_FATIGUE');
    expect(getTsbZone(100, 150, 0, 42, true).zoneId).toBe('CRITICAL_FATIGUE');
  });
});

describe('zones - missing or corrupt data', () => {
  it('calculateTsbPercent returns null for NaN / Infinity inputs', () => {
    expect(calculateTsbPercent(Number.NaN, 10)).toBeNull();
    expect(calculateTsbPercent(100, Number.NaN)).toBeNull();
    expect(calculateTsbPercent(Number.POSITIVE_INFINITY, 10)).toBeNull();
  });

  it.each([
    [Number.NaN, Number.NaN],
    [Number.NaN, 50],
    [100, Number.NaN],
    [Number.POSITIVE_INFINITY, 10]
  ])('getTsbZone(%s, %s) falls back to an unreliable INITIALIZING zone with finite numbers', (ctl, atl) => {
    const zone = getTsbZone(ctl, atl, 200, 28, true);
    expect(zone.zoneId).toBe('INITIALIZING');
    expect(zone.isReliable).toBe(false);
    expect(zone.tsbPercent).toBeNull();
    expect([zone.ctl, zone.atl, zone.tsb]).toEqual([0, 0, 0]);
    expect(zone.summary).not.toContain('NaN');
  });

  it('treats a NaN history length as no history', () => {
    const zone = getTsbZone(100, 150, Number.NaN);
    expect(zone.zoneId).toBe('INITIALIZING');
    expect(zone.badge).not.toContain('NaN');
  });
});

