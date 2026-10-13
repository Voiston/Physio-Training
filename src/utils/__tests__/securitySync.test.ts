import { describe, it, expect } from 'vitest';
import {
  sanitizeSessionData,
  sanitizeTombstonesPayload,
  mergeEventsNonDestructive,
  validateAndStageImportPayload
} from '../security';

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
    expect(session.updatedAt).toBe(timestamp);
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
});
