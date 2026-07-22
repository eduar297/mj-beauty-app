// Formatea minutos a un texto legible en horas y minutos.
// 45  → "45 min"
// 120 → "2 h"
// 130 → "2 h 10 min"
export function fmtDuration(mins) {
  const m = Math.max(0, Math.round(Number(mins) || 0));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}
