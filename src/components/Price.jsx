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
