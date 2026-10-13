import { describe, it, expect } from 'vitest';
import { generateTimeline, getLocalYYYYMMDD, formatDisplayDate } from '../dateHelpers';
import { computeAllWeeksStats } from '../weekHelpers';

describe('dateHelpers & dynamic today handling', () => {
  it('generateTimeline centers on referenceDate when provided', () => {
    const monday = new Date('2026-10-12T12:00:00Z');
    const tuesday = new Date('2026-10-13T12:00:00Z');

    const timelineMonday = generateTimeline(2, 2, monday);
    const jZeroMonday = timelineMonday.find(d => d.offset === 0);
    expect(jZeroMonday?.dateStr).toBe('2026-10-12');

    // When app resumes the next day from background
    const timelineTuesday = generateTimeline(2, 2, tuesday);
    const jZeroTuesday = timelineTuesday.find(d => d.offset === 0);
    expect(jZeroTuesday?.dateStr).toBe('2026-10-13');
  });

  it('formatDisplayDate formats offset labels consistently', () => {
    const date = new Date('2026-10-13T12:00:00Z');
    const j0 = formatDisplayDate(date, 0);
    expect(j0.prefix).toBe('J+0');
    const j1 = formatDisplayDate(date, 1);
    expect(j1.prefix).toBe('J+1');
    const jMinus1 = formatDisplayDate(date, -1);
    expect(jMinus1.prefix).toBe('J-1');
  });

  it('computeAllWeeksStats shifts current week when referenceDate crosses a week boundary', () => {
    const sunday = new Date('2026-10-11T12:00:00Z');
    const mondayNext = new Date('2026-10-12T12:00:00Z');

    const weeksSunday = computeAllWeeksStats({}, [], 1, 1, sunday);
    const currentWeekSunday = weeksSunday.find(w => w.isCurrentWeek);

    const weeksMonday = computeAllWeeksStats({}, [], 1, 1, mondayNext);
    const currentWeekMonday = weeksMonday.find(w => w.isCurrentWeek);

    expect(currentWeekSunday?.startDate).not.toBe(currentWeekMonday?.startDate);
    expect(currentWeekMonday?.startDate).toBe('2026-10-12');
  });
});
