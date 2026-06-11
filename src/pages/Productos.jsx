import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon, ListLoading, PROD_CAT_COLORS, PROD_CAT_ICONS } from '../components/ui.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { api_products, api_settings } from '../lib/api';

const CATS = ['Uñas', 'Piel', 'Cabello', 'Maquillaje', 'Accesorios', 'Otros'];

export default function Productos() {
  const { cat: paramCat } = useParams();
  const nav = useNavigate();
  // 'Todos' por defecto: el catálogo de productos es más chico que el de servicios.
  const [activeCat, setActiveCat] = useState(CATS.includes(paramCat) ? paramCat : 'Todos');
  const [products, setProducts] = useState(null); // null = loading
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api_products.listPublic().then(({ data }) => setProducts(data || []));
    api_settings.get().then(({ data }) => setSettings(data || {}));
  }, []);

  const filtered = (products || []).filter(p => activeCat === 'Todos' || p.cat === activeCat);

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="sticky top-0 z-10 bg-bg-card/90 backdrop-blur border-b border-border h-16 flex items-center justify-between px-4 sm:px-10 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => nav('/')} className="border border-border rounded-lg px-3 py-1.5 text-xs text-text-secondary flex items-center gap-1 cursor-pointer hover:border-gold transition-colors">
            <Icon name="chevronLeft" size={13} /><span className="hidden sm:inline">Inicio</span>
          </button>
          <div className="font-serif font-semibold truncate" style={{ fontSize: 'clamp(16px,3vw,20px)' }}>
            Nuestros <span className="text-gold italic">Productos</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-10 py-8">
        <div className="flex gap-2 mb-7 overflow-x-auto pb-1">
          {['Todos', ...CATS].map(c => {
            const color = c === 'Todos' ? 'var(--gold)' : PROD_CAT_COLORS[c];
            const active = activeCat === c;
            return (
              <button key={c} onClick={() => setActiveCat(c)}
                style={{ background: active ? (c === 'Todos' ? 'var(--gold-dim)' : `${color}22`) : 'var(--bg-card)', color: active ? color : 'var(--text-secondary)', borderColor: active ? (c === 'Todos' ? 'var(--gold)' : color + '55') : 'var(--border)' }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm border whitespace-nowrap flex-shrink-0 cursor-pointer">
                <Icon name={c === 'Todos' ? 'bag' : PROD_CAT_ICONS[c]} size={14} color={active ? color : 'var(--text-muted)'} />
                {c}
              </button>
            );
          })}
        </div>

        {products === null ? (
          <ListLoading label="Cargando productos…" />
        ) : (
          <div className="grid gap-4 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 320px))' }}>
            {filtered.map(p => (
              <ProductCard key={p.id} product={p} whatsapp={settings?.whatsapp} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-text-muted py-12">Aún no hay productos en esta categoría.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
