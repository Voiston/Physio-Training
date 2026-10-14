import { describe, it, expect } from 'vitest';
import { generateTimeline, getLocalYYYYMMDD, formatDisplayDate, parseLocalDate, addDays } from '../dateHelpers';
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

  it('parseLocalDate instantiates local date safely anchored at noon (12:00)', () => {
    const d1 = parseLocalDate('2026-10-25');
    expect(d1.getFullYear()).toBe(2026);
    expect(d1.getMonth()).toBe(9); // 0-indexed month 9 = October
    expect(d1.getDate()).toBe(25);
    expect(d1.getHours()).toBe(12);
    expect(getLocalYYYYMMDD(d1)).toBe('2026-10-25');
  });

  it('addDays is Daylight Saving Time (DST) safe across 25 October 2026', () => {
    // Le 25 octobre 2026 en Europe est le jour du changement d'heure d'hiver (journée de 25h).
    // Une addition naïve de 86400000 ms produirait un artefact d'arrondi horaire.
    const oct24 = parseLocalDate('2026-10-24');
    const oct25 = addDays(oct24, 1);
    const oct26 = addDays(oct24, 2);

    expect(getLocalYYYYMMDD(oct25)).toBe('2026-10-25');
    expect(getLocalYYYYMMDD(oct26)).toBe('2026-10-26');

    // Soustraction de jours
    const oct23 = addDays(oct25, -2);
    expect(getLocalYYYYMMDD(oct23)).toBe('2026-10-23');
  });

  it('generateTimeline produces unique consecutive days without DST duplication or skips', () => {
    // Génère une timeline de 7 jours passés et 7 jours futurs centrée sur le 25 octobre 2026
    const oct25 = parseLocalDate('2026-10-25');
    const timeline = generateTimeline(7, 7, oct25);

    expect(timeline.length).toBe(15);
    const dateStrings = timeline.map(t => t.dateStr);
    const uniqueDates = new Set(dateStrings);
    // Aucune duplication de date
    expect(uniqueDates.size).toBe(15);
    expect(dateStrings).toContain('2026-10-24');
    expect(dateStrings).toContain('2026-10-25');
    expect(dateStrings).toContain('2026-10-26');
  });
});

describe('dateHelpers - invalid input', () => {
  it('parseLocalDate falls back to today at noon for unparseable strings', () => {
    const today = getLocalYYYYMMDD(new Date());
    const parsed = parseLocalDate('pas-une-date');
    expect(getLocalYYYYMMDD(parsed)).toBe(today);
    expect(parsed.getHours()).toBe(12);
  });

  it('parseLocalDate treats null and empty string as today', () => {
    const today = getLocalYYYYMMDD(new Date());
    expect(getLocalYYYYMMDD(parseLocalDate(null))).toBe(today);
    expect(getLocalYYYYMMDD(parseLocalDate(''))).toBe(today);
  });

  it('parseLocalDate normalises out-of-range components like the Date constructor', () => {
    expect(getLocalYYYYMMDD(parseLocalDate('2026-02-30'))).toBe('2026-03-02');
    expect(getLocalYYYYMMDD(parseLocalDate('2026-13-01'))).toBe('2027-01-01');
  });

  it('getLocalYYYYMMDD returns NaN parts for an invalid Date (callers must validate)', () => {
    expect(getLocalYYYYMMDD(new Date('invalid'))).toBe('NaN-NaN-NaN');
  });

  it('addDays handles zero, negative and year-crossing offsets', () => {
    expect(getLocalYYYYMMDD(addDays('2026-12-31', 1))).toBe('2027-01-01');
    expect(getLocalYYYYMMDD(addDays('2026-03-01', -1))).toBe('2026-02-28');
    expect(getLocalYYYYMMDD(addDays('2026-05-05', 0))).toBe('2026-05-05');
  });

  it('generateTimeline with zero past/future days yields only J0', () => {
    const timeline = generateTimeline(0, 0, '2026-10-14');
    expect(timeline).toHaveLength(1);
    expect(Math.abs(timeline[0].offset)).toBe(0);
    expect(timeline[0].dateStr).toBe('2026-10-14');
  });
});
