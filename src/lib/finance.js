// Reparto del dinero de cada cobro: materiales / trabajadora / dueña.
//
// Cada servicio pertenece a un "nivel de costo" (bajo, medio, alto) y ese
// nivel decide los tres porcentajes. Los porcentajes se editan en
// Personalización y viven en site_settings.cost_tiers.

export const TIERS = [
  { id: 'bajo',  label: 'Bajo costo',  short: 'Bajo',  color: '#7fb77e' },
  { id: 'medio', label: 'Costo medio', short: 'Medio', color: '#d8b87a' },
  { id: 'alto',  label: 'Costo alto',  short: 'Alto',  color: '#d4857a' },
];

export const TIER_IDS = TIERS.map(t => t.id);
export const DEFAULT_TIER = 'medio';

// Nunca devuelve undefined: un servicio sin clasificar se trata como medio
// (y la pantalla de Finanzas lo reporta aparte para que no pase inadvertido).
export const tierInfo = (id) => TIERS.find(t => t.id === id) || TIERS[1];

// Los porcentajes con los que arranca el salón.
export const DEFAULT_TIERS = {
  bajo:  { materiales: 20, trabajadora: 40, duena: 40 },
  medio: { materiales: 25, trabajadora: 35, duena: 40 },
  alto:  { materiales: 30, trabajadora: 35, duena: 35 },
};

export const SHARES = [
  { key: 'materiales',  label: 'Materiales',  hint: 'Reposición e inversión' },
  { key: 'trabajadora', label: 'Trabajadora', hint: 'Lo que se le paga' },
  { key: 'duena',       label: 'Dueña',       hint: 'Ganancia del salón' },
];

const num = (v, fallback) => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// Rellena huecos y descarta basura. Sin esto, una columna NULL o un nivel a
// medias haría que el reparto devolviera NaN por toda la pantalla.
export function normalizeTiers(raw) {
  const out = {};
  for (const id of TIER_IDS) {
    const def = DEFAULT_TIERS[id];
    const got = raw?.[id] || {};
    out[id] = {
      materiales:  num(got.materiales,  def.materiales),
      trabajadora: num(got.trabajadora, def.trabajadora),
      duena:       num(got.duena,       def.duena),
    };
  }
  return out;
}

export const tierSum = (t) => SHARES.reduce((a, s) => a + (Number(t?.[s.key]) || 0), 0);

// Repartir 105% del dinero no lanza ningún error: simplemente todas las
// cifras mienten un 5%. Por eso el guardado se bloquea si un nivel no da 100.
export const tiersValid = (tiers) => TIER_IDS.every(id => tierSum(tiers?.[id]) === 100);

// ── Motor de reparto ──────────────────────────────────────────────────

const norm = (s) => String(s || '').trim().toLowerCase();

// Índice de servicios para resolver un cobro sin recorrer la lista entera.
export function indexServices(services = []) {
  const byId = new Map();
  const byName = new Map();
  for (const s of services) {
    byId.set(s.id, s);
    byName.set(norm(s.name), s);
  }
  return { byId, byName };
}

const applyShare = (amount, share) => ({
  materiales:  amount * (Number(share?.materiales)  || 0) / 100,
  trabajadora: amount * (Number(share?.trabajadora) || 0) / 100,
  duena:       amount * (Number(share?.duena)       || 0) / 100,
});

// Qué servicios lleva un cobro. Prioriza service_ids; si el cobro es viejo y
// solo guardó el nombre en texto, lo busca por nombre (el trigger de la BD
// une varios servicios con " + ").
function servicesOf(tx, index) {
  const ids = Array.isArray(tx.service_ids) ? tx.service_ids.filter(Boolean) : [];
  const fromIds = ids.map(id => index.byId.get(id)).filter(Boolean);
  if (fromIds.length) return fromIds;
  return String(tx.service_name || '')
    .split('+').map(norm).filter(Boolean)
    .map(n => index.byName.get(n)).filter(Boolean);
}

