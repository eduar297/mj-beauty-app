// Formato de moneda único de toda la app.
// Los precios se manejan en dólares (USD) con centavos. Como referencia,
// mostramos también el equivalente en pesos cubanos (CUP) usando la tasa
// del día (informal / El Toque), configurable desde la Caja.
export const fmtMoney = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);

// Convierte un monto en USD a CUP usando la tasa (CUP por 1 USD).
// Devuelve '' si no hay tasa configurada — así el llamador simplemente
// no muestra la parte en pesos.
export const fmtCup = (usd, rate) => {
  const r = Number(rate) || 0;
  if (r <= 0) return '';
  const cup = Math.round((Number(usd) || 0) * r);
  return `${new Intl.NumberFormat('es-CU', { maximumFractionDigits: 0 }).format(cup)} CUP`;
};

// "$2.99 · 1,136 CUP" — o solo "$2.99" si no hay tasa.
export const fmtDual = (usd, rate) => {
  const cup = fmtCup(usd, rate);
  return cup ? `${fmtMoney(usd)} · ${cup}` : fmtMoney(usd);
};
