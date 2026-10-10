/**
 * Helpers et modélisation physiologique de la charge par groupe musculaire.
 * 
 * Basé sur les standards en sciences du sport (Schoenfeld 2010, 2019; Helms et al. 2014; Israetel et al. 2020) :
 * - Hard Sets (Séries effectives proches de l'échec) pondérées par le ratio d'implication musculaire.
 * - Repères de volume hebdomadaire par groupe musculaire :
 *     * MV (Maintenance Volume) : < 6 séries / semaine
 *     * MEV (Minimum Effective Volume) : 6 à 10 séries / semaine
 *     * MAV (Maximum Adaptive Volume) : 10 à 20 séries / semaine (zone optimale d'adaptation)
 *     * MRV (Maximum Recoverable Volume) : > 20-22 séries / semaine (seuil de saturation / surmenage local)
 * - Ratios d'équilibre :
 *     * H:Q ratio (Ischios / Quadriceps) : visée >= 0.60 (prévention LCA et santé fémoro-patellaire)
 *     * Pull:Push ratio (Tirage / Poussée) : visée >= 1.0 (centrage huméral et santé de la coiffe des rotateurs)
 */

export interface MuscleGroup {
  id: string;
  name: string;
  category: 'lower' | 'upper_push' | 'upper_pull' | 'core';
  categoryLabel: string;
  color: string;
}

export const MUSCLE_GROUPS: Record<string, MuscleGroup> = {
  quadriceps: { id: 'quadriceps', name: 'Quadriceps', category: 'lower', categoryLabel: 'Bas du corps', color: '#38bdf8' },
  ischios: { id: 'ischios', name: 'Ischio-jambiers', category: 'lower', categoryLabel: 'Bas du corps', color: '#f59e0b' },
  glutes: { id: 'glutes', name: 'Fessiers', category: 'lower', categoryLabel: 'Bas du corps', color: '#ec4899' },
  mollets: { id: 'mollets', name: 'Mollets', category: 'lower', categoryLabel: 'Bas du corps', color: '#a855f7' },
  pectoraux: { id: 'pectoraux', name: 'Pectoraux', category: 'upper_push', categoryLabel: 'Haut du corps (Push)', color: '#ef4444' },
  deltoides_ant: { id: 'deltoides_ant', name: 'Épaules (Antérieur / Latéral)', category: 'upper_push', categoryLabel: 'Haut du corps (Push)', color: '#f97316' },
  triceps: { id: 'triceps', name: 'Triceps', category: 'upper_push', categoryLabel: 'Haut du corps (Push)', color: '#eab308' },
  dorsaux: { id: 'dorsaux', name: 'Grand Dorsal (Largeur dos)', category: 'upper_pull', categoryLabel: 'Haut du corps (Pull)', color: '#10b981' },
  trapezes: { id: 'trapezes', name: 'Trapèzes & Haut du dos', category: 'upper_pull', categoryLabel: 'Haut du corps (Pull)', color: '#14b8a6' },
  biceps: { id: 'biceps', name: 'Biceps / Fléchisseurs', category: 'upper_pull', categoryLabel: 'Haut du corps (Pull)', color: '#06b6d4' },
  abdos: { id: 'abdos', name: 'Sangle Abdominale & Gainage', category: 'core', categoryLabel: 'Tronc & Core', color: '#8b5cf6' },
  lombaires: { id: 'lombaires', name: 'Érecteurs du Rachis (Lombaires)', category: 'core', categoryLabel: 'Tronc & Core', color: '#64748b' },
};

export interface ExerciseDefinition {
  id: string;
  name: string;
  category: 'lower' | 'upper_push' | 'upper_pull' | 'core';
  isCompound: boolean;
  defaultReps: number;
  muscleRatios: Record<string, number>; // muscleId -> ratio (0.1 à 1.0)
}

