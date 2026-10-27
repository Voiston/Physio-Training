import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  sanitizeSessionData,
  sanitizeEventsPayload,
  sanitizeTombstonesPayload,
  mergeEventsNonDestructive,
  mergeDailyMetricsNonDestructive,
  sanitizeDailyMetricsPayload,
  validateAndStageImportPayload
} from '../security';
import { purgeLocalHealthStorage, hasLocalHealthData } from '../../hooks/useCloudSync';

describe('Synchronisation & Tombstones - Résolution de Conflits & Suppressions', () => {
  it('préserve le champ updatedAt dans sanitizeSessionData', () => {
    const timestamp = 1773448000000;
    const session = sanitizeSessionData({
      load: 60,
      rpeMusc: 6,
      duration: 45,
      updatedAt: timestamp
    });

    expect(session).not.toBeNull();
    expect(session?.updatedAt).toBe(timestamp);
  });

  it('filtre et assainit les tombstones invalides ou corrompues', () => {
    const now = Date.now();
    const rawTombstones = {
      '2026-10-13_vo2max': now,
      'invalid-key': now,
      '2026-10-13_badid!': now,
      '2026-10-13_force': -500, // date négative
      '2026-10-12_leg': now - (100 * 24 * 60 * 60 * 1000), // > 90 jours (expiré)
    };

    const clean = sanitizeTombstonesPayload(rawTombstones);
    expect(clean['2026-10-13_vo2max']).toBe(now);
    expect(clean['invalid-key']).toBeUndefined();
    expect(clean['2026-10-13_badid!']).toBeUndefined();
    expect(clean['2026-10-13_force']).toBeUndefined();
    expect(clean['2026-10-12_leg']).toBeUndefined();
  });

  it('ne ressuscite PAS une séance supprimée sur A quand B la renvoie', () => {
    const now = Date.now();
    const tCreate = now - 60000;
    const tDelete = now - 10000;

    // Device B a conservé l'ancienne séance créée à tCreate
    const localEventsOnB = {
      force: {
        '2026-10-13': { load: 150, duration: 30, updatedAt: tCreate }
      }
    };

    // Device A a supprimé la séance et possède une tombstone à tDelete
    const remoteEventsOnA = {};
    const remoteTombstonesOnA = {
      '2026-10-13_force': tDelete
    };

    const result = mergeEventsNonDestructive(
      localEventsOnB,
      remoteEventsOnA,
      {},
      remoteTombstonesOnA
    );

    // La séance doit avoir disparu du résultat fusionné
    expect(result.merged['force']?.['2026-10-13']).toBeUndefined();
    // La clé doit être marquée pour purge dans le localStorage de B
    expect(result.deletedKeysToPurge).toContain('2026-10-13_force');
    // La tombstone est préservée
    expect(result.mergedTombstones['2026-10-13_force']).toBe(tDelete);
  });

  it('permet de corriger une charge à la baisse (ex: 600 -> 60) grâce à updatedAt', () => {
    const t1 = 1000;
    const t2 = 2000; // Modification plus récente

    // Version antérieure erronée (load 600)
    const remoteOldSession = {
      force: {
        '2026-10-13': { load: 600, duration: 60, updatedAt: t1 }
      }
    };

    // Correction locale de l'athlète à 60 pts
    const localCorrectedSession = {
      force: {
        '2026-10-13': { load: 60, duration: 60, updatedAt: t2 }
      }
    };

    const result = mergeEventsNonDestructive(
      localCorrectedSession,
      remoteOldSession,
      {},
      {}
    );

    // La version corrigée (load 60) l'emporte sur l'ancienne charge supérieure
    expect(result.merged['force']['2026-10-13'].load).toBe(60);
    expect(result.hasNewLocalData).toBe(true); // Doit pousser vers le cloud
  });

  it('préserve une séance créée hors-ligne à la salle (sans tombstone)', () => {
    const tOffline = Date.now();
    const localGymSession = {
      leg: {
        '2026-10-13': {
          load: 200,
          duration: 45,
          updatedAt: tOffline,
          exercises: [{ id: 'ex1', name: 'Squat', sets: 4 }]
        }
      }
    };

    const remoteEventsEmpty = {};

    const result = mergeEventsNonDestructive(
      localGymSession,
      remoteEventsEmpty,
      {},
      {}
    );

    expect(result.merged['leg']['2026-10-13']).toBeDefined();
    expect(result.merged['leg']['2026-10-13'].load).toBe(200);
    expect(result.hasNewLocalData).toBe(true);
    expect(result.deletedKeysToPurge.length).toBe(0);
  });

  it('valide et met en attente les customExercises et les tombstones lors de l\'import JSON', () => {
    const importPayload = {
      schemaVersion: 2,
      events: {},
      customExercises: [
        {
          id: 'custom_hip_thrust',
          name: 'Hip Thrust Barre',
          category: 'lower_push',
          isCompound: true,
          muscleRatios: { fessiers: 0.8, ischio: 0.2 }
        }
      ],
      tombstones: {
        '2026-10-12_plyo': Date.now()
      }
    };

    const staged = validateAndStageImportPayload(importPayload);
    expect(staged.isValid).toBe(true);
    expect(staged.entriesToSet.has('physio_custom_exercises')).toBe(true);
    expect(staged.entriesToSet.has('physio_tombstones')).toBe(true);

    const parsedCustom = JSON.parse(staged.entriesToSet.get('physio_custom_exercises')!);
    expect(parsedCustom[0].name).toBe('Hip Thrust Barre');
    expect(parsedCustom[0].isCustom).toBe(true);
  });

  it('exclut rigoureusement les impacts secondaires de sanitizeEventsPayload pour éviter la saturation Cloud', () => {
    const rawEventsWithSecondaries = {
      sprint: {
        '2026-10-13': { load: 150, duration: 30, sport: 'run', isSecondary: false }
      },
      vo2max: {
        '2026-10-13': { load: 60, isSecondary: true, parentQId: 'sprint' }
      },
      leg: {
        '2026-10-13': { load: 120, isSecondary: true, parentQId: 'sprint' }
      }
    };

    const sanitized = sanitizeEventsPayload(rawEventsWithSecondaries);

    // Seule la séance primaire est conservée pour la persistance et la synchronisation
    expect(sanitized['sprint']?.['2026-10-13']).toBeDefined();
    expect(sanitized['sprint']['2026-10-13'].load).toBe(150);

    // Les impacts secondaires sont exclus de l'objet persistant (ils sont calculés dynamiquement à la lecture)
    expect(sanitized['vo2max']?.['2026-10-13']).toBeUndefined();
    expect(sanitized['leg']?.['2026-10-13']).toBeUndefined();
  });
});

