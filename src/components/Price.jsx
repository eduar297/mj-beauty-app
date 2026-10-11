import { useFx } from '../hooks/useFx.jsx';
import { usdAmount, cupAmount } from '../lib/money';

// Precio de cara a la clienta.
// Siempre deja claro que el número es en dólares (etiqueta "USD" al lado) y,
// si hay tasa configurada, muestra debajo el equivalente en pesos cubanos.
// Soporta rangos (servicios con precio "desde–hasta").
export default function Price({ usd, usdMax, color = 'var(--gold)', size = 'md', align = 'right' }) {
  const { rate } = useFx();
  const isRange = usdMax != null && Number(usdMax) > Number(usd);

  const main = isRange ? `${usdAmount(usd)} – ${usdAmount(usdMax)}` : usdAmount(usd);
  const lo = cupAmount(usd, rate);
  const cup = lo && (isRange ? `${lo} – ${cupAmount(usdMax, rate)} CUP` : `${lo} CUP`);

  const sizes = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl' };

  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <div className={`font-serif font-bold leading-tight ${sizes[size] || sizes.md}`} style={{ color }}>
        {main}
        <span className="ml-1 font-sans font-semibold text-[0.55em] tracking-[0.15em] align-middle opacity-60">USD</span>
      </div>
      {cup && (
        <div className="mt-1 inline-block text-[10px] leading-none text-text-muted bg-bg-elevated border border-border rounded-md px-1.5 py-1 whitespace-nowrap">
          ≈ {cup}
        </div>
      )}
    </div>
  );
}

// Variante compacta para el panel de gestión. Mismo criterio que la pública
// (siempre dice USD y enseña el equivalente en CUP), pero sin el tamaño ni la
// píldora: en las tarjetas del panel no hay sitio.
export function DualPrice({ usd, usdMax, color = 'var(--gold)', align = 'right' }) {
  const { rate } = useFx();
  const isRange = usdMax != null && Number(usdMax) > Number(usd);

  const main = isRange ? `${usdAmount(usd)} – ${usdAmount(usdMax)}` : usdAmount(usd);
  const lo = cupAmount(usd, rate);
  const cup = lo && (isRange ? `${lo} – ${cupAmount(usdMax, rate)}` : lo);

  return (
    <div className={`leading-tight ${align === 'right' ? 'text-right' : ''}`}>
      <div className="font-serif font-bold whitespace-nowrap" style={{ color }}>
        {main}
        <span className="ml-1 font-sans font-semibold text-[0.5em] tracking-[0.15em] align-middle opacity-60">USD</span>
      </div>
      {cup && <div className="text-[10px] text-text-muted whitespace-nowrap">{cup} CUP</div>}
    </div>
  );
}

// Línea de ayuda para los formularios: el equivalente en pesos de lo que se
// está escribiendo, para no tener que calcularlo aparte.
export function CupHint({ usd, label = 'En pesos' }) {
  const { rate } = useFx();
  const cup = cupAmount(usd, rate);
  if (!cup) return null;
  return (
    <div className="-mt-2 mb-3 text-[11px] text-text-muted">
      {label}: <strong className="text-text-secondary">{cup} CUP</strong> al cambio de hoy
    </div>
  );
}