export const EXERCISE_CATALOG: ExerciseDefinition[] = [
  // --- BAS DU CORPS (LOWER) ---
  {
    id: 'squat',
    name: 'Squat (Barre / Goblet / Hack)',
    category: 'lower',
    isCompound: true,
    defaultReps: 8,
    muscleRatios: { quadriceps: 1.0, glutes: 0.7, lombaires: 0.4, abdos: 0.3 }
  },
  {
    id: 'presse',
    name: 'Presse à cuisses (Leg Press)',
    category: 'lower',
    isCompound: true,
    defaultReps: 10,
    muscleRatios: { quadriceps: 1.0, glutes: 0.5 }
  },
  {
    id: 'fentes',
    name: 'Fentes / Split Squat Bulgare',
    category: 'lower',
    isCompound: true,
    defaultReps: 10,
    muscleRatios: { quadriceps: 0.85, glutes: 0.9, ischios: 0.3 }
  },
  {
    id: 'leg_extension',
    name: 'Leg Extension (Isolation)',
    category: 'lower',
    isCompound: false,
    defaultReps: 12,
    muscleRatios: { quadriceps: 1.0 }
  },
  {
    id: 'deadlift',
    name: 'Soulevé de terre classique (Deadlift)',
    category: 'lower',
    isCompound: true,
    defaultReps: 5,
    muscleRatios: { ischios: 0.8, glutes: 0.9, lombaires: 0.8, dorsaux: 0.4, trapezes: 0.6 }
  },
  {
    id: 'rdl',
    name: 'Soulevé de terre roumain (RDL / JT)',
    category: 'lower',
    isCompound: true,
    defaultReps: 8,
    muscleRatios: { ischios: 1.0, glutes: 0.8, lombaires: 0.5 }
  },
  {
    id: 'leg_curl',
    name: 'Leg Curl (Assis / Couché)',
    category: 'lower',
    isCompound: false,
    defaultReps: 12,
    muscleRatios: { ischios: 1.0 }
  },
  {
    id: 'hip_thrust',
    name: 'Hip Thrust (Fessiers)',
    category: 'lower',
    isCompound: true,
    defaultReps: 10,
    muscleRatios: { glutes: 1.0, ischios: 0.4 }
  },
  {
    id: 'mollets',
    name: 'Mollets (Debout / Assis)',
    category: 'lower',
    isCompound: false,
    defaultReps: 15,
    muscleRatios: { mollets: 1.0 }
  },

  // --- HAUT DU CORPS - POUSSÉE (UPPER PUSH) ---
  {
    id: 'bench_press',
    name: 'Développé couché (Bench Press)',
    category: 'upper_push',
    isCompound: true,
    defaultReps: 8,
    muscleRatios: { pectoraux: 1.0, triceps: 0.65, deltoides_ant: 0.5 }
  },
  {
    id: 'incline_bench',
    name: 'Développé incliné (Barre / Haltères)',
    category: 'upper_push',
    isCompound: true,
    defaultReps: 10,
    muscleRatios: { pectoraux: 0.85, deltoides_ant: 0.8, triceps: 0.5 }
  },
  {
    id: 'dips',
    name: 'Dips aux barres parallèles',
    category: 'upper_push',
    isCompound: true,
    defaultReps: 10,
    muscleRatios: { triceps: 0.85, pectoraux: 0.8, deltoides_ant: 0.5 }
  },
  {
    id: 'ecartes',
    name: 'Écartés haltères / Câble / Pec Deck',
    category: 'upper_push',
    isCompound: false,
    defaultReps: 12,
    muscleRatios: { pectoraux: 1.0 }
  },
  {
    id: 'ohp',
    name: 'Développé militaire (Overhead Press)',
    category: 'upper_push',
    isCompound: true,
    defaultReps: 6,
    muscleRatios: { deltoides_ant: 1.0, triceps: 0.6, trapezes: 0.4, abdos: 0.3 }
  },
  {
    id: 'lateral_raises',
    name: 'Élévations latérales (Haltères / Poulie)',
    category: 'upper_push',
    isCompound: false,
    defaultReps: 15,
    muscleRatios: { deltoides_ant: 1.0, trapezes: 0.3 }
  },
  {
    id: 'triceps_extension',
    name: 'Extensions triceps (Poulie / Barre front)',
    category: 'upper_push',
    isCompound: false,
    defaultReps: 12,
    muscleRatios: { triceps: 1.0 }
  },

  // --- HAUT DU CORPS - TIRAGE (UPPER PULL) ---
  {
    id: 'pull_ups',
    name: 'Tractions (Pronation / Supination / Anneaux)',
    category: 'upper_pull',
    isCompound: true,
    defaultReps: 8,
    muscleRatios: { dorsaux: 1.0, biceps: 0.7, trapezes: 0.5 }
  },
  {
    id: 'lat_pulldown',
    name: 'Tirage vertical à la poulie (Lat Pulldown)',
    category: 'upper_pull',
    isCompound: true,
    defaultReps: 10,
    muscleRatios: { dorsaux: 1.0, biceps: 0.6, trapezes: 0.4 }
  },
  {
    id: 'barbell_row',
    name: 'Rowing barre / Buste penché (Bent Row)',
    category: 'upper_pull',
    isCompound: true,
    defaultReps: 8,
    muscleRatios: { dorsaux: 0.85, trapezes: 0.85, biceps: 0.5, lombaires: 0.4 }
  },
  {
    id: 'cable_row',
    name: 'Tirage horizontal (Rowing assis poulie)',
    category: 'upper_pull',
    isCompound: true,
    defaultReps: 10,
    muscleRatios: { dorsaux: 0.8, trapezes: 0.9, biceps: 0.5 }
  },
  {
    id: 'face_pull',
    name: 'Face Pull / Oiseau banc incliné',
    category: 'upper_pull',
    isCompound: false,
    defaultReps: 15,
    muscleRatios: { trapezes: 0.85, deltoides_ant: 0.6 }
  },
  {
    id: 'biceps_curl',
    name: 'Curl Biceps (Barre / Haltères / Poulie)',
    category: 'upper_pull',
    isCompound: false,
    defaultReps: 10,
    muscleRatios: { biceps: 1.0 }
  },

  // --- TRONC & CORE ---
  {
    id: 'abdos_crunch',
    name: 'Crunch / Enroulement de bassin',
    category: 'core',
    isCompound: false,
    defaultReps: 15,
    muscleRatios: { abdos: 1.0 }
  },
  {
    id: 'plank',
    name: 'Gainage Planche / Pallof Press',
    category: 'core',
    isCompound: false,
    defaultReps: 1, // secondes converties ou rep
    muscleRatios: { abdos: 1.0, lombaires: 0.4 }
  },
  {
    id: 'hyperextensions',
    name: 'Banc à lombaires / Hyperextensions',
    category: 'core',
    isCompound: true,
    defaultReps: 12,
    muscleRatios: { lombaires: 1.0, glutes: 0.7, ischios: 0.5 }
  }
];

