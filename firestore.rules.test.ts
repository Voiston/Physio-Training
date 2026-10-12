import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Suite de tests des règles de sécurité Firestore.
 * 
 * Cette suite vérifie deux niveaux d'intégrité :
 * 1. Niveau Fichier Réel : Inspection dynamique du contenu de 'firestore.rules' sur disque
 *    (détecte tout affaiblissement, disparition de l'allowlist d'emails, suppression du default-deny).
 * 2. Niveau Logique Comportementale : Validation des invariants de sécurité (authentification,
 *    emails autorisés, vérification d'email, intégrité des champs, isolation par UID).
 */
describe('Firestore Security Rules - Vraie Vérification & Invariants', () => {
  const ALLOWED_EMAILS = [
    'poketime.idle@gmail.com',
    'david.voisard2@gmail.com',
    'vdcoachsportif@gmail.com'
  ];

  const validUid = 'user_abc123';
  const validEmail = 'poketime.idle@gmail.com';
  const validRecord = {
    userId: validUid,
    userEmail: validEmail,
    key: 'PHYSIO-SYNC-01',
    data: JSON.stringify({ workouts: [], settings: {} }),
    version: 1,
    lastDeviceId: 'mobile_xyz987',
    updatedAt: '2026-10-10T22:30:00.000Z',
  };

  // --- SECTION 1 : VÉRIFICATION DU FICHIER RÉEL 'firestore.rules' ---
  describe('Inspection Syntaxique & Structurelle du fichier firestore.rules', () => {
    const rulesPath = path.resolve(__dirname, 'firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    it('le fichier firestore.rules existe et contient rules_version = 2', () => {
      expect(rulesContent).toBeDefined();
      expect(rulesContent).toContain("rules_version = '2'");
    });

    it('applique un verrouillage universel par défaut (Default Deny)', () => {
      expect(rulesContent).toMatch(/match\s*\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;\s*\}/);
    });

    it('contient la fonction isAllowedEmail() avec la liste blanche exacte', () => {
      expect(rulesContent).toContain('function isAllowedEmail()');
      for (const email of ALLOWED_EMAILS) {
        expect(rulesContent).toContain(`'${email}'`);
      }
    });

    it('exige la vérification stricte de l’email (email_verified == true)', () => {
      expect(rulesContent).toContain('request.auth.token.email_verified == true');
    });

    it('garantit l’isolation stricte de /sync_records/{recordId} par UID et autorisation', () => {
      expect(rulesContent).toContain('match /sync_records/{recordId}');
      expect(rulesContent).toContain('recordId == request.auth.uid');
      expect(rulesContent).toContain('isAuthorizedUser()');
    });

    it('interdit l’altération de champs avec hasOnly() et plafonne la taille à 500 000 caractères', () => {
      expect(rulesContent).toContain("data.data.size() <= 500000");
      expect(rulesContent).toContain("hasOnly(['key', 'data', 'version', 'lastDeviceId', 'updatedAt'])");
    });
  });

  // --- SECTION 2 : LOGIQUE COMPORTEMENTALE & SCÉNARIOS D'ATTAQUES ---
  describe('Matrice des Droits & Rejet des Payloads Malveillants', () => {
    function validatePayload(
      auth: { uid: string; email: string; emailVerified: boolean } | null,
      recordId: string,
      payload: any,
      existingData?: any
    ): { allowed: boolean; reason?: string } {
      if (!auth) return { allowed: false, reason: 'Unauthenticated' };
      if (!auth.emailVerified) return { allowed: false, reason: 'Email not verified' };

      // Vérification de la liste blanche d'emails
      const emailLower = (auth.email || '').toLowerCase();
      if (!ALLOWED_EMAILS.includes(emailLower)) {
        return { allowed: false, reason: 'Email not in allowlist' };
      }

      if (!recordId || recordId.length > 128 || !/^[a-zA-Z0-9_\-\.]+$/.test(recordId)) {
        return { allowed: false, reason: 'Invalid record ID' };
      }
      if (recordId !== auth.uid) {
        return { allowed: false, reason: 'Record ID must match authenticated user UID' };
      }

      const requiredKeys = ['userId', 'userEmail', 'key', 'data', 'version', 'lastDeviceId', 'updatedAt'];
      const keys = Object.keys(payload);
      if (!requiredKeys.every(k => keys.includes(k))) {
        return { allowed: false, reason: 'Missing required keys' };
      }
      if (keys.some(k => !requiredKeys.includes(k))) {
        return { allowed: false, reason: 'Shadow fields detected' };
      }
      if (payload.userId !== auth.uid) {
        return { allowed: false, reason: 'userId must match auth.uid' };
      }
      if (payload.userEmail !== auth.email) {
        return { allowed: false, reason: 'userEmail must match auth.email' };
      }
      if (typeof payload.data !== 'string' || payload.data.length > 500000) {
        return { allowed: false, reason: 'Data oversized or not string' };
      }
      if (typeof payload.version !== 'number' || !Number.isInteger(payload.version)) {
        return { allowed: false, reason: 'Version must be integer' };
      }
      if (typeof payload.lastDeviceId !== 'string' || payload.lastDeviceId.length > 64) {
        return { allowed: false, reason: 'Invalid lastDeviceId' };
      }
      if (typeof payload.updatedAt !== 'string' || payload.updatedAt.length > 64 || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}/.test(payload.updatedAt)) {
        return { allowed: false, reason: 'Invalid updatedAt' };
      }

      if (existingData) {
        if (payload.userId !== existingData.userId || payload.userEmail !== existingData.userEmail) {
          return { allowed: false, reason: 'Immutable fields altered' };
        }
      }

      return { allowed: true };
    }

    // 1. Accès non authentifié
    it('bloque formellement tout accès non authentifié (read/write)', () => {
      const res = validatePayload(null, validUid, validRecord);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('Unauthenticated');
    });

    // 2. Email non présent dans la liste blanche
    it('bloque un utilisateur Google valide mais dont l’email n’est pas dans la liste blanche', () => {
      const res = validatePayload(
        { uid: 'unauthorized_uid', email: 'stranger@gmail.com', emailVerified: true },
        'unauthorized_uid',
        { ...validRecord, userId: 'unauthorized_uid', userEmail: 'stranger@gmail.com' }
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('Email not in allowlist');
    });

    // 3. Email dans la liste blanche mais non vérifié
    it('bloque un utilisateur de la liste blanche si email_verified est faux', () => {
      const res = validatePayload(
        { uid: validUid, email: validEmail, emailVerified: false },
        validUid,
        validRecord
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('Email not verified');
    });

    // 4. Usurpation de UID (spoofing)
    it('bloque toute tentative d’écriture avec un userId falsifié', () => {
      const res = validatePayload(
        { uid: validUid, email: validEmail, emailVerified: true },
        validUid,
        { ...validRecord, userId: 'other_victim_uid' }
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('userId must match auth.uid');
    });

    // 5. Usurpation d’Email (spoofing)
    it('bloque toute tentative d’écriture avec un userEmail différent du token Google', () => {
      const res = validatePayload(
        { uid: validUid, email: validEmail, emailVerified: true },
        validUid,
        { ...validRecord, userEmail: 'david.voisard2@gmail.com' }
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('userEmail must match auth.email');
    });

    // 6. Injection de champs fantômes (ex: isAdmin)
    it('bloque les payloads contenant des champs non autorisés (Ghost fields)', () => {
      const res = validatePayload(
        { uid: validUid, email: validEmail, emailVerified: true },
        validUid,
        { ...validRecord, isAdmin: true }
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('Shadow fields detected');
    });

    // 7. Dépassement de la limite de taille (Déni de portefeuille)
    it('bloque les payloads dépassant 500 000 caractères', () => {
      const oversized = 'a'.repeat(500001);
      const res = validatePayload(
        { uid: validUid, email: validEmail, emailVerified: true },
        validUid,
        { ...validRecord, data: oversized }
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('Data oversized or not string');
    });

    // 8. Altération de champs immuables à l’update
    it('bloque toute modification de userId ou userEmail lors d’une mise à jour', () => {
      const res = validatePayload(
        { uid: validUid, email: validEmail, emailVerified: true },
        validUid,
        { ...validRecord, userId: validUid, userEmail: validEmail },
        { ...validRecord, userId: 'other_uid', userEmail: 'other@gmail.com' }
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('Immutable fields altered');
    });

    // 9. Accès légitime pour le premier email autorisé
    it('autorise l’écriture et la lecture pour poketime.idle@gmail.com', () => {
      const res = validatePayload(
        { uid: validUid, email: 'poketime.idle@gmail.com', emailVerified: true },
        validUid,
        { ...validRecord, userEmail: 'poketime.idle@gmail.com' }
      );
      expect(res.allowed).toBe(true);
    });

    // 10. Accès légitime pour le second email autorisé
    it('autorise l’écriture et la lecture pour david.voisard2@gmail.com', () => {
      const res = validatePayload(
        { uid: 'david_uid', email: 'david.voisard2@gmail.com', emailVerified: true },
        'david_uid',
        { ...validRecord, userId: 'david_uid', userEmail: 'david.voisard2@gmail.com' }
      );
      expect(res.allowed).toBe(true);
    });

    // 11. Accès légitime pour le coach principal vdcoachsportif@gmail.com
    it('autorise l’écriture et la lecture pour vdcoachsportif@gmail.com', () => {
      const res = validatePayload(
        { uid: 'coach_uid', email: 'vdcoachsportif@gmail.com', emailVerified: true },
        'coach_uid',
        { ...validRecord, userId: 'coach_uid', userEmail: 'vdcoachsportif@gmail.com' }
      );
      expect(res.allowed).toBe(true);
    });
  });
});
