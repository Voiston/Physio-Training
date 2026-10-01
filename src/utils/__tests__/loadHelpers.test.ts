import { describe, it, expect } from 'vitest';
import { 
  getDailyAthleteLoad, 
  getDailyAthleteDuration, 
  isPrimary, 
  extractSessionLoad 
} from '../loadHelpers';

describe('loadHelpers - Single Source of Truth for Athlete Load', () => {
  it('correctly identifies primary vs secondary sessions', () => {
    expect(isPrimary(null)).toBe(false);
    expect(isPrimary(undefined)).toBe(false);
    expect(isPrimary({ load: 150 })).toBe(true);
    expect(isPrimary({ load: 150, isSecondary: false })).toBe(true);
    expect(isPrimary({ load: 50, isSecondary: true })).toBe(false);
  });

  it('extracts session load accurately', () => {
    expect(extractSessionLoad(null)).toBe(0);
    expect(extractSessionLoad(undefined)).toBe(0);
    expect(extractSessionLoad(10)).toBe(50); // legacy format 10 * 5
    expect(extractSessionLoad({ load: 250 })).toBe(250);
    expect(extractSessionLoad({ duration: 60, rpeMusc: 8, rpeCardio: 6 })).toBe(420);
  });

  it('eliminates double counting of secondary impacts on athlete load', () => {
    // Cas type de l'audit :
    // Une séance de Sprint (charge 100) qui génère 6 impacts secondaires sur d'autres qualités (total 310)
    const testDate = '2026-10-01';
    const events: Record<string, Record<string, any>> = {
      sprint: {
        [testDate]: { load: 100, duration: 30, sport: 'run', isSecondary: false }
      },
      vo2max: {
        [testDate]: { load: 40, duration: 0, isSecondary: true, parentQId: 'sprint' }
      },
      seuil: {
        [testDate]: { load: 30, duration: 0, isSecondary: true, parentQId: 'sprint' }
      },
      force: {
        [testDate]: { load: 60, duration: 0, isSecondary: true, parentQId: 'sprint' }
      },
      plyo: {
        [testDate]: { load: 70, duration: 0, isSecondary: true, parentQId: 'sprint' }
      },
      ef: {
        [testDate]: { load: 20, duration: 0, isSecondary: true, parentQId: 'sprint' }
      }
    };

    // getDailyAthleteLoad doit retourner EXACTEMENT 100, et non 100 + 40 + 30 + 60 + 70 + 20 = 320 !
    const athleteLoad = getDailyAthleteLoad(events, testDate);
    expect(athleteLoad).toBe(100);

    // Durée réelle de l'athlète : 30 minutes, pas plus
    const athleteDuration = getDailyAthleteDuration(events, testDate);
    expect(athleteDuration).toBe(30);
  });

  it('returns 0 for days without sessions', () => {
    const events = {
      vo2max: { '2026-10-01': { load: 200, isSecondary: false } }
    };
    expect(getDailyAthleteLoad(events, '2026-10-02')).toBe(0);
    expect(getDailyAthleteDuration(events, '2026-10-02')).toBe(0);
  });
});
