// Temporadas: la decoración de la web y del panel se activa y se apaga sola por
// fecha. Para añadir una nueva temporada basta con meter una entrada aquí.
//
//   start/end: 'MM-DD'. Si end < start la temporada cruza el año (ej. Navidad).
//   badge:     emoji que acompaña el saludo.
//   greeting:  texto del pill festivo en la landing.
//   decor:     'snow' (nevada) | null. Las luces y el gorrito salen siempre.
export const SEASONS = [
  {
    id: 'navidad',
    name: 'Navidad',
    start: '12-01',
    end: '01-06',           // hasta Reyes
    badge: '🎄',
    greeting: 'Felices Fiestas',
    decor: 'snow',
  },
  // Próximas (descomentar cuando se preparen sus estilos en globals.css):
  // { id: 'san-valentin', name: 'San Valentín', start: '02-07', end: '02-15', badge: '💖', greeting: 'Feliz San Valentín', decor: 'hearts' },
];

export function getSeason(date = new Date()) {
  const md = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return SEASONS.find(s =>
    s.start <= s.end ? md >= s.start && md <= s.end : md >= s.start || md <= s.end
  ) || null;
}

/** Resuelve la temporada visible combinando el modo guardado en Personalización
 *  con la fecha: 'auto' = por calendario, 'off' = apagada, '<id>' = forzada. */
export function resolveSeason(mode = 'auto', date = new Date()) {
  if (mode === 'off') return null;
  if (mode && mode !== 'auto') return SEASONS.find(s => s.id === mode) || null;
  return getSeason(date);
}
