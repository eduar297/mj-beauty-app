import { useState } from 'react';
import LB from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

// Iconos SVG inline reutilizables
export function Icon({ name, size = 18, color = 'currentColor' }) {
  const paths = {
    calendar: "M8 2v3M16 2v3M3.5 8h17M5 4h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
    users: "M16 11c1.66 0 2.99 1.34 2.99 3S17.66 17 16 17m4 2c0-1.86-1.27-3.43-3-3.87M1 21c0-3 2.69-5 6-5s6 2 6 5M7 11a4 4 0 100-8 4 4 0 000 8z",
    scissors: "M6 3a3 3 0 110 6 3 3 0 010-6zm12 12a3 3 0 110 6 3 3 0 010-6zM20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12",
    staff: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm8 1l2 2 4-4",
    cash: "M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6",
    home: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
    plus: "M12 5v14M5 12h14",
    search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    bell: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
    chevronLeft: "M15 18l-6-6 6-6",
    chevronRight: "M9 18l6-6-6-6",
    chevronsLeft: "M11 17l-5-5 5-5M18 17l-5-5 5-5",
    star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    check: "M20 6L9 17l-5-5",
    close: "M18 6L6 18M6 6l12 12",
    edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
    trash: "M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6",
    clock: "M12 22a10 10 0 100-20 10 10 0 000 20zm0-14v4l3 3",
    sparkle: "M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z",
    nail: "M7 3h10l1 5-6 14-6-14z",
    foot: "M9 3c1.7 0 3 1.6 3 3.5S10.7 10 9 10 6 8.4 6 6.5 7.3 3 9 3zM15 2c1.1 0 2 1 2 2.3s-.9 2.3-2 2.3-2-1-2-2.3S13.9 2 15 2zM18 5.5c.8 0 1.5.8 1.5 1.8S18.8 9 18 9s-1.5-.8-1.5-1.8.7-1.7 1.5-1.7zM7 11c2 0 4 2 4 4v2c0 1.7-1.3 3-3 3H7c-1.7 0-3-1.3-3-3v-2c0-2 1-4 3-4z",
    hair: "M8 3c0 0 1 4-1 8s-1 8 5 9M16 3c0 0-1 4 1 8s1 8-5 9",
    eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 100 6 3 3 0 000-6z",
    face: "M12 22a10 10 0 100-20 10 10 0 000 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
    brow: "M5 10c2-3 5-4 7-4s5 1 7 4",
    card: "M3 10h18M7 15h1m4 0h1M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1z",
    transfer: "M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4",
    menu: "M3 6h18M3 12h18M3 18h18",
    logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
    settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z",
    phone: "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z",
    mail: "M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6",
    map: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 7a3 3 0 100 6 3 3 0 000-6z",
    instagram: "M16 3H8a5 5 0 00-5 5v8a5 5 0 005 5h8a5 5 0 005-5V8a5 5 0 00-5-5zM12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7zM17.5 6.5h.01",
    facebook: "M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z",
    tiktok: "M9 12a4 4 0 104 4V4a5 5 0 005 5",
    save: "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8",
    whatsapp: "M3 21l1.65-3.8a9 9 0 113.4 2.9zM9 10a.5.5 0 011 0v1a.5.5 0 01-1 0zM14 10a.5.5 0 011 0v1a.5.5 0 01-1 0zM9 14c1 1 2 1.5 3 1.5s2-.5 3-1.5",
    bag: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0",
    info: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 8h.01M11 12h1v4h1",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || paths.sparkle} />
    </svg>
  );
}

export const CAT_COLORS = { 'Uñas': '#c9a96e', 'Pedicura': '#d8b87a', 'Pelo': '#d4a5a0', 'Faciales': '#a8c4c0', 'Cejas': '#c4b8a0', 'Pestañas': '#b8a0c4' };
export const CAT_ICONS = { 'Uñas': 'nail', 'Pedicura': 'foot', 'Pelo': 'hair', 'Faciales': 'face', 'Cejas': 'brow', 'Pestañas': 'eye' };

// Categorías de productos a la venta (distintas de las de servicios).
export const PROD_CAT_COLORS = { 'Uñas': '#c9a96e', 'Piel': '#a8c4c0', 'Cabello': '#d4a5a0', 'Maquillaje': '#b8a0c4', 'Accesorios': '#c4b8a0', 'Otros': '#8a6f4a' };
export const PROD_CAT_ICONS = { 'Uñas': 'nail', 'Piel': 'face', 'Cabello': 'hair', 'Maquillaje': 'sparkle', 'Accesorios': 'star', 'Otros': 'bag' };