// Reparte UN cobro entre sus servicios y aplica a cada pedazo los porcentajes
// de SU nivel de costo.
//
// Por qué proporcional al precio de lista: un mismo ticket puede mezclar un
// servicio de costo bajo con uno alto, y a veces se cobra menos que la suma
// (descuento). Repartiendo el monto real según el peso de cada servicio, los
// porcentajes siguen cuadrando y cada parte lleva su propio nivel.
export function splitTransaction(tx, index, tiers) {
  const amount = Number(tx.amount) || 0;
  const svcs = servicesOf(tx, index);

  // No se pudo saber qué servicio fue (cobro viejo, servicio borrado, o un
  // cobro suelto). Se reparte con el nivel por defecto pero queda marcado: el
  // panel lo reporta aparte, en vez de dar una cifra que parece exacta.
  if (!svcs.length) {
    const share = applyShare(amount, tiers[DEFAULT_TIER]);
    return {
      amount, ...share, unclassified: amount,
      lines: [{ name: tx.service_name || 'Sin clasificar', tier: null, assumed: true, amount, duration: 0, ...share }],
    };
  }

  const weights = svcs.map(s => Number(s.price) || 0);
  const totalW = weights.reduce((a, b) => a + b, 0);
  // Sin precios de lista no hay proporción posible: se parte en partes iguales.
  const parts = totalW > 0 ? weights.map(w => w / totalW) : svcs.map(() => 1 / svcs.length);

  const lines = svcs.map((s, i) => {
    const part = amount * parts[i];
    const assumed = !s.cost_tier;         // existe, pero todavía sin clasificar
    const tier = s.cost_tier || DEFAULT_TIER;
    return {
      id: s.id, name: s.name, tier, assumed,
      amount: part, duration: Number(s.duration) || 0,
      ...applyShare(part, tiers[tier] || tiers[DEFAULT_TIER]),
    };
  });

  const sum = (k) => lines.reduce((a, l) => a + l[k], 0);
  return {
    amount,
    materiales: sum('materiales'),
    trabajadora: sum('trabajadora'),
    duena: sum('duena'),
    unclassified: lines.filter(l => l.assumed).reduce((a, l) => a + l.amount, 0),
    lines,
  };
}

// Totales de un conjunto de cobros, con el detalle por trabajadora y por
// servicio que necesita el panel mensual.
// fallbackRate solo se usa en los cobros viejos que no guardaron su tasa.
export function summarize(txs = [], services = [], tiers = DEFAULT_TIERS, fallbackRate = 0) {
  const index = indexServices(services);
  const t = normalizeTiers(tiers);
  const out = {
    count: txs.length,
    total: 0, materiales: 0, trabajadora: 0, duena: 0,
    unclassified: 0,
    // Equivalente en pesos: cada cobro con SU tasa del día, no con la de hoy.
    cup: { total: 0, materiales: 0, trabajadora: 0, duena: 0 },
    byStaff: new Map(),   // nombre → { total, trabajadora, count, byService }
    byService: new Map(), // clave  → { name, tier, total, duena, count, minutes }
    splits: new Map(),    // tx.id  → reparto, para el detalle de cada fila
  };

  for (const tx of txs) {
    const s = splitTransaction(tx, index, t);
    out.splits.set(tx.id, s);
    out.total += s.amount;
    out.materiales += s.materiales;
    out.trabajadora += s.trabajadora;
    out.duena += s.duena;
    out.unclassified += s.unclassified;

    const r = Number(tx.fx_rate) || Number(fallbackRate) || 0;
    if (r > 0) {
      out.cup.total += s.amount * r;
      out.cup.materiales += s.materiales * r;
      out.cup.trabajadora += s.trabajadora * r;
      out.cup.duena += s.duena * r;
    }

    const who = tx.staff_name || 'Sin asignar';
    const st = out.byStaff.get(who) || { name: who, total: 0, trabajadora: 0, count: 0, byService: new Map() };
    st.total += s.amount; st.trabajadora += s.trabajadora; st.count += 1;
    // Desglose por servicio: es lo que explica de dónde sale el pago.
    for (const l of s.lines) {
      const d = st.byService.get(l.name) ||
        { name: l.name, tier: l.tier, count: 0, amount: 0, trabajadora: 0 };
      d.count += 1; d.amount += l.amount; d.trabajadora += l.trabajadora;
      st.byService.set(l.name, d);
    }
    out.byStaff.set(who, st);

    for (const l of s.lines) {
      const key = l.id || `name:${norm(l.name)}`;
      const c = out.byService.get(key) ||
        { key, id: l.id || null, name: l.name, tier: l.tier, total: 0, duena: 0, materiales: 0, count: 0, minutes: 0 };
      c.total += l.amount; c.duena += l.duena; c.materiales += l.materiales;
      c.count += 1; c.minutes += l.duration;
      out.byService.set(key, c);
    }
  }
  return out;
}

// Rentabilidad real: lo que deja por hora de silla ocupada. Un servicio de
// 30 min que deja 0.40 rinde más que uno de 2 h que deja 1.05.
export const perHour = (duena, minutes) => (minutes > 0 ? (duena / minutes) * 60 : 0);