describe('Assainissement - entrées corrompues ou hostiles', () => {
  it.each([null, undefined, 42, 'session', [], [{ load: 10 }]])('sanitizeSessionData rejette %s', (raw) => {
    expect(sanitizeSessionData(raw)).toBeNull();
  });

  it('écarte les nombres non finis et borne les valeurs hors plage', () => {
    const session = sanitizeSessionData({
      load: Number.POSITIVE_INFINITY,
      duration: Number.NaN,
      rpeMusc: 42,
      rpeCardio: -3,
      fatigue: '9',
      sport: 'run; DROP TABLE',
      exercises: 'not-an-array'
    });
    expect(session).not.toBeNull();
    expect(session?.load).toBeUndefined();
    expect(session?.duration).toBeUndefined();
    expect(session?.rpeMusc).toBe(10);
    expect(session?.rpeCardio).toBe(0);
    expect(session?.fatigue).toBeUndefined();
    expect(session?.sport).toBeUndefined();
    expect(session?.exercises).toBeUndefined();
  });

  it('filtre les exercices et sous-séances invalides au lieu de planter', () => {
    const session = sanitizeSessionData({
      load: 100,
      exercises: [null, 3, { sets: 4 }, { name: 'Squat', sets: 'x', weightKg: 2000, customRatios: { quadriceps: 3, 'bad id!': 1, glutes: 'x' } }],
      subSessions: [null, 'x', { duration: 'abc', load: -5 }]
    });
    expect(session?.exercises).toHaveLength(1);
    const ex = session?.exercises?.[0];
    expect(ex?.name).toBe('Squat');
    expect(ex?.sets).toBe(0);
    expect(ex?.weightKg).toBe(1000);
    expect(ex?.customRatios).toEqual({ quadriceps: 1 });
    expect(session?.subSessions).toHaveLength(1);
    expect(session?.subSessions?.[0]).toMatchObject({ duration: 0, load: 0 });
  });

  it('ignore les clés de pollution de prototype et les dates invalides', () => {
    const raw = JSON.parse('{"__proto__": {"2026-01-01": {"load": 1}}, "leg": {"2026-13-45": {"load": 5}, "nope": {"load": 5}, "2026-01-02": {"load": 7}}}');
    const clean = sanitizeEventsPayload(raw);
    expect(Object.keys(clean)).toEqual(['leg']);
    expect(Object.keys(clean.leg)).toEqual(['2026-01-02']);
    expect(({} as Record<string, unknown>)['2026-01-01']).toBeUndefined();
  });

  it.each([null, undefined, 'x', [1, 2]])('sanitizeEventsPayload / sanitizeDailyMetricsPayload / tombstones renvoient {} pour %s', (raw) => {
    expect(sanitizeEventsPayload(raw)).toEqual({});
    expect(sanitizeDailyMetricsPayload(raw)).toEqual({});
    expect(sanitizeTombstonesPayload(raw)).toEqual({});
  });

  it('ne garde que les métriques autorisées, finies et dans [0, 1000]', () => {
    const clean = sanitizeDailyMetricsPayload({
      '2026-01-01': { vfc: '65.4', hrRest: -1, readiness: 1e6, steps: 9000 },
      'bad-date': { vfc: 60 }
    });
    expect(clean).toEqual({ '2026-01-01': { vfc: 65 } });
  });

  it('ignore les tombstones dans le futur (horloge falsifiée) et non numériques', () => {
    const clean = sanitizeTombstonesPayload({
      '2026-10-13_leg': Date.now() + 10 * 86400000,
      '2026-10-13_push': 'abc'
    });
    expect(clean).toEqual({});
  });
});

