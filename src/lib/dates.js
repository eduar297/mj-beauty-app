// Fechas en la zona horaria REAL del salón (la del dispositivo), no en UTC.
//
// Ojo con new Date().toISOString().slice(0,10): eso da la fecha en UTC.
// En Cuba (UTC-4) a partir de las 8 PM ya es "mañana" en UTC, así que un pago
// de la noche caía en el día siguiente y desaparecía de la caja del día.

const pad = (n) => String(n).padStart(2, '0');

// "YYYY-MM-DD" de una fecha, en hora local.
export const toISODate = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Hoy, en hora local.
export const todayISO = () => toISODate(new Date());

// "HH:MM:SS" de ahora, en hora local.
export const nowTime = (d = new Date()) =>
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// Suma días a una fecha "YYYY-MM-DD" y devuelve otra "YYYY-MM-DD".
// Se construye con T00:00:00 (sin Z) para que sea medianoche local.
export const addDaysISO = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

// "miércoles, 22 de julio de 2026" — para encabezados.
export const longDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('es-CU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

// "mié 22 jul" — versión corta para chips y botones.
export const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('es-CU', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
