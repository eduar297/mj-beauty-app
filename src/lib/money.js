// Formato de moneda único de toda la app.
// Los precios ahora se manejan en dólares (USD) con centavos —
// antes era COP sin decimales. Cambiar la moneda aquí la cambia en todos lados.
export const fmtMoney = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);
