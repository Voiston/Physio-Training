import { describe, it, expect, vi, afterEach } from 'vitest';
import { migrateData, migrateLocalStorage, CURRENT_SCHEMA_VERSION, calculateCleanSessionLoad } from '../migration';

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
    expect(session).toBeDefined();
    if (!session) return;
    expect(session.loadLegacy).toBe(260);
    expect(session.load).toBe(240); // 60 * 4
    expect(session.loadCardio).toBe(240);
    expect(session.loadMusc).toBe(180);
    expect(session.fatigue).toBe(9); // Stored as response marker
  });

  describe('degraded input', () => {
    it.each([null, undefined, 42, 'v2', true])('returns an empty current-schema payload for %s', (raw) => {
      expect(migrateData(raw)).toEqual({ schemaVersion: CURRENT_SCHEMA_VERSION });
    });

    it('converts legacy numeric sessions (raw RPE vs Foster load)', () => {
      const migrated = migrateData({ events: { leg: { '2026-01-01': 7, '2026-01-02': 400 } } });
      const rpe = migrated.events?.leg?.['2026-01-01'];
      const foster = migrated.events?.leg?.['2026-01-02'];
      expect(rpe).toMatchObject({ duration: 45, rpeMusc: 7, load: 315, isSecondary: false, sport: 'muscu' });
      expect(foster).toMatchObject({ load: 400, loadCardio: 400, loadMusc: 400 });
    });

    it('skips null / non-object quality buckets and sessions without crashing', () => {
      const migrated = migrateData({ events: { ef: null, leg: { '2026-01-01': null, '2026-01-02': 'oops' } } });
      expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(migrated.events?.leg?.['2026-01-01']).toBeNull();
      expect(migrated.events?.leg?.['2026-01-02']).toBe('oops');
    });

    it('leaves zero-duration sessions load untouched but keeps loadLegacy', () => {
      const migrated = migrateData({ schemaVersion: 1, events: { ef: { '2026-01-01': { duration: 0, load: 99 } } } });
      expect(migrated.events?.ef?.['2026-01-01']).toMatchObject({ load: 99, loadLegacy: 99 });
    });

    it('does not re-migrate data already at the current schema', () => {
      const current = { schemaVersion: CURRENT_SCHEMA_VERSION, events: { ef: { '2026-01-01': { duration: 60, load: 1 } } } };
      expect(migrateData(current).events?.ef?.['2026-01-01']).toEqual({ duration: 60, load: 1 });
    });

    it('defaults a missing competition TSB unit to points', () => {
      const migrated = migrateData({ schemaVersion: 1, targetCompetition: { name: 'Trail', date: '2026-12-01' } });
      expect(migrated.targetCompetition?.targetTsbUnit).toBe('points');
    });
  });

  describe('migrateLocalStorage failures', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    function stubStorage(entries: Record<string, string>) {
      const store = { ...entries };
      const storage = {
        get length() { return Object.keys(store).length; },
        key: (i: number) => Object.keys(store)[i] ?? null,
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = String(v); },
        removeItem: (k: string) => { delete store[k]; }
      };
      vi.stubGlobal('localStorage', storage);
      return store;
    }

    it('skips a corrupt JSON entry with a warning and still migrates the others', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const store = stubStorage({
        '2026-01-01_leg': '{not json',
        '2026-01-02_leg': JSON.stringify({ duration: 30, rpeMusc: 8, rpeCardio: 3 })
      });
      migrateLocalStorage();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[migration]'), expect.any(SyntaxError));
      expect(store['2026-01-01_leg']).toBe('{not json');
      expect(JSON.parse(store['2026-01-02_leg'])).toMatchObject({ load: 240, isSecondary: false });
      expect(store.physio_schema_version).toBe(String(CURRENT_SCHEMA_VERSION));
    });

    it('logs and gives up when localStorage itself throws', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.stubGlobal('localStorage', {
        getItem: () => { throw new Error('SecurityError'); }
      });
      expect(() => migrateLocalStorage()).not.toThrow();
      expect(warn).toHaveBeenCalledWith('[migration] Migration de schéma interrompue', expect.any(Error));
    });
  });
});
