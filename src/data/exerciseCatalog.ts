/**
 * Catalogue des exercices de musculation et matrices d'activation musculaire.
 * Les clés de muscleRatios sont les ids de MUSCLE_GROUPS (utils/muscleHelpers).
 */
import type { ExerciseDefinition } from '../types';

export type { ExerciseDefinition } from '../types';

export const EXERCISE_CATALOG: ExerciseDefinition[] = [
  // Bas du corps
  { id: 'squat', name: 'Squat (barre)', category: 'lower', isCompound: true, defaultReps: 8, muscleRatios: { quadriceps: 1.0, glutes: 0.7, lombaires: 0.3, abdos: 0.2 } },
  { id: 'front_squat', name: 'Squat avant', category: 'lower', isCompound: true, defaultReps: 6, muscleRatios: { quadriceps: 1.0, glutes: 0.5, abdos: 0.3 } },
  { id: 'goblet_squat', name: 'Goblet squat', category: 'lower', isCompound: true, defaultReps: 10, muscleRatios: { quadriceps: 1.0, glutes: 0.6 } },
  { id: 'leg_press', name: 'Presse à cuisses', category: 'lower', isCompound: true, defaultReps: 10, muscleRatios: { quadriceps: 1.0, glutes: 0.6 } },
  { id: 'hack_squat', name: 'Hack squat', category: 'lower', isCompound: true, defaultReps: 10, muscleRatios: { quadriceps: 1.0, glutes: 0.5 } },
  { id: 'bulgarian_split_squat', name: 'Fente bulgare', category: 'lower', isCompound: true, defaultReps: 10, muscleRatios: { quadriceps: 1.0, glutes: 0.8 } },
  { id: 'lunges', name: 'Fentes marchées', category: 'lower', isCompound: true, defaultReps: 12, muscleRatios: { quadriceps: 0.9, glutes: 0.8 } },
  { id: 'step_up', name: 'Step-up', category: 'lower', isCompound: true, defaultReps: 12, muscleRatios: { quadriceps: 0.9, glutes: 0.8 } },
  { id: 'leg_extension', name: 'Leg extension', category: 'lower', isCompound: false, defaultReps: 12, muscleRatios: { quadriceps: 1.0 } },
  { id: 'rdl', name: 'Soulevé de terre roumain', category: 'lower', isCompound: true, defaultReps: 10, muscleRatios: { ischios: 1.0, glutes: 0.8, lombaires: 0.5 } },
  { id: 'deadlift', name: 'Soulevé de terre', category: 'lower', isCompound: true, defaultReps: 5, muscleRatios: { ischios: 0.8, glutes: 0.9, lombaires: 0.8, quadriceps: 0.5, trapezes: 0.4 } },
  { id: 'good_morning', name: 'Good morning', category: 'lower', isCompound: true, defaultReps: 10, muscleRatios: { ischios: 0.9, lombaires: 0.7, glutes: 0.6 } },
  { id: 'leg_curl', name: 'Leg curl', category: 'lower', isCompound: false, defaultReps: 10, muscleRatios: { ischios: 1.0 } },
  { id: 'nordic_curl', name: 'Nordic curl', category: 'lower', isCompound: false, defaultReps: 6, muscleRatios: { ischios: 1.0 } },
  { id: 'hip_thrust', name: 'Hip thrust', category: 'lower', isCompound: true, defaultReps: 10, muscleRatios: { glutes: 1.0, ischios: 0.4 } },
  { id: 'glute_bridge', name: 'Pont fessier', category: 'lower', isCompound: false, defaultReps: 15, muscleRatios: { glutes: 1.0, ischios: 0.3 } },
  { id: 'cable_kickback', name: 'Kickback à la poulie', category: 'lower', isCompound: false, defaultReps: 15, muscleRatios: { glutes: 1.0 } },
  { id: 'hip_abduction', name: 'Abduction de hanche', category: 'lower', isCompound: false, defaultReps: 15, muscleRatios: { glutes: 1.0 } },
  { id: 'standing_calf_raise', name: 'Mollets debout', category: 'lower', isCompound: false, defaultReps: 15, muscleRatios: { mollets: 1.0 } },
  { id: 'seated_calf_raise', name: 'Mollets assis', category: 'lower', isCompound: false, defaultReps: 15, muscleRatios: { mollets: 1.0 } },
  // Haut du corps (push)
  { id: 'bench_press', name: 'Développé couché', category: 'upper_push', isCompound: true, defaultReps: 8, muscleRatios: { pectoraux: 1.0, triceps: 0.65, deltoides_ant: 0.5 } },
  { id: 'incline_bench_press', name: 'Développé incliné', category: 'upper_push', isCompound: true, defaultReps: 8, muscleRatios: { pectoraux: 1.0, deltoides_ant: 0.6, triceps: 0.5 } },
  { id: 'dumbbell_bench_press', name: 'Développé couché haltères', category: 'upper_push', isCompound: true, defaultReps: 10, muscleRatios: { pectoraux: 1.0, triceps: 0.5, deltoides_ant: 0.5 } },
  { id: 'decline_bench_press', name: 'Développé décliné', category: 'upper_push', isCompound: true, defaultReps: 8, muscleRatios: { pectoraux: 1.0, triceps: 0.6 } },
  { id: 'push_ups', name: 'Pompes', category: 'upper_push', isCompound: true, defaultReps: 15, muscleRatios: { pectoraux: 1.0, triceps: 0.6, deltoides_ant: 0.4, abdos: 0.2 } },
  { id: 'dips', name: 'Dips aux barres parallèles', category: 'upper_push', isCompound: true, defaultReps: 10, muscleRatios: { pectoraux: 0.8, triceps: 1.0, deltoides_ant: 0.4 } },
  { id: 'chest_fly', name: 'Écarté couché haltères', category: 'upper_push', isCompound: false, defaultReps: 12, muscleRatios: { pectoraux: 1.0, deltoides_ant: 0.3 } },
  { id: 'cable_crossover', name: 'Écarté à la poulie', category: 'upper_push', isCompound: false, defaultReps: 12, muscleRatios: { pectoraux: 1.0 } },
  { id: 'pec_deck', name: 'Pec deck', category: 'upper_push', isCompound: false, defaultReps: 12, muscleRatios: { pectoraux: 1.0 } },
  { id: 'overhead_press', name: 'Développé militaire', category: 'upper_push', isCompound: true, defaultReps: 8, muscleRatios: { deltoides_ant: 1.0, triceps: 0.6, trapezes: 0.3 } },
  { id: 'dumbbell_shoulder_press', name: 'Développé épaules haltères', category: 'upper_push', isCompound: true, defaultReps: 10, muscleRatios: { deltoides_ant: 1.0, triceps: 0.5 } },
  { id: 'arnold_press', name: 'Arnold press', category: 'upper_push', isCompound: true, defaultReps: 10, muscleRatios: { deltoides_ant: 1.0, triceps: 0.4 } },
  { id: 'lateral_raises', name: 'Élévations latérales', category: 'upper_push', isCompound: false, defaultReps: 15, muscleRatios: { deltoides_ant: 1.0, trapezes: 0.3 } },
  { id: 'front_raises', name: 'Élévations frontales', category: 'upper_push', isCompound: false, defaultReps: 12, muscleRatios: { deltoides_ant: 1.0 } },
  { id: 'triceps_pushdown', name: 'Extension triceps à la poulie', category: 'upper_push', isCompound: false, defaultReps: 12, muscleRatios: { triceps: 1.0 } },
  { id: 'skull_crusher', name: 'Barre au front', category: 'upper_push', isCompound: false, defaultReps: 10, muscleRatios: { triceps: 1.0 } },
  { id: 'overhead_triceps_extension', name: 'Extension triceps au-dessus de la tête', category: 'upper_push', isCompound: false, defaultReps: 12, muscleRatios: { triceps: 1.0 } },
  { id: 'close_grip_bench_press', name: 'Développé couché prise serrée', category: 'upper_push', isCompound: true, defaultReps: 8, muscleRatios: { triceps: 1.0, pectoraux: 0.7, deltoides_ant: 0.4 } },
  // Haut du corps (pull)
  { id: 'pull_ups', name: 'Tractions', category: 'upper_pull', isCompound: true, defaultReps: 8, muscleRatios: { dorsaux: 1.0, biceps: 0.7, trapezes: 0.5 } },
  { id: 'chin_ups', name: 'Tractions supination', category: 'upper_pull', isCompound: true, defaultReps: 8, muscleRatios: { dorsaux: 1.0, biceps: 0.8 } },
  { id: 'lat_pulldown', name: 'Tirage vertical', category: 'upper_pull', isCompound: true, defaultReps: 10, muscleRatios: { dorsaux: 1.0, biceps: 0.6 } },
  { id: 'barbell_row', name: 'Rowing barre', category: 'upper_pull', isCompound: true, defaultReps: 8, muscleRatios: { dorsaux: 1.0, trapezes: 0.6, biceps: 0.5, deltoides_post: 0.4, lombaires: 0.3 } },
  { id: 'dumbbell_row', name: 'Rowing haltère un bras', category: 'upper_pull', isCompound: true, defaultReps: 10, muscleRatios: { dorsaux: 1.0, biceps: 0.5, trapezes: 0.4 } },
  { id: 'seated_cable_row', name: 'Tirage horizontal poulie', category: 'upper_pull', isCompound: true, defaultReps: 10, muscleRatios: { dorsaux: 1.0, trapezes: 0.6, biceps: 0.5, deltoides_post: 0.3 } },
  { id: 't_bar_row', name: 'Rowing T-bar', category: 'upper_pull', isCompound: true, defaultReps: 8, muscleRatios: { dorsaux: 1.0, trapezes: 0.6, biceps: 0.5 } },
  { id: 'straight_arm_pulldown', name: 'Pull-over à la poulie', category: 'upper_pull', isCompound: false, defaultReps: 12, muscleRatios: { dorsaux: 1.0 } },
  { id: 'face_pull', name: 'Face pull', category: 'upper_pull', isCompound: false, defaultReps: 15, muscleRatios: { deltoides_post: 0.9, trapezes: 0.6 } },
  { id: 'rear_delt_fly', name: 'Oiseau (deltoïdes postérieurs)', category: 'upper_pull', isCompound: false, defaultReps: 15, muscleRatios: { deltoides_post: 1.0, trapezes: 0.3 } },
  { id: 'shrugs', name: 'Shrugs', category: 'upper_pull', isCompound: false, defaultReps: 12, muscleRatios: { trapezes: 1.0 } },
  { id: 'biceps_curl', name: 'Curl biceps', category: 'upper_pull', isCompound: false, defaultReps: 10, muscleRatios: { biceps: 1.0 } },
  { id: 'hammer_curl', name: 'Curl marteau', category: 'upper_pull', isCompound: false, defaultReps: 10, muscleRatios: { biceps: 1.0 } },
  { id: 'preacher_curl', name: 'Curl pupitre', category: 'upper_pull', isCompound: false, defaultReps: 10, muscleRatios: { biceps: 1.0 } },
  { id: 'cable_curl', name: 'Curl à la poulie', category: 'upper_pull', isCompound: false, defaultReps: 12, muscleRatios: { biceps: 1.0 } },
  // Tronc
  { id: 'abdos_crunch', name: 'Crunch', category: 'core', isCompound: false, defaultReps: 15, muscleRatios: { abdos: 1.0 } },
  { id: 'plank', name: 'Gainage planche', category: 'core', isCompound: false, defaultReps: 1, muscleRatios: { abdos: 1.0, lombaires: 0.3 } },
  { id: 'side_plank', name: 'Gainage latéral', category: 'core', isCompound: false, defaultReps: 1, muscleRatios: { abdos: 1.0 } },
  { id: 'hanging_leg_raise', name: 'Relevé de jambes suspendu', category: 'core', isCompound: false, defaultReps: 12, muscleRatios: { abdos: 1.0 } },
  { id: 'cable_crunch', name: 'Crunch à la poulie', category: 'core', isCompound: false, defaultReps: 15, muscleRatios: { abdos: 1.0 } },
  { id: 'ab_wheel', name: 'Roue abdominale', category: 'core', isCompound: false, defaultReps: 10, muscleRatios: { abdos: 1.0, lombaires: 0.3 } },
  { id: 'russian_twist', name: 'Russian twist', category: 'core', isCompound: false, defaultReps: 20, muscleRatios: { abdos: 1.0 } },
  { id: 'back_extension', name: 'Extension lombaire', category: 'core', isCompound: false, defaultReps: 15, muscleRatios: { lombaires: 1.0, glutes: 0.5, ischios: 0.4 } },
  { id: 'bird_dog', name: 'Bird dog', category: 'core', isCompound: false, defaultReps: 12, muscleRatios: { lombaires: 0.8, abdos: 0.6 } }
];