// Fila de 5 estrellas. Solo lectura por defecto; con onChange se vuelve
// un selector clickeable (para el formulario de reseñas).
const STAR_PATH = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

export function Stars({ value = 0, size = 15, onChange = null }) {
  const star = (i) => {
    const filled = i <= Math.round(value);
    return (
      <svg width={size} height={size} viewBox="0 0 24 24"
        fill={filled ? 'var(--gold)' : 'none'}
        stroke={filled ? 'var(--gold)' : 'var(--text-muted)'}
        strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
        <path d={STAR_PATH} />
      </svg>
    );
  };
  if (!onChange) {
    return (
      <div className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} de 5 estrellas`}>
        {[1, 2, 3, 4, 5].map(i => <span key={i}>{star(i)}</span>)}
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onClick={() => onChange(i)}
          aria-label={`${i} estrella${i > 1 ? 's' : ''}`} aria-pressed={i <= value}
          className="cursor-pointer p-0.5 hover:scale-110 motion-reduce:transform-none transition-transform">
          {star(i)}
        </button>
      ))}
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    confirmed: { label: 'Confirmada', cls: 'bg-green-500/15 text-green-500' },
    pending:   { label: 'Pendiente',  cls: 'bg-gold/15 text-gold' },
    cancelled: { label: 'Cancelada',  cls: 'bg-red-500/15 text-red-500' },
    completed: { label: 'Completada', cls: 'bg-blue-500/15 text-blue-400' },
    vip:       { label: 'VIP',        cls: 'bg-gold/20 text-gold' },
    regular:   { label: 'Regular',    cls: 'bg-white/10 text-text-muted' },
    new:       { label: 'Nueva',      cls: 'bg-blue-500/15 text-blue-400' },
  };
  const s = map[status] || map.regular;
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap ${s.cls}`}>{s.label}</span>;
}

export function Avatar({ initials, color = 'var(--gold)', size = 36, photoUrl, alt }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={alt || initials || ''}
        loading="lazy"
        style={{ width: size, height: size, borderColor: `${color}66` }}
        className="rounded-full object-cover flex-shrink-0 border"
      />
    );
  }
  return (
    <div style={{ width: size, height: size, background: `${color}22`, border: `1px solid ${color}44`, color, fontSize: size * 0.33 }}
      className="rounded-full grid place-items-center font-bold flex-shrink-0 font-sans">
      {initials}
    </div>
  );
}

