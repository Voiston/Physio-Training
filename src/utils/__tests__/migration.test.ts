import { describe, it, expect } from 'vitest';
import { migrateData, CURRENT_SCHEMA_VERSION, calculateCleanSessionLoad } from '../migration';

describe('migration - Data Schema Versioning and Migration', () => {
  it('correctly calculates clean session load without fatigue pollution', () => {
    // 60 min cardio session at RPE Cardio 6, RPE Musc 4
    const cardio = calculateCleanSessionLoad('vo2max', 60, 4, 6);
    expect(cardio.load).toBe(360); // 60 * 6
    expect(cardio.loadCardio).toBe(360);
    expect(cardio.loadMusc).toBe(240); // 60 * 4

    // 45 min force session at RPE Musc 8, RPE Cardio 3
    const force = calculateCleanSessionLoad('leg', 45, 8, 3);
    expect(force.load).toBe(360); // 45 * 8
    expect(force.loadMusc).toBe(360);
    expect(force.loadCardio).toBe(135); // 45 * 3
  });

  it('migrates raw v0/v1 data to v2 and keeps loadLegacy', () => {
    const rawV1Data = {
      schemaVersion: 1,
      events: {
        ef: {
          '2026-03-01': {
            duration: 60,
            rpeCardio: 4,
            rpeMusculaire: 3,
            fatigue: 9, // Old code multiplied load by fatMod!
            load: 260 // Old inflated load
          }
        }
      }
    };

    const migrated = migrateData(rawV1Data);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const session = migrated.events?.ef?.['2026-03-01'];
    expect(session.loadLegacy).toBe(260);
    expect(session.load).toBe(240); // 60 * 4
    expect(session.loadCardio).toBe(240);
    expect(session.loadMusc).toBe(180);
    expect(session.fatigue).toBe(9); // Stored as response marker
  });
});
