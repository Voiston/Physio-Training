/**
 * Apprentissage local des préférences de classification Garmin / Intervals.icu.
 * Mémorise les reclassifications de l'utilisateur (ex. "Home Trainer" -> Seuil)
 * pour pré-remplir automatiquement la boîte de réception 1 clic sans friction.
 */

export interface LearnedGarminRule {
  pattern: string;
  sport: 'run' | 'bike' | 'muscu';
  qualityId: string;
  rpeCardio: number;
  rpeMusc: number;
  hits: number;
  updatedAt: number;
}

const STORAGE_KEY = 'physio_garmin_learned_rules_v1';
const MAX_RULES = 40;

const STOP_WORDS = new Set([
  'course',
  'sortie',
  'seance',
  'entrainement',
  'matin',
  'midi',
  'soir',
  'avec',
  'pour',
  'dans',
  'velo',
  'running',
  'workout',
  'garmin',
  'activity',
]);

/**
 * Normalise un titre Garmin en motif réutilisable (insensible aux accents, chiffres isolés et ponctuation).
 */
export function extractGarminTitleSignature(title: string): string {
  const cleaned = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  const tokens = cleaned
    .split(' ')
    .filter((tok) => tok.length >= 3 && !STOP_WORDS.has(tok) && !/^\d+$/.test(tok))
    .slice(0, 3);

  return tokens.join(' ');
}

export function getLearnedGarminRules(): LearnedGarminRule[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is LearnedGarminRule =>
        Boolean(r) &&
        typeof r === 'object' &&
        typeof r.pattern === 'string' &&
        r.pattern.length >= 3 &&
        typeof r.qualityId === 'string'
    );
  } catch {
    return [];
  }
}

export function recordGarminClassificationPreference(params: {
  title: string;
  sport: 'run' | 'bike' | 'muscu';
  qualityId: string;
  rpeCardio: number;
  rpeMusc: number;
}): LearnedGarminRule[] {
  const pattern = extractGarminTitleSignature(params.title);
  if (!pattern || pattern.length < 3) return getLearnedGarminRules();

  const existing = getLearnedGarminRules();
  const idx = existing.findIndex(
    (r) => r.pattern === pattern && r.sport === params.sport
  );

  const now = Date.now();
  let updated: LearnedGarminRule[];
  if (idx >= 0) {
    const prev = existing[idx];
    const nextRule: LearnedGarminRule = {
      pattern,
      sport: params.sport,
      qualityId: params.qualityId,
      rpeCardio: Math.round((prev.rpeCardio + params.rpeCardio) / 2),
      rpeMusc: Math.round((prev.rpeMusc + params.rpeMusc) / 2),
      hits: prev.hits + 1,
      updatedAt: now,
    };
    updated = [nextRule, ...existing.filter((_, i) => i !== idx)];
  } else {
    updated = [
      {
        pattern,
        sport: params.sport,
        qualityId: params.qualityId,
        rpeCardio: params.rpeCardio,
        rpeMusc: params.rpeMusc,
        hits: 1,
        updatedAt: now,
      },
      ...existing,
    ];
  }

  updated = updated.slice(0, MAX_RULES);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore quota errors
    }
  }
  return updated;
}

export function matchLearnedGarminRule(
  title: string,
  sport: 'run' | 'bike' | 'muscu',
  rules: LearnedGarminRule[] = getLearnedGarminRules()
): LearnedGarminRule | null {
  if (!rules.length) return null;
  const sig = extractGarminTitleSignature(title);
  if (!sig) return null;

  const exact = rules.find((r) => r.sport === sport && r.pattern === sig);
  if (exact) return exact;

  const normalizedFull = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return (
    rules.find(
      (r) => r.sport === sport && r.pattern.length >= 4 && normalizedFull.includes(r.pattern)
    ) || null
  );
}
