// Cliente del puente con Jev. La clave vive en el servidor (/api/jev); aquí
// solo viaja el tipo de consulta y los datos del salón.
export async function askJev(kind, data) {
  const res = await fetch('/api/jev', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, data }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Jev respondió ${res.status}.`);
  return json;
}

// Por debajo de esto Jev no se decidió: mejor mostrar las opciones que
// adivinar y dar un número que no es el que preguntó.
export const CONFIDENCE_MIN = 0.5;

export const pct = (n) => `${Math.round((Number(n) || 0) * 100)}%`;
