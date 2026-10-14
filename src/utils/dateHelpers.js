/**
 * Helpers calendaires et temporels pour une gestion rigoureuse des dates locales et des fuseaux horaires.
 */

/**
 * Retourne la représentation textuelle 'YYYY-MM-DD' en heure locale stricte.
 * @param {Date | string | number} dateObj
 * @returns {string}
 */
export function getLocalYYYYMMDD(dateObj) {
  const date = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Instancie un objet Date calendaire ancré à midi (12:00:00).
 * Élimine tout biais de fuseau horaire (UTC vs local) et immunise contre les passages
 * à l'heure d'été ou d'hiver (DST).
 * @param {string | Date | number | null} [dateInput]
 * @returns {Date}
 */
export function parseLocalDate(dateInput = new Date()) {
  if (dateInput instanceof Date) {
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate(), 12, 0, 0);
  }
  if (typeof dateInput === 'string') {
    const parts = dateInput.split('-');
    if (parts.length === 3) {
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m, d, 12, 0, 0);
      }
    }
  }
  const parsed = new Date(dateInput || Date.now());
  return isNaN(parsed.getTime()) 
    ? new Date(new Date().setHours(12, 0, 0, 0)) 
    : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0);
}

/**
 * Ajoute ou soustrait un nombre de jours calendaires à une date de façon sûre (DST safe).
 * Utilise l'arithmétique calendaire native au lieu d'une addition brute de millisecondes (+ i * 86400000).
 * @param {string | Date} date
 * @param {number} days
 * @returns {Date}
 */
export function addDays(date, days) {
  const base = parseLocalDate(date);
  base.setDate(base.getDate() + days);
  return base;
}

/**
 * @param {number} [pastDays]
 * @param {number} [futureDays]
 * @param {Date | string} [referenceDate]
 */
export function generateTimeline(pastDays = 14, futureDays = 14, referenceDate = new Date()) {
  const today = parseLocalDate(referenceDate);
  const timeline = [];
  for (let i = -pastDays; i <= futureDays; i++) {
    const d = addDays(today, i);
    timeline.push({
      offset: i,
      dateStr: getLocalYYYYMMDD(d),
      dateObj: d
    });
  }
  return timeline;
}

/**
 * @param {Date} dateObj
 * @param {number} offset
 */
export function formatDisplayDate(dateObj, offset) {
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const dayName = days[dateObj.getDay()];
  const d = String(dateObj.getDate()).padStart(2, '0');
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  
  let prefix = `J${offset > 0 ? '+' : ''}${offset}`;
  if (offset === 0) prefix = 'J+0';
  
  return { prefix, date: `${dayName} ${d}/${m}` };
}
