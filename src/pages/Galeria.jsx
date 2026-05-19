import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Icon, ListLoading, BeforeAfterPair, PhotoTile, Lightbox, photosToSlides, CAT_COLORS, CAT_ICONS } from '../components/ui.jsx';
import { api_service_photos } from '../lib/api';

const CATS = ['Uñas', 'Pelo', 'Faciales', 'Cejas', 'Pestañas'];
const TYPES = [
  { id: 'all',     label: 'Todas' },
  { id: 'ba',      label: 'Antes / Después' },
  { id: 'normal',  label: 'Resultados' },
];

export default function Galeria() {
  const nav = useNavigate();
  const [photos, setPhotos] = useState(null); // null = loading
  const [cat, setCat] = useState('all');
  const [type, setType] = useState('all');
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    api_service_photos.listAll().then(({ data }) => setPhotos(data || []));
  }, []);

  const filtered = useMemo(() => {
    if (!photos) return [];
    return photos.filter(p => {
      if (cat !== 'all' && p.services?.cat !== cat) return false;
      if (type === 'ba' && !(p.kind === 'pair' || p.kind === 'combined')) return false;
      if (type === 'normal' && p.kind !== 'normal') return false;
      return true;
    });
  }, [photos, cat, type]);

  const openLightboxAt = (photoId) => {
    const { slides, indexFor } = photosToSlides(filtered);
    setLightbox({ slides, index: indexFor[photoId] ?? 0 });
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="sticky top-0 z-10 bg-bg-card/90 backdrop-blur border-b border-border h-16 flex items-center justify-between px-4 sm:px-10 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => nav('/')} className="border border-border rounded-lg px-3 py-1.5 text-xs text-text-secondary flex items-center gap-1 cursor-pointer hover:border-gold transition-colors">
            <Icon name="chevronLeft" size={13} /><span className="hidden sm:inline">Inicio</span>
          </button>
          <div className="font-serif font-semibold truncate" style={{ fontSize: 'clamp(16px,3vw,20px)' }}>
            Nuestra <span className="text-gold italic">Galería</span>
          </div>
        </div>
        <Link to="/servicios" className="bg-gold text-[#0d0c0a] px-4 py-2 rounded-lg text-sm font-bold flex-shrink-0 cursor-pointer hover:opacity-90 transition">Ver servicios</Link>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-10 py-8">
        <div className="flex flex-col gap-3 mb-7">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <FilterChip active={cat === 'all'} onClick={() => setCat('all')} label="Todas" />
            {CATS.map(c => {
              const color = CAT_COLORS[c]; const active = cat === c;
              return (
                <button key={c} onClick={() => setCat(c)}
                  style={{ background: active ? `${color}22` : 'var(--bg-card)', color: active ? color : 'var(--text-secondary)', borderColor: active ? `${color}55` : 'var(--border)' }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm border whitespace-nowrap flex-shrink-0 cursor-pointer">
                  <Icon name={CAT_ICONS[c]} size={14} color={active ? color : 'var(--text-muted)'} />
                  {c}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TYPES.map(t => (
              <FilterChip key={t.id} active={type === t.id} onClick={() => setType(t.id)} label={t.label} />
            ))}
          </div>
        </div>

        {photos === null ? (
          <ListLoading label="Cargando galería…" />
        ) : filtered.length === 0 ? (
          <div className="text-center text-text-muted py-16">
            <div className="w-14 h-14 rounded-full bg-gold-dim border border-border-strong text-gold grid place-items-center mx-auto mb-3">
              <Icon name="sparkle" size={22} />
            </div>
            <p className="text-sm">Pronto subiremos nuestros trabajos por aquí.</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-3 [column-fill:_balance]">
            {filtered.map(p => (
              <div key={p.id} className="mb-3 break-inside-avoid">
                {p.kind === 'pair'
                  ? <BeforeAfterPair beforeUrl={p.before_url} afterUrl={p.after_url} caption={p.caption || p.services?.name} size="sm" onClick={() => openLightboxAt(p.id)} />
                  : <PhotoTile url={p.url} kind={p.kind} caption={p.caption || p.services?.name} size="md" onClick={() => openLightboxAt(p.id)} />}
              </div>
            ))}
          </div>
        )}
      </div>

      <Lightbox open={!!lightbox} onClose={() => setLightbox(null)} slides={lightbox?.slides || []} index={lightbox?.index || 0} />
    </div>
  );
}

function FilterChip({ active, onClick, label }) {
  return (
    <button onClick={onClick}
      style={{ background: active ? 'var(--gold-dim)' : 'var(--bg-card)', color: active ? 'var(--gold)' : 'var(--text-secondary)', borderColor: active ? 'var(--border-strong)' : 'var(--border)' }}
      className="px-4 py-2 rounded-full text-sm border whitespace-nowrap flex-shrink-0 cursor-pointer">
      {label}
    </button>
  );
}
