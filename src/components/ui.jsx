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
    star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    check: "M20 6L9 17l-5-5",
    close: "M18 6L6 18M6 6l12 12",
    edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
    clock: "M12 22a10 10 0 100-20 10 10 0 000 20zm0-14v4l3 3",
    sparkle: "M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z",
    nail: "M7 3h10l1 5-6 14-6-14z",
    hair: "M8 3c0 0 1 4-1 8s-1 8 5 9M16 3c0 0-1 4 1 8s1 8-5 9",
    eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 100 6 3 3 0 000-6z",
    face: "M12 22a10 10 0 100-20 10 10 0 000 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
    brow: "M5 10c2-3 5-4 7-4s5 1 7 4",
    card: "M3 10h18M7 15h1m4 0h1M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1z",
    transfer: "M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4",
    menu: "M3 6h18M3 12h18M3 18h18",
    logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || paths.sparkle} />
    </svg>
  );
}

export const CAT_COLORS = { 'Uñas': '#c9a96e', 'Pelo': '#d4a5a0', 'Faciales': '#a8c4c0', 'Cejas': '#c4b8a0', 'Pestañas': '#b8a0c4' };
export const CAT_ICONS = { 'Uñas': 'nail', 'Pelo': 'hair', 'Faciales': 'face', 'Cejas': 'brow', 'Pestañas': 'eye' };

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

export function Avatar({ initials, color = 'var(--gold)', size = 36 }) {
  return (
    <div style={{ width: size, height: size, background: `${color}22`, border: `1px solid ${color}44`, color, fontSize: size * 0.33 }}
      className="rounded-full grid place-items-center font-bold flex-shrink-0 font-sans">
      {initials}
    </div>
  );
}

export function Btn({ children, onClick, variant = 'primary', icon, small, type = 'button', disabled }) {
  const base = 'inline-flex items-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition disabled:opacity-50';
  const sz = small ? 'px-3.5 py-1.5 text-xs' : 'px-5 py-2.5 text-sm';
  const v = {
    primary: 'bg-gold text-[#0d0c0a] hover:opacity-90',
    ghost:   'bg-border text-text-secondary border border-border-strong hover:bg-bg-hover',
    outline: 'bg-transparent text-gold border border-border-strong hover:bg-gold-dim',
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sz} ${v}`}>
      {icon && <Icon name={icon} size={small ? 12 : 14} />}
      {children}
    </button>
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

export function GoldDivider() {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-border" />
      <div className="w-1 h-1 rounded-full bg-gold opacity-60" />
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
