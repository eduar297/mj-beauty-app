// Prueba de humo del modelo Jev (TypeSafe). Es la llamada exacta que usará el
// módulo de Finanzas: clasificar un servicio por nivel de costo y decidir si
// conviene subirle el precio.
//
// Correr con:  node --env-file=.env.local index.ts

const KEY = process.env.TYPESAFE_API_KEY;
if (!KEY) {
  console.error('Falta TYPESAFE_API_KEY. Ponla en .env.local y vuelve a correr.');
  process.exit(1);
}

const res = await fetch('https://api.typesafe.ai/v1/systemone', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'jev-latest',
    // El state va estructurado: Jev lee mejor los datos como objeto que
    // metidos a la fuerza dentro de la pregunta.
    state: {
      negocio: 'Salón de belleza en Güines, Cuba. Precios en USD.',
      servicio: { nombre: 'Laminado de cejas', duracion_min: 120, precio_usd: 3, ventas_del_mes: 14 },
      otros_servicios: [
        { nombre: 'Perfilado de cejas', duracion_min: 30, precio_usd: 1 },
        { nombre: 'Diseño de cejas', duracion_min: 60, precio_usd: 2 },
      ],
      tasa_usd_cup: 785,
    },
    questions: {
      nivel_costo: {
        type: 'choice',
        instructions: 'Clasifica el `servicio` por cuánto material consume, comparándolo con `otros_servicios`.',
        criteria: {
          bajo:  'Poco material, servicio rápido y sencillo',
          medio: 'Material moderado',
          alto:  'Mucho material, o insumos caros y duraderos',
        },
      },
      subir_precio: {
        type: 'noul',
        instructions: '¿Le conviene al salón subirle el precio al `servicio`?',
        criteria: {
          true:  'El margen quedó corto para el material y el tiempo que lleva',
          false: 'El precio está bien como está',
        },
      },
    },
  }),
});

if (!res.ok) {
  console.error('HTTP', res.status, await res.text());
  process.exit(1);
}
console.log(JSON.stringify(await res.json(), null, 2));
