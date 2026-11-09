import { useEffect, useState } from 'react';
import { getSeason, resolveSeason, SEASONS } from '../lib/season';
import { api_settings } from '../lib/api';

// Previsualizar una temporada fuera de fecha: ?season=navidad (o ?season=off).
function override() {
  const id = new URLSearchParams(location.search).get('season');
  if (!id) return undefined;
  return id === 'off' ? null : SEASONS.find(s => s.id === id) || null;
}

/** Temporada activa (null = sin decoración).
 *  Manda el modo guardado en Personalización ('auto' | 'off' | id de temporada);
 *  en 'auto' decide la fecha. Pone data-season en <html> para el CSS. */
// Una sola petición para toda la app: cada tarjeta monta su propio useSeason.
let modePromise;
const loadMode = () => (modePromise ||= api_settings.get()
  .then(({ data }) => data?.season_mode || 'auto')
  .catch(() => 'auto'));

export function useSeason() {
  const [mode, setMode] = useState('auto');
  const [season, setSeason] = useState(() => override() ?? getSeason());

  useEffect(() => {
    let alive = true;
    loadMode().then(m => { if (alive) setMode(m); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const check = () => setSeason(override() ?? resolveSeason(mode));
    check();
    // Una pestaña que se queda abierta al cambiar el día se actualiza al volver a ella.
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, [mode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-season', season?.id || '');
  }, [season?.id]);

  return season;
}

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const FLAKES = ['❄', '❅', '✦', '•'];

/** Icono de la temporada en SVG (los emoji cambian de forma en cada móvil).
 *  Si una temporada nueva no trae icono, cae en su emoji. */
export function SeasonIcon({ season, size = 13 }) {
  if (!season) return null;
  if (season.id === 'navidad') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="flex-shrink-0">
        <path d="M12 2l4 6h-2.5l3.5 5h-2.5l4 6H5.5l4-6H7l3.5-5H8z" fill="currentColor" />
        <rect x="10.8" y="19" width="2.4" height="3" fill="currentColor" />
      </svg>
    );
  }
  return <span aria-hidden="true">{season.badge}</span>;
}

/** Nevada en tres capas (las de atrás, pequeñas y borrosas; las de delante,
 *  grandes y nítidas) para que se note profundidad. No intercepta clics. */
export function Snow({ count = 24 }) {
  if (reducedMotion()) return null;
  return (
    <div className="season-snow" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const layer = i % 3; // 0 = fondo … 2 = primer plano
        return (
          <span
            key={i}
            style={{
              left: `${(i * 37) % 100}%`,
              fontSize: `${6 + layer * 5}px`,
              opacity: 0.3 + layer * 0.22,
              filter: layer === 0 ? 'blur(1.2px)' : 'none',
              animationDuration: `${16 - layer * 4 + (i % 5)}s`,
              animationDelay: `${-(i * 1.3).toFixed(1)}s`,
              '--drift': `${(i % 2 ? 1 : -1) * (10 + layer * 14)}px`,
            }}
          >
            {FLAKES[i % FLAKES.length]}
          </span>
        );
      })}
    </div>
  );
}

/** Guirnalda colgante: cable en curva (SVG estirable) con bombillas que
 *  siguen la caída y parpadean desfasadas. El contenedor debe ser relative. */
export function Lights({ count = 16, className = '' }) {
  const bulbs = Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1);
    // Misma curva que el cable: festones de dos arcos a lo ancho.
    const sag = Math.sin(t * Math.PI * 4) ** 2;
    return { left: `${t * 100}%`, top: `${6 + sag * 11}px`, delay: `${(i % 5) * 0.28}s` };
  });
  return (
    <div className={`season-lights ${className}`} aria-hidden="true">
      <svg className="season-lights-wire" viewBox="0 0 100 20" preserveAspectRatio="none">
        <path d="M0 6 Q 12.5 20 25 6 T 50 6 T 75 6 T 100 6" fill="none" stroke="currentColor" strokeWidth="0.7" />
      </svg>
      {bulbs.map((b, i) => (
        <i key={i} style={{ left: b.left, top: b.top, animationDelay: b.delay }} />
      ))}
    </div>
  );
}

/** Gorrito de Santa para colgar sobre un logo redondo (contenedor relative). */
export function SantaHat({ size = 34, className = '' }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true"
      className={`pointer-events-none absolute -top-[14%] -left-[10%] -rotate-[18deg] drop-shadow ${className}`}>
      <path d="M8 46c2-18 12-32 28-32 10 0 16 7 16 15 0 6-4 11-11 13L8 46z" fill="#d6283b" />
      <path d="M8 46c2-18 12-32 28-32 5 0 9 2 11 5-12 2-22 13-25 28l-14-1z" fill="#ef4257" />
      <rect x="2" y="43" width="50" height="11" rx="5.5" fill="#fdf8f4" />
      <circle cx="54" cy="16" r="8" fill="#fdf8f4" />
    </svg>
  );
}

