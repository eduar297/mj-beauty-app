import { Icon, CAT_COLORS, CAT_ICONS } from './ui.jsx';

// Orden canónico de categorías de servicio (igual que en la landing / Servicios).
const CAT_ORDER = ['Uñas', 'Pedicura', 'Pelo', 'Faciales', 'Cejas', 'Pestañas'];
// 'Pelo' se muestra como 'Cabello' de cara a la clienta.
const CAT_LABEL = { Pelo: 'Cabello' };

function groupByCat(services) {
  const byCat = {};
  for (const s of services || []) (byCat[s.cat] ||= []).push(s);
  const cats = Object.keys(byCat).sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a); const ib = CAT_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return cats.map(cat => ({ cat, items: byCat[cat] }));
}

// Lista de servicios con casillas, agrupada por categoría (encabezado sticky).
// Reutilizada por el formulario de reserva público y por la Agenda del admin.
export default function ServicePicker({ services, selectedIds, onToggle, maxHeight = 'max-h-64' }) {
  const groups = groupByCat(services);
  return (
    <div className={`${maxHeight} overflow-y-auto rounded-lg border border-border`}>
      {groups.map(({ cat, items }) => (
        <div key={cat}>
          <div className="sticky top-0 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-bg-elevated/95 backdrop-blur border-b border-border text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: CAT_COLORS[cat] || 'var(--text-muted)' }}>
            <Icon name={CAT_ICONS[cat] || 'sparkle'} size={12} color={CAT_COLORS[cat] || 'var(--text-muted)'} />
            {CAT_LABEL[cat] || cat}
          </div>
          {items.map(s => {
            const checked = selectedIds.includes(s.id);
            return (
              <button key={s.id} type="button" onClick={() => onToggle(s.id)} aria-pressed={checked}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer transition border-b border-border last:border-0 ${checked ? 'bg-gold-dim' : 'hover:bg-bg-hover'}`}>
                <span className={`w-4 h-4 rounded border flex-shrink-0 grid place-items-center ${checked ? 'bg-gold border-gold' : 'border-border-strong'}`}>
                  {checked && <Icon name="check" size={11} color="#0d0c0a" />}
                </span>
                <span className="flex-1 min-w-0 text-sm truncate">{s.name}</span>
                <span className="text-[11px] text-text-muted flex-shrink-0">{s.duration}min</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
