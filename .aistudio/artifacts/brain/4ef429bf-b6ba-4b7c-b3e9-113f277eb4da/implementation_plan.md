# Synchronisation Cloud Temps Réel Smartphone & PC (Firebase & Google Auth)

Mise en place d'une synchronisation automatique et transparente entre tous vos appareils (smartphone, PC, tablette) grâce à Firebase Firestore et à la connexion en 1 clic avec votre compte Google, tout en conservant le fonctionnement hors-ligne à la salle de sport.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Choix validés lors de la phase de cadrage :**
> - **Méthode de synchronisation** : Base de données Cloud Firestore en temps réel avec compte utilisateur.
> - **Authentification** : Connexion en 1 clic via compte Google (`signInWithPopup`), sans mot de passe à retenir.
> - **Sécurité & Règles d'accès** : Données 100% privées et partitionnées par `userId`, protégées par des règles Firestore strictes.

- **Migration des données existantes** : Vos séances et réglages actuellement stockés dans le navigateur seront automatiquement proposés à la migration vers votre compte Google lors de votre première connexion, sans risque de perte.
- **Résilience hors-ligne (Salle de sport)** : Le cache local et le support offline de Firestore garantiront que vos séances saisies sur smartphone sans réseau (ex: sous-sol de salle) restent enregistrées et se synchronisent dès que la connexion est rétablie.

---

## 1. Overview & Core Concept

### Ce que cela apporte
- **Synchronisation bidirectionnelle automatique** : Toute série validée ou séance enregistrée sur votre smartphone en direct à la salle apparaît instantanément sur votre PC sans jamais devoir exporter/importer de fichier.
- **Continuité multi-écrans** : Préparez ou analysez vos blocs d'entraînement, vos graphiques EMA et votre tapering confortablement sur grand écran PC, puis effectuez vos saisies en direct sur mobile au format ergonomique.
- **Sauvegarde pérenne dans le Cloud** : Même en cas de changement de smartphone, de vidage du cache ou de navigation privée, vos données restent sécurisées sur votre compte Google personnel.

### Profils d'usage
- **À la salle (Smartphone)** : Mode direct, chrono de repos, enregistrement de reps/charges avec maintien de l'écran allumé, résilience aux pertes de réseau.
- **À la maison / Au bureau (PC)** : Revue hebdomadaire, simulation *What-If*, ajustements des constantes physiologiques et des blocs de périodisation.

---

## 2. User Experience & Visual Design

### A. Composants UI & Expérience Utilisateur
1. **Bouton & Badge d'authentification dans le Header (Zone Top Bar Contract)** :
   - *État Déconnecté* : Bouton discret et élégant `"Se connecter avec Google"` avec icône Google, permettant une synchronisation instantanée.
   - *État Connecté* : Avatar de l'utilisateur, prénom ou adresse email, et un indicateur textuel d'état de synchronisation propre (`Synchro active` / `Enregistré`). Menu déroulant minimaliste pour se déconnecter ou forcer une synchronisation.
2. **Modal d'accueil & Migration initiale** :
   - À la première connexion avec Google, si des séances existent déjà en local, une invitation claire propose de migrer l'historique local vers le Cloud en 1 clic.
3. **Indicateur de statut réseau & synchronisation (Anti-slop)** :
   - Respect strict de la charte : aucun badge encombrant ou clignotant. Simple mention discrète en bas de page ou dans le profil signalant l'état (`Connecté au Cloud` ou `En attente de connexion (hors-ligne)`).

### B. Tokens Graphiques & Direction Visuelle
- Palette sombre cohérente avec l'application : `slate-900` / `slate-800`, bordures fines `border-slate-700/60`, accents `indigo-500` / `emerald-500`.
- Typographie : `font-sans` pour l'interface, `font-mono tabular-nums` pour les compteurs et horodatages.

---

## 3. Key Product Decisions & Trade-Offs

### Décision 1 : Modèle de données Firestore (Collection unifiée par utilisateur)
- **Approche retenue** : Arborescence `users/{userId}/userData/state` avec sous-documents et collections pour les sessions (`users/{userId}/sessions/{sessionId}`) et les métriques journalières (`users/{userId}/metrics/{dateStr}`), plus configuration (`users/{userId}/settings/config`).
- **Pourquoi** : Permet des requêtes atomiques rapides, évite de charger des mégabytes d'historique complet lors d'une simple mise à jour, et garantit un cloisonnement de sécurité étanche (aucun utilisateur ne peut lire les données d'un autre).
- **Alternative écartée** : Fichier JSON unique stocké dans un seul document : risquerait de dépasser la limite de 1 Mo par document Firestore après plusieurs années d'entraînement intensif.

### Décision 2 : Mode hybride (Fallback LocalStorage pour utilisateurs non connectés)
- **Approche retenue** : L'application reste utilisable à 100% même si l'utilisateur choisit de ne pas se connecter. S'il se connecte, Firestore prend le relais comme source de vérité avec mise en miroir locale.
- **Pourquoi** : Zéro friction pour commencer ou tester, avec montée en gamme immédiate dès la connexion.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Flux de Données

```
┌─────────────────────────────────────────────────────────────┐
│                      INTERFACE REACT                        │
│   (AppContent, LiveGymModal, Grid, PeriodizationView...)    │
└──────────────┬──────────────────────────────▲───────────────┘
               │ Mutations (saveEvent, etc.)   │ État réactif
               ▼                               │
┌─────────────────────────────────────────────────────────────┐
│                      useData Hook                           │
│  - Synchronisation bidirectionnelle                         │
│  - Gestion cache mémoire & état hors-ligne                  │
└──────────────┬──────────────────────────────▲───────────────┘
               │                               │
        ┌──────┴──────┐                 ┌──────┴──────┐
        ▼             ▼                 ▲             ▲
   [Local Cache] [Firebase Auth]  [Firestore DB] [onSnapshot]
   localStorage   Google Popup     Cloud Storage  Temps réel
   (Persistance)  (Identité)       (Cloud Sync)  (PC <-> Phone)
```

### Modèle de Sécurité Firestore (`firestore.rules`)
- Chaque document sous `/users/{userId}/...` est strictement restreint à `request.auth.uid == userId`.
- Interdiction de toute lecture ou écriture publique ou non authentifiée.
- Validation des schémas et tailles de payload (anti-tampering).

### Plan d'Étapes d'Exécution (Phase 3)
1. **Provisionnement Firebase** : Déclenchement de l'outil d'intégration `show_aistudio_ui` (`firebase_setup`) et provisionnement Firestore / Auth.
2. **Schéma & Blueprint** : Création de `firebase-blueprint.json` et des règles de sécurité hermétiques `firestore.rules`.
3. **Service Cloud & Auth Provider** : Configuration du SDK Firebase client (`src/utils/firebase.ts`) et du `AuthProvider` / `useAuth`.
4. **Intégration dans `useData`** : Liaison transparente du flux Firestore `onSnapshot` avec repli automatique sur le cache local, et fonction de synchronisation initiale.
5. **UI Header & Gestion de profil** : Ajout du bouton de connexion Google et du statut de synchronisation dans la barre supérieure.
6. **Vérification multi-plateforme** : Test du cycle complet de création de séance sur mobile -> reflet immédiat sur PC.
