# Spécification de Sécurité Firestore - PhysioTracker PRO

## 1. Invariants de Données (Data Invariants)
- **Invariant d'Authentification (Identity)** : Tout enregistrement de synchronisation `/sync_records/{recordId}` ne peut être accédé, créé ou modifié que par un utilisateur Google authentifié (`request.auth != null`) et vérifié (`request.auth.token.email_verified == true`).
- **Invariant d'Isolation UID Absolu (UID Anchor)** : Le chemin de stockage `recordId` est strictement égal à `request.auth.uid`. Aucun utilisateur ne peut créer ou lire un document dont l'ID ne correspond pas à son propre UID.
- **Invariant de Propriété (Ownership)** : L'identifiant `incoming().userId` doit correspondre strictement à `request.auth.uid`. L'email `incoming().userEmail` doit correspondre à `request.auth.token.email`.
- **Invariant d'Immutabilité (Immortality)** : Les champs `userId` et `userEmail` ne peuvent pas être altérés lors d'une mise à jour (`incoming().userId == existing().userId && incoming().userEmail == existing().userEmail`).
- **Invariant de Clé & ID (ID Poisoning Guard)** : Le `recordId` doit être un identifiant valide (`isValidId(recordId)` avec taille <= 128 et caractères autorisés `^[a-zA-Z0-9_\-\.]+$`).
- **Invariant de Limite Volumétrique (Denial of Wallet)** : La charge utile `data` ne doit pas excéder 500 000 caractères, `key` <= 128 caractères, `lastDeviceId` <= 64 caractères.
- **Invariant Anti-Fuite d'Existence** : L'accès en lecture `allow get` impose `recordId == request.auth.uid`, interdisant d'énumérer l'existence d'autres enregistrements sur la base du `resource == null`.

## 2. The "Dirty Dozen" Payloads (Attaques rejetées)
1. **Unauthenticated Read** : Lecture anonyme / non connectée sur `/sync_records/rec123`.
2. **Unauthenticated Write** : Écriture anonyme sur `/sync_records/rec123`.
3. **Spoofed User ID** : Écriture avec `userId: "attacker_uid"` alors que `request.auth.uid == "victim_uid"`.
4. **Spoofed Email** : Écriture avec `userEmail: "admin@google.com"` alors que `request.auth.token.email == "user@gmail.com"`.
5. **Unverified Email Write** : Écriture par un utilisateur dont `email_verified == false`.
6. **ID Injection / Poisoning** : Tentative d'écriture sur un chemin avec un ID malformé ou injecté.
7. **Oversized Payload (Denial of Wallet)** : Tentative d'écrire une charge `data` de plus de 500KB.
8. **Shadow Field Injection** : Ajout d'un champ non autorisé `isAdmin: true` lors de la création ou mise à jour.
9. **Missing Required Fields** : Omission d'un champ obligatoire comme `key` ou `lastDeviceId`.
10. **Type Mismatch Attack** : Envoi de `version: "invalid_string"` au lieu d'un nombre entier.
11. **Ownership Theft Update** : Tentative de remplacer le `userId` du document existant par son propre identifiant.
12. **Cross-Tenant Squatting / Probing** : Utilisateur B tentant d'enregistrer ou de sonder un document avec `recordId` appartenant à l'utilisateur A.

## 3. Matrice de Contrôle et Tests
Toutes les 12 attaques ci-dessus retournent obligatoirement `PERMISSION_DENIED`.
La suite de tests unitaires `firestore.rules.test.ts` valide chaque scénario de test d'intrusion.