export interface SessionExercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  rpe: number;
  weightKg?: number;
  customRatios?: Record<string, number>;
}

export interface MuscleBreakdownItem {
  muscleId: string;
  name: string;
  category: 'lower' | 'upper_push' | 'upper_pull' | 'core';
  categoryLabel: string;
  color: string;
  directSets: number;    // Séries où le ratio >= 0.8
  effectiveSets: number; // Somme des (séries * ratio)
  repsTotal: number;     // Somme des (séries * reps * ratio)
  estimatedLoad: number; // Indice de volume-charge : séries * reps * (rpe / 10) * ratio
  exercises: { name: string; sets: number; ratio: number }[];
}

export interface SessionMuscularAnalysis {
  muscleLoads: Record<string, MuscleBreakdownItem>;
  sortedMuscles: MuscleBreakdownItem[];
  totalSets: number;
  totalReps: number;
  weightedAvgRpe: number;
  suggestedDuration: number;
  suggestedRpeMusc: number;
}

/**
 * Calcule la décomposition musculaire détaillée d'une liste d'exercices d'une séance.
 */
export function computeSessionMuscularBreakdown(
  exercises: SessionExercise[] = [],
  customCatalog: ExerciseDefinition[] = []
): SessionMuscularAnalysis {
  const muscleMap: Record<string, MuscleBreakdownItem> = {};
  const mergedCatalog = customCatalog.length > 0 ? [...customCatalog, ...EXERCISE_CATALOG] : EXERCISE_CATALOG;

  // Initialisation avec tous les muscles enregistrés
  Object.values(MUSCLE_GROUPS).forEach(m => {
    muscleMap[m.id] = {
      muscleId: m.id,
      name: m.name,
      category: m.category,
      categoryLabel: m.categoryLabel,
      color: m.color,
      directSets: 0,
      effectiveSets: 0,
      repsTotal: 0,
      estimatedLoad: 0,
      exercises: []
    };
  });

  let totalSets = 0;
  let totalReps = 0;
  let weightedRpeSum = 0;

  exercises.forEach(ex => {
    const sets = Math.max(0, Number(ex.sets) || 0);
    const reps = Math.max(0, Number(ex.reps) || 0);
    const rpe = Math.min(10, Math.max(1, Number(ex.rpe) || 7));
    const weight = Number(ex.weightKg) || 0;

    if (sets <= 0) return;

    totalSets += sets;
    totalReps += sets * reps;
    weightedRpeSum += sets * rpe;

    // Retrouver la matrice d'activation
    const catalogItem = mergedCatalog.find(c => c.id === ex.id);
    const ratios = ex.customRatios || catalogItem?.muscleRatios || {
      // Si exercice inconnu, essayer d'assigner selon son nom
      quadriceps: 0.5,
      ischios: 0.5
    };

    Object.entries(ratios).forEach(([muscleId, ratio]) => {
      if (!muscleMap[muscleId]) {
        muscleMap[muscleId] = {
          muscleId,
          name: muscleId,
          category: 'lower',
          categoryLabel: 'Autre',
          color: '#94a3b8',
          directSets: 0,
          effectiveSets: 0,
          repsTotal: 0,
          estimatedLoad: 0,
          exercises: []
        };
      }

      const m = muscleMap[muscleId];
      const effSets = Number((sets * ratio).toFixed(1));
      const effReps = Math.round(sets * reps * ratio);
      const estLoad = Math.round(sets * reps * (rpe / 10) * ratio);

      m.effectiveSets = Number((m.effectiveSets + effSets).toFixed(1));
      m.repsTotal += effReps;
      m.estimatedLoad += estLoad;

      if (ratio >= 0.75) {
        m.directSets += sets;
      }

      m.exercises.push({
        name: ex.name,
        sets,
        ratio
      });
    });
  });

  const weightedAvgRpe = totalSets > 0 ? Number((weightedRpeSum / totalSets).toFixed(1)) : 7;
  
  // Durée estimée : environ 3 à 4 min par série effective (temps d'exécution + 2 à 3 min de récupération inter-séries)
  // min 15 minutes, max 150 minutes
  const suggestedDuration = totalSets > 0 ? Math.min(150, Math.max(15, Math.round(totalSets * 3.5))) : 45;
  const suggestedRpeMusc = Math.min(10, Math.max(1, Math.round(weightedAvgRpe)));

  // Liste triée par nombre de séries effectives décroissantes
  const sortedMuscles = Object.values(muscleMap)
    .filter(m => m.effectiveSets > 0)
    .sort((a, b) => b.effectiveSets - a.effectiveSets);

  return {
    muscleLoads: muscleMap,
    sortedMuscles,
    totalSets,
    totalReps,
    weightedAvgRpe,
    suggestedDuration,
    suggestedRpeMusc
  };
}

