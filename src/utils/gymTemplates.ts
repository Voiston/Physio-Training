/**
 * Bibliothèque de modèles (templates) de séances de musculation hybride pour le Mode Salle.
 * Inclut des gabarits prêts à l'emploi + persistance locale des modèles personnalisés.
 */

export interface GymTemplateExercise {
  exerciseCatalogId: string;
  name: string;
  category: string;
  sets: number;
  reps: number;
  weightKg: number;
  rir: number;
  restSeconds: number;
}

export interface GymWorkoutTemplate {
  id: string;
  name: string;
  qualityId: string;
  description: string;
  estimatedMinutes: number;
  isPreset?: boolean;
  exercises: GymTemplateExercise[];
}

const GYM_TEMPLATES_STORAGE_KEY = 'physio_gym_templates_v1';

export const PRESET_GYM_TEMPLATES: GymWorkoutTemplate[] = [
  {
    id: 'preset_hybrid_leg_trail',
    name: 'Force Bas du Corps · Trail & Course',
    qualityId: 'leg',
    description: 'Force maximale quadriceps/chaîne postérieure + stabilité unilatérale.',
    estimatedMinutes: 45,
    isPreset: true,
    exercises: [
      { exerciseCatalogId: 'squat', name: 'Squat (barre)', category: 'lower', sets: 4, reps: 5, weightKg: 60, rir: 2, restSeconds: 180 },
      { exerciseCatalogId: 'rdl', name: 'Soulevé de terre roumain', category: 'lower', sets: 3, reps: 8, weightKg: 50, rir: 2, restSeconds: 120 },
      { exerciseCatalogId: 'bulgarian_split_squat', name: 'Fente bulgare', category: 'lower', sets: 3, reps: 8, weightKg: 20, rir: 2, restSeconds: 90 },
      { exerciseCatalogId: 'standing_calf_raise', name: 'Mollets debout', category: 'lower', sets: 3, reps: 12, weightKg: 30, rir: 2, restSeconds: 60 },
    ],
  },
  {
    id: 'preset_hybrid_upper_balanced',
    name: 'Upper Hybride · Push & Pull',
    qualityId: 'push',
    description: 'Haut du corps équilibré antagoniste sans surcharger les jambes.',
    estimatedMinutes: 40,
    isPreset: true,
    exercises: [
      { exerciseCatalogId: 'bench_press', name: 'Développé couché', category: 'upper_push', sets: 4, reps: 6, weightKg: 50, rir: 2, restSeconds: 120 },
      { exerciseCatalogId: 'pull_ups', name: 'Tractions', category: 'upper_pull', sets: 4, reps: 8, weightKg: 0, rir: 2, restSeconds: 120 },
      { exerciseCatalogId: 'overhead_press', name: 'Développé militaire', category: 'upper_push', sets: 3, reps: 8, weightKg: 30, rir: 2, restSeconds: 90 },
      { exerciseCatalogId: 'barbell_row', name: 'Rowing barre', category: 'upper_pull', sets: 3, reps: 10, weightKg: 45, rir: 2, restSeconds: 90 },
    ],
  },
  {
    id: 'preset_hybrid_core_express',
    name: 'Renfo Trail & Gainage Express',
    qualityId: 'abdos',
    description: 'Protocole 25 min anti-blessure : tronc, fessiers et posture de course.',
    estimatedMinutes: 25,
    isPreset: true,
    exercises: [
      { exerciseCatalogId: 'plank', name: 'Gainage planche', category: 'core', sets: 3, reps: 1, weightKg: 0, rir: 2, restSeconds: 60 },
      { exerciseCatalogId: 'hip_thrust', name: 'Hip thrust', category: 'lower', sets: 3, reps: 10, weightKg: 50, rir: 2, restSeconds: 90 },
      { exerciseCatalogId: 'face_pull', name: 'Face pull', category: 'upper_pull', sets: 3, reps: 15, weightKg: 15, rir: 2, restSeconds: 60 },
    ],
  },
];

export function getSavedGymTemplates(): GymWorkoutTemplate[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GYM_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is GymWorkoutTemplate =>
        Boolean(t) &&
        typeof t === 'object' &&
        typeof t.id === 'string' &&
        typeof t.name === 'string' &&
        typeof t.qualityId === 'string' &&
        Array.isArray(t.exercises) &&
        t.exercises.length > 0
    );
  } catch {
    return [];
  }
}

export function getAllGymTemplates(): GymWorkoutTemplate[] {
  return [...getSavedGymTemplates(), ...PRESET_GYM_TEMPLATES];
}

export function saveCustomGymTemplate(
  template: Omit<GymWorkoutTemplate, 'id' | 'isPreset'>
): GymWorkoutTemplate[] {
  const existing = getSavedGymTemplates();
  const nextItem: GymWorkoutTemplate = {
    ...template,
    id: `tpl_${Date.now()}`,
    name: template.name.trim().slice(0, 60) || 'Modèle personnalisé',
    description: template.description.trim().slice(0, 120),
    isPreset: false,
  };
  const updated = [nextItem, ...existing].slice(0, 20);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(GYM_TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage quota errors
    }
  }
  return updated;
}

export function deleteCustomGymTemplate(templateId: string): GymWorkoutTemplate[] {
  const updated = getSavedGymTemplates().filter((t) => t.id !== templateId);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(GYM_TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  }
  return updated;
}
