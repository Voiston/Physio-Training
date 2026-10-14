/**
 * Fonctions pures de mise à l'échelle pour les mini-graphiques SVG.
 */

/**
 * Position horizontale du point `index` sur `count` points répartis de `start` à `start + span`.
 * Avec moins de deux points (ou une entrée non finie), renvoie `start`.
 */
export function indexToX(index: number, count: number, start: number, span: number): number {
  if (count < 2 || !Number.isFinite(index) || !Number.isFinite(count)) return start;
  return start + (index / (count - 1)) * span;
}

/**
 * Normalise `value` dans [min, max] vers [0, 1] (sans borner).
 * Une plage nulle est traitée comme une plage de 1. Un `value` NaN renvoie NaN.
 */
export function normalize(value: number, min: number, max: number): number {
  const range = max - min || 1;
  return (value - min) / range;
}

/**
 * Coordonnée verticale SVG (axe vers le bas) : `bottom` pour `min`, `bottom - span` pour `max`.
 */
export function valueToY(value: number, min: number, max: number, bottom: number, span: number): number {
  return bottom - normalize(value, min, max) * span;
}

/**
 * Index du point le plus proche d'une abscisse, borné à [0, count - 1].
 */
export function xToNearestIndex(x: number, count: number, start: number, span: number): number {
  if (count < 2 || span <= 0 || !Number.isFinite(x)) return 0;
  const clampedX = Math.max(start, Math.min(start + span, x));
  const ratio = (clampedX - start) / span;
  const closest = Math.round(ratio * (count - 1));
  return Math.max(0, Math.min(count - 1, closest));
}