export type VolumeStatus = 'under' | 'mev' | 'mav' | 'mrv';

export interface WeeklyMuscleItem extends MuscleBreakdownItem {
  volumeStatus: VolumeStatus;
  statusLabel: string;
  statusBadgeColor: string;
}

export interface WeeklyMuscularSummary {
  weekId?: string;
  startDate?: string;
  endDate?: string;
  muscles: Record<string, WeeklyMuscleItem>;
  sortedMuscles: WeeklyMuscleItem[];
  totalSessionsWithExercises: number;
  totalSets: number;
  totalReps: number;
  totalEstimatedLoad: number;
  // Ratios d'équilibres fonctionnels
  hqRatio: number | null; // Ischios / Quadriceps
  pushPullRatio: number | null; // Pull / Push
  categorySets: {
    lower: number;
    upper_push: number;
    upper_pull: number;
    core: number;
  };
}

/**
 * Évalue le statut de volume selon les repères scientifiques (Israetel / Schoenfeld).
 */
export function getVolumeLandmark(effectiveSets: number): {
  status: VolumeStatus;
  label: string;
  badgeColor: string;
} {
  if (effectiveSets < 6) {
    return {
      status: 'under',
      label: 'Maintien / Sous-stimulé (< 6 séries)',
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700'
    };
  }
  if (effectiveSets <= 10) {
    return {
      status: 'mev',
      label: 'Volume Minimal Efficace (MEV : 6-10)',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    };
  }
  if (effectiveSets <= 20) {
    return {
      status: 'mav',
      label: 'Volume Adaptatif Optimal (MAV : 10-20)',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    };
  }
  return {
    status: 'mrv',
    label: 'Plafond Récupérable Dépassé (MRV : > 20)',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  };
}

