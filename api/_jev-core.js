// Núcleo del puente con TypeSafe (modelo Jev).
//
// Vive en el servidor a propósito: la clave no puede ir en el frontend, porque
// cualquier VITE_* termina publicada en el bundle y se puede gastar desde
// fuera. Lo usan dos entradas: api/jev.js en Vercel y un middleware de Vite
// en desarrollo (vite.config.js), para que las dos se comporten igual.
//
// El cliente NO manda preguntas libres: manda un `kind` y los datos, y las
// preguntas se arman aquí. Así el endpoint tampoco sirve como IA gratis
// contra la cuenta del salón.

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const MAX_SERVICES = 60;   // el límite de Jev es 255 opciones por Choice

const TIER_CRITERIA = {
  bajo:  'Poco material, servicio rápido y sencillo',
  medio: 'Material moderado',
  alto:  'Mucho material, o insumos caros y duraderos',
};

// Las preguntas que el panel sabe responder con números exactos.
// "fondo" y "porcentaje" se describen marcando cantidad vs proporción: sin
// eso, Jev confundía "cuánto guardé pa materiales" con el porcentaje.
const INTENTS = {
  pago_trabajadora: 'Cuánto hay que pagarle a una trabajadora, o a todas',
  ganancia_duena:   'La ganancia neta que le queda a la dueña',
  fondo_materiales: 'Cuánto dinero hay guardado para materiales: una cantidad',
  pct_materiales:   'Qué proporción o porcentaje del ingreso se va en materiales',
  mas_rentable:     'Qué servicio deja más ganancia',
  menos_rentable:   'Qué servicio deja menos ganancia',
  subir_precio:     'Qué servicio debería subir de precio',
  ventas_total:     'Cuánto se vendió en total',
};

// `no_dice` existe a propósito: sin esa opción, toda pregunta sin fecha caía
// en "este mes" y el panel saltaba al mes actual, sacando a la dueña del mes
// que estaba mirando.
const PERIODS = {
  no_dice: 'No menciona ningún período ni fecha',
  hoy: 'Hoy, el día de hoy',
  este_mes: 'Dice explícitamente este mes o el mes actual',
  mes_pasado: 'El mes pasado o el mes anterior',
  este_anno: 'Todo el año',
};

const str = (v, max = 120) => String(v ?? '').slice(0, max);
const n2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Clave única por servicio: Jev devuelve la opción elegida como texto, así que
// dos servicios con el mismo nombre se pisarían en el mapa de criterios.
const uniqueKey = (name, taken) => {
  let k = str(name) || 'Servicio';
  let i = 2;
  while (taken.has(k)) k = `${str(name)} (${i++})`;
  taken.add(k);
  return k;
};

export function buildRequest(kind, data = {}) {
  if (kind === 'intent') {
    const staff = { todas: 'No nombra a ninguna en particular' };
    for (const name of (data.staff || []).slice(0, 30)) staff[str(name, 60)] = null;
    return {
      state: str(data.text, 500),
      questions: {
        intent: {
          type: 'choice',
          instructions: 'La dueña de un salón de belleza pregunta algo sobre las finanzas de su negocio. ¿Qué quiere saber?',
          criteria: INTENTS,
        },
        trabajadora: {
          type: 'choice',
          instructions: '¿De qué trabajadora habla? Responde `todas` si no nombra a ninguna.',
          criteria: staff,
        },
        periodo: {
          type: 'choice',
          instructions: '¿De qué período habla? Responde `este_mes` si no lo dice.',
          criteria: PERIODS,
        },
      },
    };
  }

  if (kind === 'classify') {
    const s = data.service || {};
    return {
      state: {
        negocio: 'Salón de belleza en Cuba. Precios en USD.',
        servicio: { nombre: str(s.name), duracion_min: Number(s.duration) || 0, precio_usd: n2(s.price) },
        otros_servicios: (data.others || []).slice(0, 25).map(o => ({
          nombre: str(o.name), duracion_min: Number(o.duration) || 0,
          precio_usd: n2(o.price), nivel: o.cost_tier || null,
        })),
      },
      questions: {
        nivel_costo: {
          type: 'choice',
          instructions: 'Clasifica el `servicio` por cuánto material consume, comparándolo con `otros_servicios`.',
          criteria: TIER_CRITERIA,
        },
      },
    };
  }

  if (kind === 'pricing') {
    const taken = new Set();
    const criteria = {};
    for (const s of (data.services || []).slice(0, MAX_SERVICES)) {
      criteria[uniqueKey(s.name, taken)] =
        `${n2(s.price)} USD · ${Number(s.duration) || 0} min · nivel ${s.cost_tier || 'medio'}` +
        ` · deja ${n2(s.duena)} USD a la dueña (${n2(s.perHour)} USD/h) · ${Number(s.count) || 0} ventas`;
    }
    if (!Object.keys(criteria).length) throw new Error('Sin servicios que analizar');
    return {
      state: {
        negocio: 'Salón de belleza en Cuba. Precios en USD, gastos en pesos cubanos.',
        tasa_usd_cup: Number(data.rate) || 0,
        periodo: str(data.period, 40),
        ventas_del_periodo_usd: n2(data.total),
      },
      questions: {
        subir_precio: {
          type: 'choice',
          instructions: 'De estos servicios, ¿a cuál le conviene más al salón subirle el precio? Mira el margen que deja, lo que rinde por hora y cuánto se vende.',
          criteria,
        },
        urgencia: {
          type: 'score',
          instructions: 'Qué tan urgente es ajustar los precios de este salón, visto el conjunto.',
          criteria: ['Los precios están bien', 'Conviene revisarlos pronto', 'Urge subirlos'],
        },
      },
    };
  }

  throw new Error(`Tipo de consulta desconocido: ${kind}`);
}

// Devuelve { status, body } listo para responder.
export async function askJev({ kind, data, key }) {
  if (!key) return { status: 500, body: { error: 'Falta TYPESAFE_API_KEY en el servidor.' } };

  let payload;
  try {
    payload = { model: MODEL, ...buildRequest(kind, data) };
  } catch (e) {
    return { status: 400, body: { error: e.message } };
  }

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return { status: 502, body: { error: 'No se pudo contactar a Jev. Revisa la conexión.' } };
  }

  const text = await res.text();
  if (!res.ok) {
    // El cuerpo de error de TypeSafe puede traer detalles de la cuenta; no se
    // reenvía tal cual al navegador, solo un mensaje según el código.
    const msg = res.status === 401 ? 'La clave de Jev no es válida.'
      : res.status === 422 ? 'Jev rechazó la consulta.'
      : res.status === 429 ? 'Demasiadas consultas seguidas. Espera unos segundos.'
      : res.status === 529 ? 'Jev está saturado ahora mismo. Reintenta en un momento.'
      : `Jev respondió ${res.status}.`;
    return { status: res.status, body: { error: msg } };
  }

  try {
    return { status: 200, body: JSON.parse(text) };
  } catch {
    return { status: 502, body: { error: 'Respuesta de Jev ilegible.' } };
  }
}
