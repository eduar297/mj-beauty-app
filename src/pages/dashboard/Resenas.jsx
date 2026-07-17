import { useState, useEffect } from 'react';
import { Header } from '../Dashboard.jsx';
import { Icon, Btn, Stars, ListLoading, StatusBadge } from '../../components/ui.jsx';
import { api_reviews } from '../../lib/api';

const FILTERS = [
  { id: 'todas',    label: 'Todas' },
  { id: 'visibles', label: 'Visibles' },
  { id: 'ocultas',  label: 'Ocultas' },
];

export default function Resenas() {
  const [reviews, setReviews] = useState(null); // null = loading
  const [filter, setFilter] = useState('todas');

  const load = () => api_reviews.listAll().then(({ data }) => setReviews(data || []));
  useEffect(() => { load(); }, []);

  const all = reviews || [];
  const visible = all.filter(r => r.approved);
  const avg = visible.length
    ? (visible.reduce((s, r) => s + r.rating, 0) / visible.length).toFixed(1)
    : null;

  const filtered = all.filter(r =>
    filter === 'todas' ? true : filter === 'visibles' ? r.approved : !r.approved
  );

  const toggle = async (r) => {
    // Optimista: la moderación debe sentirse instantánea.
    setReviews(prev => prev.map(x => x.id === r.id ? { ...x, approved: !r.approved } : x));
    const { error } = await api_reviews.setApproved(r.id, !r.approved);
    if (error) load();
  };

  const remove = async (r) => {
    if (!confirm(`¿Eliminar la reseña de ${r.name}? Esto no se puede deshacer.`)) return;
    setReviews(prev => prev.filter(x => x.id !== r.id));
    const { error } = await api_reviews.remove(r.id);
    if (error) load();
  };

  return (
    <div>
      <Header
        title="Reseñas"
        subtitle={avg
          ? `Promedio ${avg} ★ · ${visible.length} visible${visible.length !== 1 ? 's' : ''} de ${all.length}`
          : 'Las reseñas que dejan las clientas en la página'}
      />

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {FILTERS.map(f => {
          const count = f.id === 'todas' ? all.length : f.id === 'visibles' ? visible.length : all.length - visible.length;
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm border whitespace-nowrap flex-shrink-0 cursor-pointer transition ${active ? 'bg-gold-dim text-gold border-gold' : 'bg-bg-card text-text-secondary border-border hover:border-border-strong'}`}>
              {f.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-gold/20' : 'bg-bg-elevated'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {reviews === null ? (
        <ListLoading label="Cargando reseñas…" />
      ) : filtered.length === 0 ? (
        <div className="text-center text-text-muted py-14 bg-bg-card border border-border rounded-2xl">
          <Icon name="star" size={28} color="var(--text-muted)" />
          <p className="mt-3 text-sm">
            {all.length === 0
              ? 'Aún no hay reseñas. Cuando una clienta deje la suya en la página, aparecerá aquí.'
              : 'No hay reseñas en este filtro.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(r => (
            <div key={r.id}
              className={`bg-bg-card border rounded-2xl p-4 sm:p-5 ${r.approved ? 'border-border' : 'border-border opacity-60'}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-semibold text-sm">{r.name}</span>
                    <Stars value={r.rating} size={13} />
                    {r.clients && <StatusBadge status={r.clients.status} />}
                    {!r.approved && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider bg-red-500/15 text-red-400">Oculta</span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-muted mt-1">
                    {new Date(r.created_at).toLocaleString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {r.phone && <> · 📞 {r.phone}</>}
                    {r.clients?.visits != null && <> · {r.clients.visits} visita{r.clients.visits !== 1 ? 's' : ''}</>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Btn small variant="ghost" icon={r.approved ? 'close' : 'check'} onClick={() => toggle(r)}>
                    {r.approved ? 'Ocultar' : 'Mostrar'}
                  </Btn>
                  <button onClick={() => remove(r)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border text-red-400 hover:border-red-400 transition cursor-pointer">
                    Eliminar
                  </button>
                </div>
              </div>
              {r.comment && (
                <p className="text-sm text-text-secondary leading-relaxed mt-3 whitespace-pre-line">“{r.comment}”</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
