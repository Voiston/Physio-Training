/**
 * SOURCE UNIQUE DE VÉRITÉ POUR LES QUALITÉS ET CATÉGORIES PHYSIOLOGIQUES
 */

export const CARDIO_QUALITY_IDS = ['vo2max', 'seuil', 'ef', 'co2', 'gut'] as const;
export type CardioQualityId = typeof CARDIO_QUALITY_IDS[number];

export const FORCE_QUALITY_IDS = [
  'pull', 
  'push', 
  'leg', 
  'plyo', 
  'descente', 
  'abdos', 
  'proprio', 
  'isolation'
] as const;
export type ForceQualityId = typeof FORCE_QUALITY_IDS[number];

export const MIXED_QUALITY_IDS = ['sprint'] as const;
export type MixedQualityId = typeof MIXED_QUALITY_IDS[number];

export type QualityCategory = 'cardio' | 'force' | 'mixte' | 'souplesse';

export interface QualityLike {
  id: string;
  category?: QualityCategory | string;
  [key: string]: unknown;
}

/**
 * Détermine si une qualité donnée relève du domaine cardiovasculaire / métabolique.
 * Préfère la propriété 'category' de l'objet qualité si disponible, sinon se réfère à la liste de référence.
 */
export function isCardioQuality(qualityId: string, qualities?: QualityLike[]): boolean {
  if (qualities) {
    const q = qualities.find(item => item.id === qualityId);
    if (q && q.category) {
      return q.category === 'cardio';
    }
  }
  return (CARDIO_QUALITY_IDS as readonly string[]).includes(qualityId);
}

/**
 * Détermine si une qualité donnée relève du domaine de la force / renforcement musculaire (y compris isolation).
 */
export function isForceQuality(qualityId: string, qualities?: QualityLike[]): boolean {
  if (qualities) {
    const q = qualities.find(item => item.id === qualityId);
    if (q && q.category) {
      return q.category === 'force';
    }
  }
  return (FORCE_QUALITY_IDS as readonly string[]).includes(qualityId);
}

/**
 * Retourne la catégorie physiologique d'une qualité ('cardio' | 'force' | 'mixte').
 */
export function getQualityCategory(qualityId: string, qualities?: QualityLike[]): QualityCategory {
  if (qualities) {
    const q = qualities.find(item => item.id === qualityId);
    if (q && q.category) {
      return q.category as QualityCategory;
    }
  }
  if ((CARDIO_QUALITY_IDS as readonly string[]).includes(qualityId)) return 'cardio';
  if ((FORCE_QUALITY_IDS as readonly string[]).includes(qualityId)) return 'force';
  return 'mixte';
}
