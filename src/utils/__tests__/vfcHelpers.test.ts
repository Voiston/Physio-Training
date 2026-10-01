import { describe, it, expect } from 'vitest';
import { computeVfcAnalysis, computeHrRestAnalysis } from '../vfcHelpers';

describe('vfcHelpers - Statistical HRV & Resting HR Analysis', () => {
  it('returns initializing status when fewer than 7 data points are present', () => {
    const dailyMetrics = {
      '2026-10-01': { vfc: 65, hrRest: 50 },
      '2026-09-30': { vfc: 68, hrRest: 49 },
      '2026-09-29': { vfc: 64, hrRest: 51 }
    };
    const vfc = computeVfcAnalysis(dailyMetrics, '2026-10-01');
    expect(vfc.status).toBe('initializing');
    expect(vfc.corridorLower).toBeNull();

    const hr = computeHrRestAnalysis(dailyMetrics, '2026-10-01');
    expect(hr.status).toBe('initializing');
  });

  it('calculates Smallest Worthwhile Change (SWC) and normal corridor for 7+ days', () => {
    const dailyMetrics: Record<string, { vfc: number; hrRest: number }> = {};
    // Seed 14 days around 70 ms (with standard deviation around 6 ms -> SWC around 3 ms)
    for (let i = 0; i < 14; i++) {
      const d = new Date('2026-10-01');
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      dailyMetrics[str] = { vfc: 70 + (i % 3 - 1) * 4, hrRest: 50 + (i % 3 - 1) * 2 };
    }

    const vfc = computeVfcAnalysis(dailyMetrics, '2026-10-01');
    expect(vfc.status).toBe('optimal');
    expect(vfc.swc).toBeGreaterThan(0);
    expect(vfc.corridorLower).toBeLessThan(vfc.baseline60d!);
    expect(vfc.corridorUpper).toBeGreaterThan(vfc.baseline60d!);
  });

  it('detects low VFC drop (< SWC) as systemic fatigue', () => {
    const dailyMetrics: Record<string, { vfc: number }> = {};
    for (let i = 1; i <= 20; i++) {
      const d = new Date('2026-10-01');
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      dailyMetrics[str] = { vfc: 75 }; // baseline = 75
    }
    // Severe drop over last few days
    dailyMetrics['2026-10-01'] = { vfc: 50 };
    dailyMetrics['2026-09-30'] = { vfc: 52 };
    dailyMetrics['2026-09-29'] = { vfc: 55 };

    const vfc = computeVfcAnalysis(dailyMetrics, '2026-10-01');
    expect(vfc.status).toBe('low');
    expect(vfc.color).toBe('rose');
  });

  it('detects elevated resting heart rate (+5 bpm above 28d median)', () => {
    const dailyMetrics: Record<string, { hrRest: number }> = {};
    for (let i = 1; i <= 20; i++) {
      const d = new Date('2026-10-01');
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      dailyMetrics[str] = { hrRest: 50 }; // median = 50
    }
    dailyMetrics['2026-10-01'] = { hrRest: 57 }; // +7 bpm

    const hr = computeHrRestAnalysis(dailyMetrics, '2026-10-01');
    expect(hr.status).toBe('elevated');
    expect(hr.deltaBpm).toBe(7);
    expect(hr.color).toBe('rose');
  });
});
