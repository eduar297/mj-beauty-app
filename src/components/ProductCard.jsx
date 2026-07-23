import { Icon, PROD_CAT_COLORS } from './ui.jsx';
import { fmtMoney as fmt } from '../lib/money';
import { useFx } from '../hooks/useFx.jsx';

// Con stock ≤ LOW_STOCK (y > 0) se muestra "¡Últimas unidades!".
export const LOW_STOCK = 3;

// Tarjeta pública de producto (landing + /productos). El pedido se hace por
// WhatsApp con mensaje pre-armado; si el número no está configurado en
// Personalización, el botón simplemente no se muestra.
export default function ProductCard({ product: p, whatsapp }) {
  const { fmtCup } = useFx();
  const color = PROD_CAT_COLORS[p.cat] || 'var(--gold)';
  const cup = fmtCup(p.price);
  const out = (p.stock ?? 0) <= 0;
  const low = !out && p.stock <= LOW_STOCK;
  const waHref = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, quiero pedir: ${p.name} (${fmt(p.price)})`)}`
    : null;

  return (
    <div className="bg-bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-1 motion-reduce:transform-none transition flex flex-col">
      <div className="aspect-square bg-bg-elevated relative overflow-hidden">
        {p.photo_url
          ? <img src={p.photo_url} alt={p.name} loading="lazy" className={`w-full h-full object-cover ${out ? 'grayscale opacity-60' : ''}`} />
          : <div className="w-full h-full grid place-items-center"><Icon name="bag" size={36} color="var(--gold)" /></div>}
        {out && (
          <span className="absolute top-2.5 right-2.5 bg-bg-card/90 text-red-400 border border-border-strong text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            Agotado
          </span>
        )}
        {low && (
          <span className="absolute top-2.5 right-2.5 bg-bg-card/90 text-gold border border-border-strong text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            ¡Últimas unidades!
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-1 gap-2">
          <div className="font-semibold text-sm min-w-0">{p.name}</div>
          <div className="flex-shrink-0 text-right">
            <div className="font-serif font-bold" style={{ color }}>{fmt(p.price)}</div>
            {cup && <div className="text-[10px] text-text-muted mt-0.5">{cup}</div>}
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2">{p.cat}</div>
        {p.description && (
          <p className="text-xs text-text-muted leading-relaxed mb-3 whitespace-pre-line">{p.description}</p>
        )}

        <div className="mt-auto pt-1">
          {out ? (
            <button type="button" disabled
              className="w-full py-2 rounded-lg text-xs font-bold border border-border text-text-muted cursor-not-allowed opacity-60">
              Agotado
            </button>
          ) : waHref && (
            <a href={waHref} target="_blank" rel="noopener noreferrer"
              className="w-full py-2.5 rounded-lg text-xs font-bold cursor-pointer transition flex items-center justify-center gap-1.5 text-white shadow-sm hover:brightness-110 active:brightness-95"
              style={{ background: '#25D366' }}>
              <Icon name="whatsapp" size={14} color="#fff" /> Pedir por WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
