// Cálculo puro de horas disponibles para reservar.
// Sin side-effects ni queries — recibe los datos ya cargados y devuelve slots.

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const toMin = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const fromMin = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Convierte un timestamp ISO a minutos desde medianoche de la fecha local target.
// Devuelve null si el timestamp cae fuera de ese día.
const tsToMinOfDay = (iso, dateYmd) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (local !== dateYmd) return null;
  return d.getHours() * 60 + d.getMinutes();
};

// Para un bloqueo que puede extenderse antes/después del día target,
// devuelve [start, end] recortado al día (en minutos desde medianoche).
const clampToDay = (startIso, endIso, dateYmd) => {
  const startD = new Date(startIso);
  const endD = new Date(endIso);
  if (isNaN(startD) || isNaN(endD)) return null;
  const dayStart = new Date(`${dateYmd}T00:00:00`);
  const dayEnd   = new Date(`${dateYmd}T23:59:59`);
  if (endD < dayStart || startD > dayEnd) return null;
  const s = Math.max(dayStart.getTime(), startD.getTime());
  const e = Math.min(dayEnd.getTime(),   endD.getTime());
  const sMin = new Date(s).getHours() * 60 + new Date(s).getMinutes();
  const eMin = new Date(e).getHours() * 60 + new Date(e).getMinutes();
  return [sMin, eMin === 0 ? 24 * 60 : eMin];
};

/**
 * @param {Object} args
 * @param {{ duration: number }} args.service
 * @param {string} args.date — "YYYY-MM-DD"
 * @param {Array<{ id, weekly_hours }>} args.eligibleStaff — empleadas que hacen este servicio
 * @param {Array<{ staff_id, start_at, end_at }>} args.timeOffs
 * @param {Array<{ staff_id, date, time, duration, status }>} args.appointments — citas activas
 * @param {string|null} [args.preferredStaffId]
 * @param {number} [args.stepMinutes=15]
 * @returns {{ slots: string[], staffBySlot: Record<string, string[]> }}
 */
export function computeAvailableSlots({
  service,
  date,
  eligibleStaff,
  timeOffs = [],
  appointments = [],
  preferredStaffId = null,
  stepMinutes = 15,
}) {
  const duration = service?.duration || 60;
  if (!date || !eligibleStaff?.length) return { slots: [], staffBySlot: {} };

  const dayOfWeek = DAY_KEYS[new Date(`${date}T00:00:00`).getDay()];

  // Filtrar empleadas elegibles si hay preferencia
  const pool = preferredStaffId
    ? eligibleStaff.filter(s => s.id === preferredStaffId)
    : eligibleStaff;

  // Pre-indexar bloqueos y citas por staff_id
  const offByStaff = new Map();
  for (const o of timeOffs) {
    const clamped = clampToDay(o.start_at, o.end_at, date);
    if (!clamped) continue;
    if (!offByStaff.has(o.staff_id)) offByStaff.set(o.staff_id, []);
    offByStaff.get(o.staff_id).push(clamped);
  }

  const apptByStaff = new Map();
  for (const a of appointments) {
    if (a.status === 'cancelled') continue;
    if (a.date !== date) continue;
    if (!a.staff_id) continue;
    const s = toMin(a.time);
    if (s == null) continue;
    if (!apptByStaff.has(a.staff_id)) apptByStaff.set(a.staff_id, []);
    apptByStaff.get(a.staff_id).push([s, s + (Number(a.duration) || 60)]);
  }

  const overlaps = (slotStart, slotEnd, ranges) => {
    if (!ranges) return false;
    for (const [s, e] of ranges) {
      if (slotEnd > s && slotStart < e) return true;
    }
    return false;
  };

  const staffBySlot = new Map(); // slotStr -> Set(staffId)

  for (const st of pool) {
    // Fallback: si la empleada no ha configurado su weekly_hours aún
    // (instalación nueva / fila vieja), usamos un horario por defecto
    // sensato (Lun-Sáb 9-18, Dom libre). El admin puede sobreescribirlo
    // desde su perfil sin que el booking público quede roto el día 1.
    const hours = (st.weekly_hours && Object.keys(st.weekly_hours).length > 0)
      ? st.weekly_hours
      : DEFAULT_WEEKLY_HOURS;
    // Normaliza el valor del día a array de rangos para soportar pausas
    // (e.g. trabaja 9-13 y 14-18). Formato viejo: { start, end } → [{start,end}].
    const ranges = normalizeDayRanges(hours[dayOfWeek]);
    if (!ranges.length) continue;

    const offs = offByStaff.get(st.id);
    const appts = apptByStaff.get(st.id);

    for (const r of ranges) {
      const winStart = toMin(r.start);
      const winEnd = toMin(r.end);
      if (winStart == null || winEnd == null || winEnd - winStart < duration) continue;

      for (let t = winStart; t + duration <= winEnd; t += stepMinutes) {
        const slotEnd = t + duration;
        if (overlaps(t, slotEnd, offs)) continue;
        if (overlaps(t, slotEnd, appts)) continue;
        const key = fromMin(t);
        if (!staffBySlot.has(key)) staffBySlot.set(key, new Set());
        staffBySlot.get(key).add(st.id);
      }
    }
  }

  const slots = Array.from(staffBySlot.keys()).sort();
  const out = {};
  for (const [k, v] of staffBySlot) out[k] = Array.from(v);

  return { slots, staffBySlot: out };
}

// Normaliza el valor de un día a array de rangos {start, end}.
// - null/undefined → [] (libre)
// - { start, end } (formato viejo) → [{start, end}]
// - [{start, end}, ...] (formato nuevo) → mismo array, filtrando vacíos
export function normalizeDayRanges(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter(r => r && r.start && r.end);
  }
  if (value.start && value.end) return [{ start: value.start, end: value.end }];
  return [];
}

// Default razonable para una empleada nueva: Lun–Sáb 9–18, Dom libre.
export const DEFAULT_WEEKLY_HOURS = {
  mon: [{ start: '09:00', end: '18:00' }],
  tue: [{ start: '09:00', end: '18:00' }],
  wed: [{ start: '09:00', end: '18:00' }],
  thu: [{ start: '09:00', end: '18:00' }],
  fri: [{ start: '09:00', end: '18:00' }],
  sat: [{ start: '09:00', end: '18:00' }],
  sun: null,
};

export const DAY_KEYS_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_LABELS_ES = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes', sat: 'Sábado', sun: 'Domingo' };