describe('Import & fusion - échecs dégradés', () => {
  it.each([null, undefined, 'json', [], 12])('validateAndStageImportPayload refuse %s', (raw) => {
    const result = validateAndStageImportPayload(raw);
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/invalide/);
    expect(result.entriesToSet.size).toBe(0);
  });

  it('refuse un objet sans aucune donnée exploitable', () => {
    const result = validateAndStageImportPayload({ events: { 'bad id!': {} }, foo: 1 });
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/Aucune donnée valide/);
  });

  it('remonte une erreur lisible quand un getter du payload lève une exception', () => {
    const hostile = {
      get events() {
        throw new Error('boom');
      }
    };
    const result = validateAndStageImportPayload(hostile);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Erreur d'analyse des données : boom");
  });

  it('borne les blocs importés et ignore une compétition sans date valide', () => {
    const result = validateAndStageImportPayload({
      trainingBlocks: [null, { id: 'b1', durationWeeks: 999, focusQualities: ['leg', 3, 'bad id!'] }],
      targetCompetition: { name: 'Trail', date: 'demain' }
    });
    expect(result.isValid).toBe(true);
    expect(result.summary.blocksCount).toBe(1);
    const blocks = JSON.parse(result.entriesToSet.get('physio_training_blocks') ?? '[]');
    expect(blocks[0]).toMatchObject({ id: 'b1', durationWeeks: 52, focusQualities: ['leg'] });
    expect(result.entriesToSet.has('physio_target_competition')).toBe(false);
  });

  it('mergeEventsNonDestructive tolère des côtés vides et ignore les filières invalides', () => {
    const result = mergeEventsNonDestructive({ 'bad id!': { '2026-01-01': { load: 1 } } }, {});
    expect(result.merged).toEqual({});
    expect(result.deletedKeysToPurge).toEqual([]);
  });

  it('mergeDailyMetricsNonDestructive préfère la valeur distante et signale une valeur locale seule', () => {
    const { merged, hasNewLocalData } = mergeDailyMetricsNonDestructive(
      { '2026-01-01': { vfc: 60, hrRest: 50 }, 'bad-date': { vfc: 1 } },
      { '2026-01-01': { vfc: 70, hrRest: undefined } }
    );
    expect(merged).toEqual({ '2026-01-01': { vfc: 70, hrRest: 50 } });
    expect(hasNewLocalData).toBe(true);
  });
});

describe('Cloud Sync - Résilience de session, jetons et isolation du stockage', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
      key: (i: number) => Object.keys(mockStorage)[i] ?? null,
      get length() { return Object.keys(mockStorage).length; }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('détecte fidèlement la présence de données de santé sans faux-positif sur les identifiants', () => {
    expect(hasLocalHealthData()).toBe(false);

    // Seulement l'identifiant matériel d'appareil : pas de données de santé
    localStorage.setItem('physio_device_id', 'pc_test123');
    localStorage.setItem('physio_user_account', JSON.stringify({ email: 'test@example.com' }));
    expect(hasLocalHealthData()).toBe(false);

    // Présence d'une entrée de santé temporelle
    localStorage.setItem('2026-10-26_events', JSON.stringify({ force: { load: 100 } }));
    expect(hasLocalHealthData()).toBe(true);
  });

  it('purge hermétiquement les données de santé tout en préservant physio_device_id', () => {
    localStorage.setItem('physio_device_id', 'mobile_unique_uuid');
    localStorage.setItem('2026-10-25_events', '{"load": 120}');
    localStorage.setItem('2026-10-26_metrics', '{"vfc": 65}');
    localStorage.setItem('physio_training_blocks', '[]');
    localStorage.setItem('training_live_session_draft_v1', '{"stage":"active"}');

    purgeLocalHealthStorage();

    // L'identifiant matériel doit être strictement préservé
    expect(localStorage.getItem('physio_device_id')).toBe('mobile_unique_uuid');

    // Les données de santé et le brouillon doivent être effacés
    expect(localStorage.getItem('2026-10-25_events')).toBeNull();
    expect(localStorage.getItem('2026-10-26_metrics')).toBeNull();
    expect(localStorage.getItem('physio_training_blocks')).toBeNull();
    expect(localStorage.getItem('training_live_session_draft_v1')).toBeNull();
  });
});