/**
 * Agrège les données d'exercices de musculation de toutes les séances d'une semaine donnée.
 */
export function computeWeeklyMuscularSummary(
  events: Record<string, Record<string, any>> = {},
  startDateStr: string,
  endDateStr: string,
  customCatalog: ExerciseDefinition[] = []
): WeeklyMuscularSummary {
  const muscleMap: Record<string, WeeklyMuscleItem> = {};

  Object.values(MUSCLE_GROUPS).forEach(m => {
    muscleMap[m.id] = {
      muscleId: m.id,
      name: m.name,
      category: m.category,
      categoryLabel: m.categoryLabel,
      color: m.color,
      directSets: 0,
      effectiveSets: 0,
      repsTotal: 0,
      estimatedLoad: 0,
      exercises: [],
      volumeStatus: 'under',
      statusLabel: 'Maintien (< 6 séries)',
      statusBadgeColor: 'bg-slate-800 text-slate-300 border-slate-700'
    };
  });

  let totalSessionsWithExercises = 0;
  let totalSets = 0;
  let totalReps = 0;
  let totalEstimatedLoad = 0;

  // Parcourir toutes les qualités et séances dans l'intervalle [startDateStr, endDateStr]
  Object.values(events).forEach(qualityEvents => {
    if (!qualityEvents) return;

    Object.entries(qualityEvents).forEach(([dateStr, sessionData]) => {
      if (dateStr < startDateStr || dateStr > endDateStr) return;
      if (!sessionData || sessionData.isSecondary) return;

      const exercises: SessionExercise[] = sessionData.exercises;
      if (Array.isArray(exercises) && exercises.length > 0) {
        totalSessionsWithExercises += 1;
        const analysis = computeSessionMuscularBreakdown(exercises, customCatalog);

        totalSets += analysis.totalSets;
        totalReps += analysis.totalReps;

        Object.values(analysis.muscleLoads).forEach(item => {
          if (item.effectiveSets > 0) {
            const target = muscleMap[item.muscleId];
            if (target) {
              target.effectiveSets = Number((target.effectiveSets + item.effectiveSets).toFixed(1));
              target.directSets += item.directSets;
              target.repsTotal += item.repsTotal;
              target.estimatedLoad += item.estimatedLoad;
              totalEstimatedLoad += item.estimatedLoad;
              target.exercises.push(...item.exercises);
            }
          }
        });
      }
    });
  });

  // Calcul du statut de volume pour chaque muscle
  const categorySets = {
    lower: 0,
    upper_push: 0,
    upper_pull: 0,
    core: 0
  };

  Object.values(muscleMap).forEach(m => {
    const landmark = getVolumeLandmark(m.effectiveSets);
    m.volumeStatus = landmark.status;
    m.statusLabel = landmark.label;
    m.statusBadgeColor = landmark.badgeColor;

    if (m.category in categorySets) {
      categorySets[m.category] = Number((categorySets[m.category] + m.effectiveSets).toFixed(1));
    }
  });

  // Ratios d'équilibres
  const quadSets = muscleMap['quadriceps']?.effectiveSets || 0;
  const ischiosSets = muscleMap['ischios']?.effectiveSets || 0;
  const hqRatio = quadSets > 0 ? Number((ischiosSets / quadSets).toFixed(2)) : null;

  const pushSets = categorySets.upper_push;
  const pullSets = categorySets.upper_pull;
  const pushPullRatio = pushSets > 0 ? Number((pullSets / pushSets).toFixed(2)) : null;

  const sortedMuscles = Object.values(muscleMap)
    .filter(m => m.effectiveSets > 0)
    .sort((a, b) => b.effectiveSets - a.effectiveSets);

  return {
    muscles: muscleMap,
    sortedMuscles,
    totalSessionsWithExercises,
    totalSets,
    totalReps,
    totalEstimatedLoad,
    hqRatio,
    pushPullRatio,
    categorySets
  };
}