export function Spinner({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin motion-reduce:hidden" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" fill="none" strokeDasharray="50 50" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export function Btn({ children, onClick, variant = 'primary', icon, small, type = 'button', disabled, loading }) {
  const base = 'inline-flex items-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
  const sz = small ? 'px-3.5 py-1.5 text-xs' : 'px-5 py-2.5 text-sm';
  const v = {
    primary: 'bg-gold text-[#0d0c0a] hover:opacity-90',
    ghost:   'bg-border text-text-secondary border border-border-strong hover:bg-bg-hover',
    outline: 'bg-transparent text-gold border border-border-strong hover:bg-gold-dim',
  }[variant];
  const isDisabled = disabled || loading;
  return (
    <button type={type} onClick={onClick} disabled={isDisabled} aria-busy={loading || undefined} className={`${base} ${sz} ${v}`}>
      {loading ? <Spinner size={small ? 12 : 14} /> : (icon && <Icon name={icon} size={small ? 12 : 14} />)}
      {children}
    </button>
  );
}

// Bloque de carga inline para listas mientras llega data del servidor.
export function ListLoading({ label = 'Cargando…' }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-10 text-text-muted text-sm">
      <Spinner size={14} color="var(--gold)" /> {label}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="mb-3.5">
      <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      className="w-full bg-bg-card border border-border rounded-lg px-3 py-2.5 text-text text-base outline-none focus:border-gold appearance-none" />
  );
}

export function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={onChange}
      className="w-full bg-bg-card border border-border rounded-lg px-3 py-2.5 text-text text-base outline-none focus:border-gold appearance-none cursor-pointer">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// Paleta sugerida — alineada con CAT_COLORS y los temas de la marca.
const COLOR_PRESETS = [
  '#c9a96e', // gold
  '#e0a09a', // rose claro
  '#c47b72', // rose oscuro
  '#d4a5a0', // pelo
  '#a8c4c0', // facial
  '#c4b8a0', // cejas
  '#b8a0c4', // pestañas
  '#8a6f4a', // bronce
  '#6b8e7f', // verde sage
  '#7a6d8e', // lavanda
  '#1a1814', // negro suave
];

export function ColorPicker({ value, onChange, presets = COLOR_PRESETS }) {
  const v = value || presets[0];
  const set = (hex) => onChange({ target: { value: hex } });
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <label className="relative w-11 h-11 rounded-lg border border-border-strong overflow-hidden cursor-pointer shrink-0" style={{ background: v }}>
          <input
            type="color"
            value={v}
            onChange={(e) => set(e.target.value)}
            aria-label="Elegir color personalizado"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </label>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-text-muted">Color</div>
          <div className="font-mono text-sm text-text-primary">{v.toUpperCase()}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((c) => {
          const active = c.toLowerCase() === v.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => set(c)}
              aria-label={`Color ${c}`}
              aria-pressed={active}
              title={c}
              className={`w-7 h-7 rounded-full border transition cursor-pointer ${active ? 'ring-2 ring-gold ring-offset-2 ring-offset-bg-elevated border-transparent' : 'border-border-strong hover:scale-110 motion-reduce:transform-none'}`}
              style={{ background: c }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function TagInput({ value = [], onChange, placeholder = '', color, suggestions = [] }) {
  const [input, setInput] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [open, setOpen] = useState(false);
  const tagColor = color || 'var(--gold)';

  const matches = (() => {
    const q = input.trim().toLowerCase();
    const taken = new Set(value.map(v => v.toLowerCase()));
    // Dedup case-insensitive y filtra los ya seleccionados.
    const seen = new Set();
    const list = [];
    for (const s of suggestions) {
      const key = s.toLowerCase();
      if (taken.has(key) || seen.has(key)) continue;
      if (q && !key.includes(q)) continue;
      seen.add(key);
      list.push(s);
      if (list.length >= 8) break;
    }
    return list;
  })();

  const addTag = (raw) => {
    const t = (raw || '').trim();
    if (!t) return;
    if (value.some(v => v.toLowerCase() === t.toLowerCase())) { setInput(''); return; }
    onChange([...value, t]);
    setInput('');
    setHighlight(0);
  };
  const removeTag = (i) => onChange(value.filter((_, idx) => idx !== i));

  const handleKey = (e) => {
    if (e.key === 'ArrowDown' && matches.length) {
      e.preventDefault();
      setOpen(true);
      setHighlight(h => (h + 1) % matches.length);
    } else if (e.key === 'ArrowUp' && matches.length) {
      e.preventDefault();
      setOpen(true);
      setHighlight(h => (h - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && matches[highlight]) addTag(matches[highlight]);
      else addTag(input);
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && input === '' && value.length > 0) {
      e.preventDefault();
      removeTag(value.length - 1);
    }
  };
  const handleChange = (e) => {
    const v = e.target.value;
    setOpen(true);
    setHighlight(0);
    if (v.includes(',')) {
      const parts = v.split(',');
      const last = parts.pop();
      for (const p of parts) addTag(p);
      setInput(last);
    } else {
      setInput(v);
    }
  };
  const handleBlur = () => {
    // Pequeño delay para que el click en una opción no se pierda por el blur.
    setTimeout(() => {
      setOpen(false);
      if (input.trim()) addTag(input);
    }, 120);
  };

  const showDropdown = open && matches.length > 0;

  return (
    <div className="relative">
      <div className="w-full bg-bg-card border border-border rounded-lg px-2 py-1.5 flex flex-wrap items-center gap-1.5 focus-within:border-gold transition-colors">
        {value.map((t, i) => (
          <span key={`${t}-${i}`}
            style={{ background: `${tagColor}1f`, color: tagColor, borderColor: `${tagColor}55` }}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border whitespace-nowrap">
            {t}
            <button type="button" onClick={() => removeTag(i)} aria-label={`Quitar ${t}`}
              className="hover:text-red-400 cursor-pointer leading-none text-sm">×</button>
          </span>
        ))}
        <input
          value={input}
          onChange={handleChange}
          onKeyDown={handleKey}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] bg-transparent outline-none text-sm py-1 px-1 text-text"
        />
      </div>

      {showDropdown && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-bg-elevated border border-border-strong rounded-lg shadow-2xl max-h-56 overflow-y-auto py-1">
          {matches.map((m, i) => (
            <button key={m} type="button"
              onMouseDown={(e) => { e.preventDefault(); addTag(m); }}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-3 py-1.5 text-sm cursor-pointer flex items-center gap-2 ${i === highlight ? 'bg-bg-hover text-gold' : 'text-text-secondary hover:bg-bg-hover'}`}>
              <span className="w-1 h-1 rounded-full bg-gold/60 flex-shrink-0" aria-hidden="true" />
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Textarea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      className="w-full bg-bg-card border border-border rounded-lg px-3 py-2.5 text-text text-base outline-none focus:border-gold resize-y leading-relaxed" />
  );
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="bg-bg-elevated border border-border-strong rounded-t-2xl sm:rounded-2xl p-5 pb-8 sm:p-6 w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 rounded bg-border-strong mx-auto mb-5 sm:hidden" />
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-serif text-xl text-text">{title}</h3>
          <button onClick={onClose} className="text-text-muted p-1 rounded hover:bg-bg-hover">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Galería de fotos de servicios ───────────────────────────────────
const TILE_H = { sm: 'h-32', md: 'h-44', lg: 'h-56' };

function PhotoSide({ url, label, h }) {
  return (
    <div className={`relative ${h} bg-bg-elevated overflow-hidden`}>
      {url
        ? <img src={url} alt={label} loading="lazy" className="w-full h-full object-cover" />
        : <div className="w-full h-full grid place-items-center text-text-muted text-xs">Sin foto</div>}
      <span className="absolute top-2 left-2 bg-bg-card/90 text-gold border border-border-strong text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">{label}</span>
    </div>
  );
}

export function BeforeAfterPair({ beforeUrl, afterUrl, caption, onClick, size = 'md' }) {
  const h = TILE_H[size] || TILE_H.md;
  return (
    <div onClick={onClick}
      className={`rounded-2xl overflow-hidden border border-border bg-bg-card ${onClick ? 'cursor-pointer hover:-translate-y-0.5 motion-reduce:transform-none transition' : ''}`}>
      <div className="grid grid-cols-2 gap-px bg-border">
        <PhotoSide url={beforeUrl} label="ANTES"   h={h} />
        <PhotoSide url={afterUrl}  label="DESPUÉS" h={h} />
      </div>
      {caption && <div className="px-3 py-2 text-xs text-text-muted truncate">{caption}</div>}
    </div>
  );
}

export function PhotoTile({ url, kind = 'normal', caption, onClick, size = 'md' }) {
  const h = TILE_H[size] || TILE_H.md;
  return (
    <div onClick={onClick}
      className={`relative rounded-2xl overflow-hidden border border-border bg-bg-card ${onClick ? 'cursor-pointer hover:-translate-y-0.5 motion-reduce:transform-none transition' : ''}`}>
      <div className={`${h} bg-bg-elevated`}>
        {url
          ? <img src={url} alt={caption || ''} loading="lazy" className="w-full h-full object-cover" />
          : <div className="w-full h-full grid place-items-center text-text-muted text-xs">Sin foto</div>}
      </div>
      {kind === 'combined' && (
        <span className="absolute top-2 left-2 bg-bg-card/90 text-gold border border-border-strong text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Antes / Después</span>
      )}
      {caption && <div className="px-3 py-2 text-xs text-text-muted truncate">{caption}</div>}
    </div>
  );
}

// Aplana service_photos a slides para el lightbox.
// Devuelve {slides, indexFor} — indexFor(photoId) → posición del primer slide del item.
export function photosToSlides(photos) {
  const slides = [];
  const indexFor = {};
  for (const p of photos) {
    indexFor[p.id] = slides.length;
    if (p.kind === 'pair') {
      if (p.before_url) slides.push({ src: p.before_url, alt: 'Antes',    description: p.caption ? `ANTES · ${p.caption}` : 'ANTES' });
      if (p.after_url)  slides.push({ src: p.after_url,  alt: 'Después',  description: p.caption ? `DESPUÉS · ${p.caption}` : 'DESPUÉS' });
    } else if (p.url) {
      slides.push({ src: p.url, alt: p.caption || '', description: p.kind === 'combined' ? (p.caption ? `Antes / Después · ${p.caption}` : 'Antes / Después') : (p.caption || '') });
    }
  }
  return { slides, indexFor };
}

export function Lightbox({ open, onClose, slides, index = 0 }) {
  return (
    <LB
      open={open}
      close={onClose}
      slides={slides}
      index={index}
      styles={{ container: { backgroundColor: 'rgba(0,0,0,0.92)' } }}
      controller={{ closeOnBackdropClick: true }}
    />
  );
}

export function GoldDivider() {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-border" />
      <div className="w-1 h-1 rounded-full bg-gold opacity-60" />
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
