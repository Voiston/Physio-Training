export function getLocalYYYYMMDD(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function generateTimeline() {
  const today = new Date();
  const timeline = [];
  for (let i = -2; i <= 10; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    timeline.push({
      offset: i,
      dateStr: getLocalYYYYMMDD(d),
      dateObj: d
    });
  }
  return timeline;
}

export function formatDisplayDate(dateObj, offset) {
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const dayName = days[dateObj.getDay()];
  const d = String(dateObj.getDate()).padStart(2, '0');
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  
  let prefix = `J${offset > 0 ? '+' : ''}${offset}`;
  if (offset === 0) prefix = 'J+0';
  
  return { prefix, date: `${dayName} ${d}/${m}` };
}