/** Reno al galope (silueta), mirando a la derecha. */
function Deer({ x = 0 }) {
  return (
    <g transform={`translate(${x} 14)`}>
      <g fill="#2a1f1a">
        <ellipse cx="20" cy="15" rx="12.5" ry="6" />
        <path d="M11 19l-6 11 2.6 1.6 6-10z" />
        <path d="M15.5 20l-1.2 11h3.2l1.4-10z" />
        <path d="M26.5 20l1.2 11h3.2l-1.4-10z" />
        <path d="M30 19l6 10-2.6 1.6-6-9z" />
        <path d="M8.5 12L1 7l1.4 6.4z" />
        <path d="M29.5 13.5l5.5-8.5 4.2 2.8-5.4 8.4z" />
        <path d="M34.5 4.5c2.6-2.8 7.4-3 9.6-.4 1.2 1.6-.6 4-3.6 4.2-3 .2-7.2-1.6-6-3.8z" />
      </g>
      <g stroke="#2a1f1a" strokeWidth="1.3" fill="none" strokeLinecap="round">
        <path d="M36.5 2.5L34 -3.5M35.4 0l-3.8-1.2M39.5 2L41 -4M40.2 0.4l3.8-1.4" />
      </g>
    </g>
  );
}

/** Trineo de Santa que cruza la pantalla cada tanto, con estela de polvo mágico. */
export function Sleigh() {
  if (reducedMotion()) return null;
  return (
    <div className="season-sleigh" aria-hidden="true">
      <svg viewBox="0 0 190 62">
        <Deer x={0} />
        <Deer x={48} />
        {/* riendas */}
        <path d="M44 20h10M92 22h16" stroke="#2a1f1a" strokeWidth="1.3" fill="none" />
        {/* trineo */}
        <path d="M118 48c0-9 5-13 14-13h28c6 0 9 3 9 9v4h-51z" fill="#c62a3b" />
        <path d="M133 38h26v4h-26z" fill="#e0b64b" />
        <path d="M114 51h60c2.2 0 2.2 3.2 0 3.2h-58c-4.4 0-7.6-3.2-7.6-6.6 0 2.2 2.6 3.4 5.6 3.4z" fill="#8f1f2c" />
        {/* saco de regalos */}
        <circle cx="152" cy="28" r="9.5" fill="#2f6f45" />
        <path d="M146.5 22.5l5.5-6 5.5 6z" fill="#2f6f45" />
        <path d="M152 18.5v19M142.5 28h19" stroke="#9fd3b2" strokeWidth="1.4" />
        {/* Santa */}
        <path d="M122 36c0-6 3.5-9 7-9s7 3 7 9z" fill="#c62a3b" />
        <circle cx="129" cy="22" r="6" fill="#f3d9c0" />
        <path d="M123 21c0-5 3.5-8 6.5-8 3.2 0 6.2 2.6 5.8 6.6l-5.8-2.2-6.5 3.6z" fill="#c62a3b" />
        <circle cx="135.5" cy="18.5" r="2.4" fill="#fdf8f4" />
        <path d="M124.5 25.5c3 3.6 7 3.6 9.6 0l-1.2 7h-7.4z" fill="#fdf8f4" />
        <path d="M136 32l8-4" stroke="#f3d9c0" strokeWidth="3.4" strokeLinecap="round" />
      </svg>
      <span className="season-sleigh-trail" />
    </div>
  );
}

/** Banco de nieve que remata una sección por abajo. */
export function SnowBank({ className = '' }) {
  return (
    <svg viewBox="0 0 1440 70" preserveAspectRatio="none" aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 bottom-0 w-full h-[42px] sm:h-[60px] ${className}`}>
      <path d="M0 70V34c120-18 210 10 330 8s170-26 300-22 190 30 320 26 250-28 370-16 120 10 120 10v30z" fill="#ffffff" opacity="0.92" />
      <path d="M0 70V50c150-10 250 8 400 6s230-18 380-14 230 20 380 12 280-14 280-14v30z" fill="#eaf2ff" opacity="0.85" />
    </svg>
  );
}

/** Bolas colgando del borde superior de una sección (contenedor relative). */
export function Baubles({ lefts = [8, 18, 86, 94], className = '' }) {
  const colors = ['#c62a3b', '#1d7140', '#d8a32b', '#3b6fd4'];
  return (
    <div className={`season-baubles ${className}`} aria-hidden="true">
      {lefts.map((l, i) => (
        <i key={i} style={{ left: `${l}%`, height: `${26 + (i % 3) * 16}px`, animationDelay: `${(i % 4) * 0.5}s` }}>
          <b style={{ background: colors[i % colors.length] }} />
        </i>
      ))}
    </div>
  );
}

/** Capita de nieve posada en el borde superior de una foto. */
export function SnowCap({ className = '' }) {
  return (
    <svg viewBox="0 0 200 18" preserveAspectRatio="none" aria-hidden="true"
      className={`season-snowcap ${className}`}>
      <path d="M0 6 Q5 13 10 7 Q15 15 20 6 Q25 11 30 8 Q35 16 40 6 Q45 12 50 7 Q55 14 60 6 Q65 10 70 8 Q75 15 80 7 Q85 13 90 6 Q95 11 100 8 Q105 16 110 6 Q115 12 120 7 Q125 14 130 7 Q135 11 140 6 Q145 15 150 8 Q155 13 160 6 Q165 12 170 7 Q175 16 180 8 Q185 11 190 6 Q195 14 200 7 L200 0 L0 0 Z" fill="#fff" />
      <circle cx="46" cy="15" r="2.2" fill="#fff" />
      <circle cx="128" cy="16" r="2.6" fill="#fff" />
    </svg>
  );
}

/** Nieve + guirnalda para las páginas internas (servicios, productos, galería).
 *  El contenedor de la cabecera pegajosa debe ser relative. */
export function SeasonHeaderDecor({ season, lights = 12, snow = 14 }) {
  if (!season) return null;
  return (
    <>
      {season.decor === 'snow' && <Snow count={snow} />}
      <Lights count={lights} />
    </>
  );
}