// --- GESTION PERSISTANTE DES EXERCICES PERSONNALISÉS (FEATURE 5) ---

export interface CustomExercise extends ExerciseDefinition {
  isCustom: true;
  createdAt?: string;
}

export function getSavedCustomExercises(): CustomExercise[] {
  try {
    const raw = localStorage.getItem('physio_custom_exercises');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomExercise(exercise: Omit<CustomExercise, 'isCustom'>): CustomExercise[] {
  try {
    const list = getSavedCustomExercises();
    const item: CustomExercise = {
      ...exercise,
      isCustom: true,
      createdAt: new Date().toISOString()
    };
    const updated = [item, ...list.filter(e => e.id !== exercise.id)];
    localStorage.setItem('physio_custom_exercises', JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function deleteCustomExercise(id: string): CustomExercise[] {
  try {
    const list = getSavedCustomExercises();
    const updated = list.filter(e => e.id !== id);
    localStorage.setItem('physio_custom_exercises', JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function getAllExerciseCatalog(customExercises: CustomExercise[] = []): ExerciseDefinition[] {
  return [...customExercises, ...EXERCISE_CATALOG];
}

// --- SYSTÈME D'ALERTES & DIAGNOSTICS DE DÉSÉQUILIBRE MUSCULAIRE (FEATURE 4) ---

export interface MuscularAlert {
  id: string;
  type: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  metric: string;
  message: string;
  recommendations: string[];
}

export function computeMuscularAlerts(summary: WeeklyMuscularSummary): MuscularAlert[] {
  const alerts: MuscularAlert[] = [];

  if (summary.totalSets === 0) return alerts;

  // 1. Ratio H:Q (Ischios / Quadriceps)
  if (summary.hqRatio !== null) {
    if (summary.hqRatio < 0.50) {
      alerts.push({
        id: 'hq_danger',
        type: 'danger',
        title: 'Déséquilibre Ischios/Quadriceps Critique (H:Q < 0.50)',
        metric: `Ratio H:Q = ${summary.hqRatio} (Norme ≥ 0.60)`,
        message: 'Le volume des ischios-jambiers est très inférieur aux quadriceps, augmentant fortement la contrainte sur le LCA et l\'articulation fémoro-patellaire.',
        recommendations: [
          'Ajouter 3 à 4 séries de Soulevé de terre roumain (RDL) ou Leg curl',
          'Intégrer du travail de chaîne postérieure (Hip-thrust, Good morning) en priorité'
        ]
      });
    } else if (summary.hqRatio < 0.60) {
      alerts.push({
        id: 'hq_warning',
        type: 'warning',
        title: 'Dominance Quadriceps Légère (H:Q < 0.60)',
        metric: `Ratio H:Q = ${summary.hqRatio} (Norme ≥ 0.60)`,
        message: 'La chaîne postérieure est en retrait par rapport à la chaîne antérieure cette semaine.',
        recommendations: [
          'Équilibrer la prochaine séance bas du corps avec du travail ciblé ischios'
        ]
      });
    } else {
      alerts.push({
        id: 'hq_ok',
        type: 'success',
        title: 'Ratio Ischios/Quadriceps Optimal',
        metric: `Ratio H:Q = ${summary.hqRatio} (Norme ≥ 0.60)`,
        message: 'Excellente balance entre extenseurs et fléchisseurs du genou.',
        recommendations: []
      });
    }
  }

  // 2. Ratio Tirage / Poussée (Pull / Push)
  if (summary.pushPullRatio !== null) {
    if (summary.pushPullRatio < 0.75) {
      alerts.push({
        id: 'pull_push_danger',
        type: 'danger',
        title: 'Dominance Poussée Excessive (Pull:Push < 0.75)',
        metric: `Ratio Pull:Push = ${summary.pushPullRatio} (Norme ≥ 1.00)`,
        message: 'Trop de poussée par rapport au tirage. Risque d\'antépulsion des épaules et de conflit sous-acromial.',
        recommendations: [
          'Rajouter 3 à 5 séries de Face pull, Tirage horizontal ou Tractions',
          'Veiller au renforcement des rotateurs externes et fixateurs d\'omoplate'
        ]
      });
    } else if (summary.pushPullRatio < 1.0) {
      alerts.push({
        id: 'pull_push_warning',
        type: 'warning',
        title: 'Léger Déficit de Tirage (Pull:Push < 1.00)',
        metric: `Ratio Pull:Push = ${summary.pushPullRatio} (Norme ≥ 1.00)`,
        message: 'Volume de tirage dorsal légèrement inférieur à la poussée.',
        recommendations: [
          'Privilégier un volume équivalent ou supérieur en tirage lors de la prochaine séance'
        ]
      });
    } else {
      alerts.push({
        id: 'pull_push_ok',
        type: 'success',
        title: 'Équilibre Poussée / Tirage Conforme',
        metric: `Ratio Pull:Push = ${summary.pushPullRatio} (Norme ≥ 1.00)`,
        message: 'Posture scapulaire et centrage huméral bien préservés.',
        recommendations: []
      });
    }
  }

  // 3. Détection des groupes en MRV (> 22 séries - fatigue locale aiguë)
  const overloaded = summary.sortedMuscles.filter(m => m.effectiveSets > 22);
  if (overloaded.length > 0) {
    alerts.push({
      id: 'mrv_overload',
      type: 'warning',
      title: 'Plafond Récupérable Dépassé (MRV)',
      metric: `${overloaded.map(m => `${m.name} (${m.effectiveSets}s)`).join(', ')}`,
      message: 'Volume supérieur à 22 séries effectives. Risque de fatigue résiduelle prolongée ou surentraînement local.',
      recommendations: [
        'Réduire le volume direct sur ce groupe la semaine prochaine (semaine de décharge ou de maintien)'
      ]
    });
  }

  // 4. Détection des groupes sous-stimulés si d'autres sont travaillés
  if (summary.totalSets >= 12) {
    const understimulated = Object.values(summary.muscles).filter(
      m => m.effectiveSets === 0 && (m.category === 'lower' || m.category === 'upper_push' || m.category === 'upper_pull')
    );
    if (understimulated.length >= 3) {
      alerts.push({
        id: 'understimulated',
        type: 'info',
        title: 'Groupes Musculaires Non Sollicités',
        metric: `${understimulated.slice(0, 4).map(m => m.name).join(', ')}`,
        message: 'Ces zones n\'ont reçu aucun stimulus direct ou indirect cette semaine.',
        recommendations: [
          'Penser à programmer un rappel léger (2 à 4 séries) pour maintenir les acquis'
        ]
      });
    }
  }

  return alerts;
}
