import { describe, it, expect } from 'vitest';
import { calculateExpDecay, calculateEMA } from '../mathHelpers';

describe('mathHelpers - Physiological Exponential Decay', () => {
  it('tau=7 impulse test: an impulse at day 0 decays to ~36.8% (37%) after 7 days', () => {
    // Initial impulse of 100 on day 0, then 0 for 7 consecutive days
    const impulse = [100, 0, 0, 0, 0, 0, 0, 0];
    const decay = calculateExpDecay(impulse, 7, { decayToZero: true });

    // Day 0: starts at 100
    expect(decay[0]).toBeCloseTo(100, 1);

    // Day 7 (index 7): should be exactly 100 * e^(-7/7) = 100 * e^(-1) ≈ 36.7879%
    const day7Value = decay[7];
    expect(day7Value).toBeGreaterThan(36.0);
    expect(day7Value).toBeLessThan(37.5);
    expect(Math.round(day7Value)).toBe(37);
  });

  it('calculateEMA uses the continuous alpha = 1 - exp(-1/tau)', () => {
    const impulse = [100, 0, 0, 0, 0, 0, 0, 0];
    const ema = calculateEMA(impulse, 7, true);
    expect(Math.round(ema[7])).toBe(37);
  });

  it('preserves values when decayToZero is false and data has holes (e.g. VFC missing days)', () => {
    const vfcData = [65, null, null, 70];
    const decay = calculateExpDecay(vfcData, 7, { decayToZero: false });
    expect(decay[0]).toBe(65);
    expect(decay[1]).toBe(65);
    expect(decay[2]).toBe(65);
    expect(decay[3]).toBeGreaterThan(65);
  });
});
