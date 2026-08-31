import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../Dashboard.jsx';
import { Icon, Btn, Modal, Field, Input, Select, ListLoading } from '../../components/ui.jsx';
import { api_appointments, api_services, api_clients, api_closed_days, api_settings } from '../../lib/api';
import { closedInfoFor, DAY_NAMES_PLURAL_ES } from '../../lib/dates';
import ServicePicker from '../../components/ServicePicker.jsx';
import { fmtDuration } from '../../lib/duration';

// ── Constantes ────────────────────────────────────────────────────────
// Math limpio: 1 min = 1 px (day) / 0.8 px (week).
const HOUR_PX_DAY = 60;
const HOUR_PX_WEEK = 48;
const DEFAULT_START = 7;
const DEFAULT_END = 22;
const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Estados de cita con paleta visual consistente con StatusBadge.
const STATUS_INFO = {
  pending:   { label: 'Pendiente',  short: 'Pend.',  color: '#e0b265', dot: 'bg-gold',       pill: 'bg-gold/20 text-gold border-gold/40' },
  confirmed: { label: 'Confirmada', short: 'Conf.',  color: '#6db86d', dot: 'bg-green-500',  pill: 'bg-green-500/15 text-green-400 border-green-500/40' },
  completed: { label: 'Completada', short: 'Hecho', color: '#64a0d0', dot: 'bg-blue-400',   pill: 'bg-blue-500/15 text-blue-400 border-blue-500/40' },
  cancelled: { label: 'Cancelada',  short: 'Canc.',  color: '#e87b7b', dot: 'bg-red-500',    pill: 'bg-red-500/15 text-red-400 border-red-500/40' },
};

// ── Helpers de fechas ─────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d) => { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x; };
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const fmt12h = (h) => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`;

function computeHourRange(appts) {
  let start = DEFAULT_START, end = DEFAULT_END;
  for (const a of appts) {
    const [hh, mm] = (a.time || '0:0').split(':').map(Number);
    const endMin = hh * 60 + (mm || 0) + (Number(a.duration) || 60);
    if (hh < start) start = Math.max(0, hh);
    const endHr = Math.ceil(endMin / 60);
    if (endHr > end) end = Math.min(24, endHr);
  }
  return { start, end };
}

// ── Componente principal ──────────────────────────────────────────────
export default function Agenda() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get('focus');
  // En móvil arrancamos en Día porque Semana aplasta 7 columnas en <400px.
  const [view, setView] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768) ? 'day' : 'week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [appts, setAppts] = useState(null);
  const [editing, setEditing] = useState(null);
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);
  // Días que el salón NO abre (la clienta no puede reservar en ellos).
  const [closedDays, setClosedDays] = useState([]); // [{date, reason}]
  const [closingDay, setClosingDay] = useState(null); // fecha que se está cerrando
  // Regla fija de la semana (p.ej. sáb y dom cerrados) desde Personalización.
  const [closedWeekdays, setClosedWeekdays] = useState([0, 6]);

  const loadedRef = useRef({ from: '', to: '' });

  const visibleRange = useMemo(() => {
    if (view === 'day') return { from: toISO(anchor), to: toISO(anchor) };
    if (view === 'week') {
      const s = startOfWeek(anchor);
      return { from: toISO(s), to: toISO(addDays(s, 6)) };
    }
    const gridStart = startOfWeek(startOfMonth(anchor));
    return { from: toISO(gridStart), to: toISO(addDays(gridStart, 41)) };
  }, [view, anchor]);

  const loadWindow = async (from, to) => {
    const { data } = await api_appointments.list({ from, to });
    setAppts(data || []);
    loadedRef.current = { from, to };
  };

  // Días cerrados: solo de hoy en adelante (los pasados ya no importan).
  const loadClosed = async () => {
    const { data } = await api_closed_days.list({ from: toISO(new Date()) });
    setClosedDays(data || []);
  };

  const closedSet = useMemo(() => new Set(closedDays.map(c => c.date)), [closedDays]);
  const anchorISO = toISO(anchor);
  const anchorClosedOne = closedDays.find(c => c.date === anchorISO) || null;
  // Cerrado por regla de la semana (no se "reabre" desde aquí, se cambia en
  // Personalización → Días que abrimos).
  const anchorClosedByWeekday = !anchorClosedOne && closedWeekdays.includes(new Date(`${anchorISO}T00:00:00`).getDay());
  const anchorClosed = anchorClosedOne;

  // Cerrar pide el motivo en un modal (window.prompt está bloqueado en
  // varios navegadores móviles, justo donde más se usa esto). Reabrir es directo.
  const toggleClosed = async () => {
    if (anchorClosed) {
      await api_closed_days.open(anchorISO);
      loadClosed();
    } else {
      setClosingDay(anchorISO);
    }
  };

  useEffect(() => {
    const t = new Date();
    loadWindow(toISO(addDays(t, -90)), toISO(addDays(t, 180)));
    api_services.list().then(({ data }) => setServices(data || []));
    api_clients.list().then(({ data }) => setClients(data || []));
    loadClosed();
    api_settings.get().then(({ data }) => setClosedWeekdays(data?.closed_weekdays ?? [0, 6]));
    const ch = api_appointments.subscribe(() => {
      const { from, to } = loadedRef.current;
      if (from && to) loadWindow(from, to);
    });
    return () => { ch?.unsubscribe?.(); };
  }, []);

  useEffect(() => {
    const { from, to } = loadedRef.current;
    if (!from) return;
    if (visibleRange.from < from || visibleRange.to > to) {
      const center = new Date(visibleRange.from);
      loadWindow(toISO(addDays(center, -90)), toISO(addDays(center, 180)));
    }
  }, [visibleRange.from, visibleRange.to]);

  // Si llegamos con ?focus=<id> (típicamente desde una notificación),
  // saltar al día de esa cita, cambiar a vista día y abrir el modal.
  useEffect(() => {
    if (!focusId || !appts) return;
    const target = appts.find(a => a.id === focusId);
    if (!target) {
      // La cita no está en la ventana cargada — recargamos centrados en su fecha
      // Sin la fecha no podemos saltar; cargamos ventana amplia desde hoy.
      api_appointments.list({ from: toISO(addDays(new Date(), -180)), to: toISO(addDays(new Date(), 365)) })
        .then(({ data }) => {
          const t = (data || []).find(a => a.id === focusId);
          if (t) {
            setAppts(data || []);
            setAnchor(new Date(`${t.date}T00:00:00`));
            setView('day');
            setEditing({ ...t });
          }
          // Limpia el query param para que clicks subsiguientes no re-disparen
          setSearchParams({});
        });
      return;
    }
    setAnchor(new Date(`${target.date}T00:00:00`));
    setView('day');
    setEditing({ ...target });
    setSearchParams({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, appts]);

  const filtered = useMemo(() => {
    if (appts === null) return null;
    // Todos (admin y empleadas) ven todas las citas — el trabajo ya no se
    // asigna por empleada, así que no se filtra por trabajadora.
    return appts.filter(a => a.date >= visibleRange.from && a.date <= visibleRange.to);
  }, [appts, visibleRange.from, visibleRange.to]);

  // Conteo de pendientes en el rango visible (badge para llamar la atención).
  const pendingCount = useMemo(() => (filtered || []).filter(a => a.status === 'pending').length, [filtered]);

  const shift = (n) => {
    if (view === 'day') setAnchor(addDays(anchor, n));
    else if (view === 'week') setAnchor(addDays(anchor, n * 7));
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + n, 1));
  };
  const goToday = () => setAnchor(new Date());
  const isViewingToday = view === 'day'
    ? isSameDay(anchor, new Date())
    : view === 'week'
      ? (() => { const s = startOfWeek(anchor); return new Date() >= s && new Date() <= addDays(s, 6); })()
      : anchor.getFullYear() === new Date().getFullYear() && anchor.getMonth() === new Date().getMonth();

  const title = useMemo(() => {
    if (view === 'day') return anchor.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    if (view === 'week') {
      const s = startOfWeek(anchor); const e = addDays(s, 6);
      if (s.getMonth() === e.getMonth()) return `${s.getDate()}–${e.getDate()} ${s.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}`;
      return `${s.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return anchor.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  }, [view, anchor]);

  return (
    <div>
      <Header
        title="Agenda"
        subtitle={title}
        action={
          <Btn icon="plus" onClick={() => setEditing({ date: toISO(anchor) })}>Nueva</Btn>
        }
      />

      {/*
        Controles unificados: navegación + vista. En mobile son una sola fila
        densa (no wrap), con targets táctiles ≥40px. En desktop separamos
        navegación a la izquierda y switcher a la derecha.
      */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex rounded-lg border border-border-strong bg-bg-card overflow-hidden flex-shrink-0">
          <button onClick={() => shift(-1)} aria-label="Anterior"
            className="px-3 py-2 cursor-pointer hover:bg-bg-hover hover:text-gold transition-colors">
            <Icon name="chevronLeft" size={16} />
          </button>
          <button onClick={() => shift(1)} aria-label="Siguiente"
            className="px-3 py-2 cursor-pointer hover:bg-bg-hover hover:text-gold transition-colors border-l border-border">
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
        <button onClick={goToday} disabled={isViewingToday}
          className="px-3 py-2 rounded-lg border border-border-strong bg-bg-card text-xs font-semibold cursor-pointer disabled:opacity-40 hover:border-gold hover:text-gold transition-colors flex-shrink-0">
          Hoy
        </button>
        <button onClick={toggleClosed}
          title={anchorClosed ? 'Volver a abrir este día' : 'Marcar este día como cerrado'}
          className={`px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors flex-shrink-0 flex items-center gap-1.5 ${
            anchorClosed
              ? 'bg-red-500/15 text-red-400 border-red-500/40 hover:bg-red-500/25'
              : 'bg-bg-card border-border-strong text-text-secondary hover:border-gold hover:text-gold'
          }`}>
          <Icon name={anchorClosed ? 'check' : 'close'} size={13} color="currentColor" />
          <span className="hidden sm:inline">{anchorClosed ? 'Reabrir día' : 'Cerrar día'}</span>
        </button>
        <div className="flex-1 min-w-0" />
        <ViewSwitcher view={view} onChange={setView} />
      </div>

      {/* Cerrado por la regla fija de la semana. */}
      {anchorClosedByWeekday && (
        <div className="mb-3 text-xs bg-bg-elevated border border-border rounded-lg px-3 py-2 flex items-center gap-2 flex-wrap">
          <span className="text-text-secondary font-semibold">Cerrado los {DAY_NAMES_PLURAL_ES[new Date(`${anchorISO}T00:00:00`).getDay()]}</span>
          <span className="text-text-muted">
            Las clientas no pueden reservar. Se cambia en Personalización → Días que abrimos.
          </span>
        </div>
      )}

      {/* El día que se está viendo está cerrado al público. */}
      {anchorClosed && (
        <div className="mb-3 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 flex items-center gap-2 flex-wrap">
          <span className="text-red-400 font-semibold">Día cerrado</span>
          <span className="text-text-secondary">
            {anchorClosed.reason || 'No se atiende este día'} — las clientas no pueden reservar.
          </span>
        </div>
      )}

      {/* Próximos días cerrados, para no perderles la pista. */}
      {closedDays.length > 0 && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-text-muted uppercase tracking-wider font-semibold">Días cerrados:</span>
          {closedDays.slice(0, 8).map(c => (
            <button key={c.date} type="button"
              onClick={() => { setAnchor(new Date(`${c.date}T00:00:00`)); setView('day'); }}
              title={c.reason || 'Cerrado'}
              className="text-[11px] px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 cursor-pointer hover:bg-red-500/20 whitespace-nowrap">
              {new Date(`${c.date}T00:00:00`).toLocaleDateString('es-CU', { day: 'numeric', month: 'short' })}
            </button>
          ))}
          {closedDays.length > 8 && <span className="text-[11px] text-text-muted">+{closedDays.length - 8}</span>}
        </div>
      )}

      {/* Aviso de citas pendientes por confirmar. */}
      {pendingCount > 0 && (
        <div className="mb-3">
          <span className="inline-block text-[11px] px-2.5 py-1.5 rounded-full bg-gold/15 text-gold border border-gold/40 font-semibold">
            {pendingCount} pendiente{pendingCount === 1 ? '' : 's'} por confirmar
          </span>
        </div>
      )}

      {filtered === null ? (
        <ListLoading label="Cargando agenda…" />
      ) : view === 'day' ? (
        <DayView anchor={anchor} appointments={filtered} onClickAppt={(a) => setEditing({ ...a })} />
      ) : view === 'week' ? (
        <WeekView anchor={anchor} appointments={filtered} onClickAppt={(a) => setEditing({ ...a })} onPickDay={(d) => { setAnchor(d); setView('day'); }} />
      ) : (
        <MonthView anchor={anchor} appointments={filtered} onPickDay={(d) => { setAnchor(d); setView('day'); }} />
      )}

      {closingDay && (
        <Modal open={true} onClose={() => setClosingDay(null)} title="Cerrar este día">
          <CloseDayForm
            date={closingDay}
            onDone={() => { setClosingDay(null); loadClosed(); }}
          />
        </Modal>
      )}

      {editing && (
        <Modal open={true} onClose={() => setEditing(null)} title={editing.id ? 'Editar cita' : 'Nueva Cita'}>
          <ApptForm
            initial={editing}
            services={services}
            clients={clients}
            defaultDate={editing.date || toISO(anchor)}
            onSaved={() => { setEditing(null); }}
            onDelete={editing.id ? async () => { await api_appointments.remove(editing.id); setEditing(null); } : null}
          />
        </Modal>
      )}
    </div>
  );
}

// Marca un día como cerrado. El motivo es opcional y lo ve la clienta
// cuando intenta reservar ese día.
function CloseDayForm({ date, onDone }) {
  const PRESETS = ['No trabajamos ese día', 'Día feriado', 'Vacaciones', 'Agenda llena'];
  const [reason, setReason] = useState(PRESETS[0]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setErr('');
    setSaving(true);
    try {
      const res = await api_closed_days.close(date, reason.trim() || null);
      if (res.error) throw res.error;
      onDone();
    } catch (e) {
      setErr(e.message || 'No se pudo cerrar el día');
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-text-secondary mb-4">
        El{' '}
        <span className="text-gold font-semibold">
          {new Date(`${date}T00:00:00`).toLocaleDateString('es-CU', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>{' '}
        no se atenderá. Las clientas no podrán reservar ese día.
      </p>

      <Field label="Motivo (lo verá la clienta)">
        <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ej: No trabajamos ese día" />
      </Field>

      <div className="flex gap-1.5 flex-wrap -mt-1 mb-4">
        {PRESETS.map(p => (
          <button key={p} type="button" onClick={() => setReason(p)}
            className={`text-[11px] px-2.5 py-1 rounded-full border cursor-pointer transition ${
              reason === p
                ? 'bg-gold-dim border-gold/50 text-gold'
                : 'bg-bg-elevated border-border text-text-muted hover:border-gold/50 hover:text-gold'
            }`}>
            {p}
          </button>
        ))}
      </div>

      {err && (
        <div role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
          {err}
        </div>
      )}

      <Btn icon="check" onClick={save} loading={saving}>
        {saving ? 'Cerrando…' : 'Cerrar este día'}
      </Btn>
    </div>
  );
}

function ViewSwitcher({ view, onChange }) {
  const items = [['day', 'Día'], ['week', 'Sem.'], ['month', 'Mes']];
  return (
    <div role="tablist" className="flex rounded-lg border border-border-strong bg-bg-card p-0.5 flex-shrink-0">
      {items.map(([id, label]) => (
        <button
          key={id}
          role="tab"
          aria-selected={view === id}
          onClick={() => onChange(id)}
          className={`px-3 py-1.5 text-xs font-semibold cursor-pointer transition rounded-md ${
            view === id ? 'bg-gold text-[#0d0c0a]' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Posicionamiento + solapamientos ───────────────────────────────────
function layoutAppointments(appts, hourPx, startHour) {
  const items = appts
    .map(a => {
      const [hh, mm] = (a.time || '0:0').split(':').map(Number);
      const startMin = (hh || 0) * 60 + (mm || 0);
      const dur = Number(a.duration) || 60;
      return {
        a, startMin, endMin: startMin + dur,
        top: (startMin - startHour * 60) * hourPx / 60,
        height: Math.max(28, dur * hourPx / 60 - 2),
      };
    })
    .sort((x, y) => x.startMin - y.startMin || x.endMin - y.endMin);

  const groups = [];
  for (const it of items) {
    let placed = false;
    for (const g of groups) {
      if (g.some(o => o.endMin > it.startMin && o.startMin < it.endMin)) { g.push(it); placed = true; break; }
    }
    if (!placed) groups.push([it]);
  }
  const result = [];
  for (const g of groups) {
    const cols = [];
    for (const it of g) {
      let col = cols.findIndex(c => c[c.length - 1].endMin <= it.startMin);
      if (col === -1) { cols.push([it]); col = cols.length - 1; }
      else cols[col].push(it);
      it._col = col;
    }
    const total = cols.length;
    for (const it of g) {
      result.push({ a: it.a, top: it.top, height: it.height, leftPct: (it._col / total) * 100, widthPct: (1 / total) * 100 });
    }
  }
  return result;
}

// ── PRIMITIVES de tiempo ──────────────────────────────────────────────
// Columna de horas: cada label se ancla al inicio del slot de su hora.
// El primer label se posiciona ligeramente debajo del borde superior para
// que no quede cortado por el contenedor.
function TimeGutter({ hours, hourPx }) {
  return (
    <div className="w-11 sm:w-16 flex-shrink-0 sticky left-0 z-10 relative bg-bg-elevated/95 backdrop-blur border-r border-border" style={{ height: hours.length * hourPx }}>
      {hours.map((h, i) => {
        const isFirst = i === 0;
        return (
          <div
            key={h}
            style={{ top: isFirst ? 6 : i * hourPx }}
            className={`absolute right-1.5 left-0 text-[10px] font-medium text-text-muted text-right pr-1.5 sm:pr-2 leading-none select-none ${isFirst ? '' : '-translate-y-1/2'}`}
          >
            <span className="bg-bg-card px-1 whitespace-nowrap">{fmt12h(h)}</span>
          </div>
        );
      })}
    </div>
  );
}

// Líneas horizontales separando cada hora. Limpio, sin dashed half-hour.
function HourLines({ hours, hourPx }) {
  return (
    <>
      {hours.map((h, i) => (
        i === 0 ? null : (
          <div
            key={h}
            style={{ top: i * hourPx }}
            className="absolute inset-x-0 h-px bg-border pointer-events-none"
          />
        )
      ))}
    </>
  );
}

// Línea roja indicando la hora actual.
function NowLine({ top }) {
  return (
    <div style={{ top }} className="absolute inset-x-0 z-20 pointer-events-none">
      <div className="absolute -left-1.5 -top-[5px] w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)] ring-2 ring-bg-card" />
      <div className="h-[2px] bg-red-500/90 -mt-px" />
    </div>
  );
}

// Bloque de evento.
function EventBlock({ a, top, height, left, width, onClick, expanded }) {
  const color = a.staff?.color || 'var(--gold)';
  const clientName = a.clients?.name || (a.notes?.match(/Cliente web: ([^·]+)/) || [])[1]?.trim() || 'Cliente';
  const isShort = height < 40;
  const isMedium = height >= 40 && height < 60;
  const st = STATUS_INFO[a.status] || STATUS_INFO.pending;
  const isCancelled = a.status === 'cancelled';
  const isCompleted = a.status === 'completed';
  return (
    <button
      onClick={onClick}
      aria-label={`${clientName} — ${st.label}`}
      style={{
        top, height, left, width,
        background: `linear-gradient(135deg, ${color}33 0%, ${color}1a 100%)`,
        borderLeftColor: color,
        boxShadow: `0 1px 3px ${color}26`,
      }}
      className={`absolute border border-border/60 border-l-[3px] rounded-lg px-2 py-1 text-left overflow-hidden cursor-pointer hover:brightness-125 hover:-translate-y-px motion-reduce:transform-none transition-all z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${isCancelled ? 'opacity-55' : ''}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={`font-semibold truncate ${isShort ? 'text-[10px]' : 'text-xs'} ${isCancelled ? 'line-through decoration-1' : ''}`}>
          {clientName}
        </span>
        {isShort ? (
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot} ${a.status === 'pending' ? 'animate-pulse motion-reduce:animate-none' : ''}`}
            aria-hidden="true"
          />
        ) : (
          <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap ${st.pill} flex-shrink-0`}>
            {st.short}
          </span>
        )}
      </div>
      {!isShort && (
        <div className={`text-[10px] truncate mt-0.5 ${isCancelled ? 'text-text-muted' : 'text-text-secondary'}`}>
          {a.time?.slice(0, 5)} · {a.services?.name || 'Servicio'}
          {a.service_ids?.length > 1 && <span className="text-gold font-semibold"> +{a.service_ids.length - 1}</span>}
          {isCompleted && <span className="ml-1">✓</span>}
        </div>
      )}
      {expanded && !isMedium && height > 70 && a.staff?.name && (
        <div className="text-[10px] font-semibold mt-1 truncate" style={{ color }}>{a.staff.name}</div>
      )}
    </button>
  );
}

// ── DAY VIEW ──────────────────────────────────────────────────────────
function DayView({ anchor, appointments, onClickAppt }) {
  const todays = appointments.filter(a => a.date === toISO(anchor));
  const { start: startHour, end: endHour } = useMemo(() => computeHourRange(todays), [todays]);
  const hours = useMemo(() => Array.from({ length: endHour - startHour }, (_, i) => startHour + i), [startHour, endHour]);
  const totalHeight = (endHour - startHour) * HOUR_PX_DAY;
  const blocks = useMemo(() => layoutAppointments(todays, HOUR_PX_DAY, startHour), [todays, startHour]);
  const isToday = isSameDay(anchor, new Date());

  const containerRef = useRef(null);
  useEffect(() => {
    if (!containerRef.current) return;
    let target = 0;
    if (todays.length > 0) {
      const minTop = Math.min(...blocks.map(b => b.top));
      target = Math.max(0, minTop - 60);
    } else if (isToday) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      target = Math.max(0, (nowMin - startHour * 60) * HOUR_PX_DAY / 60 - 120);
    }
    containerRef.current.scrollTop = target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toISO(anchor), todays.length]);

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMin - startHour * 60) * HOUR_PX_DAY / 60;
  const nowVisible = isToday && nowTop >= 0 && nowTop <= totalHeight;

  return (
    <div className="bg-bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div ref={containerRef} className="flex max-h-[calc(100vh-260px)] min-h-[500px] overflow-y-auto">
        <TimeGutter hours={hours} hourPx={HOUR_PX_DAY} />
        <div className="relative flex-1 min-w-0" style={{ height: totalHeight }}>
          <HourLines hours={hours} hourPx={HOUR_PX_DAY} />
          {nowVisible && <NowLine top={nowTop} />}
          {blocks.map(({ a, top, height, leftPct, widthPct }) => (
            <EventBlock key={a.id} a={a} top={top} height={height}
              left={`calc(${leftPct}% + 8px)`}
              width={`calc(${widthPct}% - 16px)`}
              onClick={() => onClickAppt(a)}
              expanded />
          ))}
          {todays.length === 0 && (
            <div className="absolute inset-0 grid place-items-center text-text-muted pointer-events-none">
              <div className="text-center">
                <Icon name="calendar" size={32} color="var(--text-muted)" />
                <div className="text-sm mt-2">Sin citas este día</div>
                <div className="text-xs text-text-muted/70 mt-1">Toca "+ Nueva" para agregar una</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── WEEK VIEW ─────────────────────────────────────────────────────────
function WeekView({ anchor, appointments, onClickAppt, onPickDay }) {
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = new Date();

  const { start: startHour, end: endHour } = useMemo(() => computeHourRange(appointments), [appointments]);
  const hours = useMemo(() => Array.from({ length: endHour - startHour }, (_, i) => startHour + i), [startHour, endHour]);
  const totalHeight = (endHour - startHour) * HOUR_PX_WEEK;

  const byDay = useMemo(() => {
    const m = new Map();
    for (const d of days) m.set(toISO(d), []);
    for (const a of appointments) if (m.has(a.date)) m.get(a.date).push(a);
    return m;
  }, [days, appointments]);

  const containerRef = useRef(null);
  useEffect(() => {
    if (!containerRef.current) return;
    let target = 0;
    if (appointments.length > 0) {
      const earliest = appointments.reduce((min, a) => {
        const [hh, mm] = (a.time || '9:0').split(':').map(Number);
        return Math.min(min, hh * 60 + (mm || 0));
      }, 24 * 60);
      target = Math.max(0, (earliest - startHour * 60) * HOUR_PX_WEEK / 60 - 40);
    } else {
      const nowMin = today.getHours() * 60 + today.getMinutes();
      target = Math.max(0, (nowMin - startHour * 60) * HOUR_PX_WEEK / 60 - 120);
    }
    containerRef.current.scrollTop = target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toISO(weekStart), appointments.length]);

  const nowMin = today.getHours() * 60 + today.getMinutes();
  const nowTop = (nowMin - startHour * 60) * HOUR_PX_WEEK / 60;

  return (
    <div className="bg-bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div ref={containerRef} className="max-h-[calc(100vh-320px)] min-h-[460px] overflow-auto">
        <div className="flex flex-col" style={{ minWidth: 660 }}>
          {/* Header de días (sticky top) */}
          <div className="sticky top-0 z-20 flex border-b border-border bg-bg-elevated/95 backdrop-blur">
            <div className="w-11 sm:w-16 flex-shrink-0 sticky left-0 z-30 bg-bg-elevated border-r border-border" />
            {days.map((d, i) => {
              const isToday_ = isSameDay(d, today);
              return (
                <button key={i} onClick={() => onPickDay(d)}
                  className={`min-w-[88px] flex-1 py-2 sm:py-3 cursor-pointer transition border-r border-border last:border-0 group ${
                    isToday_ ? 'bg-gold-dim' : 'hover:bg-bg-hover'
                  }`}>
                  <div className={`text-[10px] uppercase tracking-widest font-semibold text-center ${isToday_ ? 'text-gold' : 'text-text-muted group-hover:text-text-secondary'}`}>
                    {DAY_LABELS[i]}
                  </div>
                  <div className="mt-1 sm:mt-1.5 grid place-items-center">
                    <div className={`w-7 h-7 sm:w-9 sm:h-9 grid place-items-center rounded-full text-[13px] sm:text-sm font-bold transition ${
                      isToday_
                        ? 'bg-gold text-[#0d0c0a] shadow-md shadow-gold/30'
                        : 'text-text-primary group-hover:bg-bg-hover'
                    }`}>
                      {d.getDate()}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div className="flex">
            <TimeGutter hours={hours} hourPx={HOUR_PX_WEEK} />
            <div className="flex flex-1 relative" style={{ height: totalHeight }}>
              {days.map((d, i) => {
                const dayAppts = byDay.get(toISO(d)) || [];
                const blocks = layoutAppointments(dayAppts, HOUR_PX_WEEK, startHour);
                const isToday_ = isSameDay(d, today);
                return (
                  <div key={i} className={`relative min-w-[88px] flex-1 border-r border-border last:border-0 ${isToday_ ? 'bg-gold-dim/15' : ''}`}>
                    <HourLines hours={hours} hourPx={HOUR_PX_WEEK} />
                    {isToday_ && nowTop >= 0 && nowTop <= totalHeight && <NowLine top={nowTop} />}
                    {blocks.map(({ a, top, height, leftPct, widthPct }) => (
                      <EventBlock key={a.id} a={a} top={top} height={height}
                        left={`calc(${leftPct}% + 3px)`}
                        width={`calc(${widthPct}% - 6px)`}
                        onClick={() => onClickAppt(a)} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MONTH VIEW ────────────────────────────────────────────────────────
function MonthView({ anchor, appointments, onPickDay }) {
  const gridStart = useMemo(() => startOfWeek(startOfMonth(anchor)), [anchor]);
  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const today = new Date();
  const currentMonth = anchor.getMonth();

  const byDay = useMemo(() => {
    const m = new Map();
    for (const c of cells) m.set(toISO(c), []);
    for (const a of appointments) if (m.has(a.date)) m.get(a.date).push(a);
    for (const arr of m.values()) arr.sort((x, y) => (x.time || '').localeCompare(y.time || ''));
    return m;
  }, [cells, appointments]);

  return (
    <div className="bg-bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
     <div className="overflow-auto max-h-[calc(100vh-260px)]">
      <div style={{ minWidth: 660 }}>
      <div className="sticky top-0 z-20 grid grid-cols-7 border-b border-border bg-bg-elevated/95 backdrop-blur">
        {DAY_LABELS.map((l, i) => (
          <div key={i} className="py-2.5 text-center text-[10px] uppercase tracking-widest font-semibold text-text-muted border-r border-border last:border-0">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 auto-rows-fr" style={{ minHeight: 'calc(100vh - 280px)' }}>
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === currentMonth;
          const isToday_ = isSameDay(d, today);
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const dayAppts = byDay.get(toISO(d)) || [];
          const visible = dayAppts.slice(0, 3);
          const extra = dayAppts.length - visible.length;
          return (
            <button key={i} onClick={() => onPickDay(d)}
              className={`text-left p-2 border-r border-b border-border last:border-r-0 cursor-pointer transition overflow-hidden group ${
                inMonth ? (isWeekend ? 'bg-bg-card/50' : 'bg-bg-card') : 'bg-bg-elevated/20 text-text-muted'
              } hover:bg-bg-hover/60 focus-visible:outline-none focus-visible:bg-bg-hover`}>
              <div className="flex justify-between items-start mb-1.5">
                <span className={`text-xs grid place-items-center min-w-7 h-7 px-1.5 rounded-full font-bold ${
                  isToday_ ? 'bg-gold text-[#0d0c0a] shadow-md shadow-gold/30' : (inMonth ? 'text-text-primary' : 'text-text-muted')
                }`}>{d.getDate()}</span>
                {dayAppts.length > 0 && (
                  <span className="text-[9px] text-text-muted font-bold bg-bg-elevated rounded-full px-1.5 py-0.5">
                    {dayAppts.length}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {visible.map(a => {
                  const color = a.staff?.color || 'var(--gold)';
                  const name = a.clients?.name || (a.notes?.match(/Cliente web: ([^·]+)/) || [])[1]?.trim() || 'Cliente';
                  const st = STATUS_INFO[a.status] || STATUS_INFO.pending;
                  const isCancelled = a.status === 'cancelled';
                  return (
                    <div key={a.id} style={{ background: `${color}1f`, borderLeftColor: color }}
                      className={`text-[10px] rounded px-1.5 py-0.5 border-l-2 flex items-center gap-1 ${isCancelled ? 'opacity-55' : ''}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} aria-hidden="true" />
                      <span className={`font-semibold text-text-primary ${isCancelled ? 'line-through decoration-1' : ''}`}>{a.time?.slice(0, 5)}</span>
                      <span className={`truncate ${isCancelled ? 'text-text-muted line-through decoration-1' : 'text-text-secondary'}`}> · {name}</span>
                    </div>
                  );
                })}
                {extra > 0 && <div className="text-[10px] text-gold font-semibold px-1.5 mt-0.5">+{extra} más</div>}
              </div>
            </button>
          );
        })}
      </div>
      </div>
     </div>
    </div>
  );
}

// Abre WhatsApp al teléfono de la clienta con un mensaje pre-armado de
// confirmación o rechazo. Si no hay teléfono o WhatsApp no aplica, retorna
// false para que el caller pueda mostrar un toast.
function openWhatsAppConfirmation(appt, kind) {
  const phone = (appt?.clients?.phone || '').replace(/\D/g, '');
  if (!phone) return false;
  const clientName = appt.clients?.name || 'cliente';
  const svcName = appt.services?.name || 'tu servicio';
  const dateLabel = appt.date
    ? new Date(appt.date + 'T00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
    : '';
  const timeLabel = (appt.time || '').slice(0, 5);
  const messages = {
    confirmed:
      `Hola ${clientName}! Tu cita para *${svcName}* el ${dateLabel} a las ${timeLabel} fue *confirmada*. Te esperamos en MJ Beauty.`,
    cancelled:
      `Hola ${clientName}, lamentamos informarte que tu cita para *${svcName}* el ${dateLabel} a las ${timeLabel} no pudo ser confirmada. ¿Quisieras agendar en otro horario? 💛`,
  };
  const msg = encodeURIComponent(messages[kind] || '');
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank', 'noopener');
  return true;
}

// ── Form de cita ──────────────────────────────────────────────────────
function ApptForm({ initial, services, clients, defaultDate, onSaved, onDelete }) {
  const [f, setF] = useState({
    client_id: '', service_id: '',
    date: defaultDate, time: '10:00', notes: '', status: 'confirmed',
    ...initial,
  });
  // Multi-servicio: una cita puede tener varios servicios (ej: pestañas + uñas).
  const [serviceIds, setServiceIds] = useState(
    initial?.service_ids?.length ? initial.service_ids
      : (initial?.service_id ? [initial.service_id] : [])
  );
  const totalDuration = serviceIds.reduce((sum, id) => {
    const s = services.find(x => x.id === id);
    return sum + (Number(s?.duration) || 0);
  }, 0);
  const [saving, setSaving] = useState(false);
  const [deciding, setDeciding] = useState(false); // accept/reject inflight
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const isPending = initial?.id && initial.status === 'pending';
  const hasPhone = !!initial?.clients?.phone;

  const decide = async (kind) => {
    setErr(''); setInfo('');
    setDeciding(true);
    try {
      const newStatus = kind === 'accept' ? 'confirmed' : 'cancelled';
      const res = await api_appointments.update(initial.id, { status: newStatus });
      if (res.error) throw res.error;
      // Abrir WhatsApp al número de la clienta (si tiene)
      const opened = openWhatsAppConfirmation(initial, newStatus);
      if (!opened) setInfo('Cliente sin teléfono — no se abrió WhatsApp.');
      onSaved();
    } catch (e) {
      setErr(e.message || 'No se pudo actualizar la cita');
    } finally {
      setDeciding(false);
    }
  };

  const submit = async () => {
    setErr('');
    setSaving(true);
    try {
      const payload = {
        client_id: f.client_id || null,
        service_id: serviceIds[0] || null,       // principal (compat)
        service_ids: serviceIds,                  // todos los servicios
        staff_id: null,                           // el trabajo ya no se asigna por empleada
        date: f.date,
        time: f.time,
        duration: totalDuration || f.duration || 60,
        status: f.status,
        notes: f.notes || null,
      };
      const res = f.id ? await api_appointments.update(f.id, payload) : await api_appointments.create(payload);
      if (res.error) throw res.error;
      onSaved();
    } catch (e) {
      setErr(e.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  };

  return (
    <div>
      {isPending && (
        <div className="mb-4 bg-gold-dim border border-gold/40 rounded-2xl p-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-2 h-2 rounded-full bg-gold animate-pulse motion-reduce:animate-none" />
            <div className="text-xs font-semibold text-gold uppercase tracking-wider">Pendiente de aprobación</div>
          </div>
          <div className="text-[11px] text-text-secondary mb-3">
            {hasPhone
              ? 'Al aceptar o rechazar se abrirá WhatsApp para enviar la confirmación a la clienta.'
              : 'Esta cita no tiene teléfono de cliente — el cambio se aplica sin abrir WhatsApp.'}
          </div>
          <div className="flex gap-2">
            <Btn icon="check" onClick={() => decide('accept')} loading={deciding} disabled={deciding}>
              Aceptar
            </Btn>
            <Btn variant="ghost" icon="close" onClick={() => decide('reject')} loading={deciding} disabled={deciding}>
              Rechazar
            </Btn>
          </div>
          {info && (
            <div className="mt-2 text-[11px] text-text-muted">{info}</div>
          )}
        </div>
      )}

      <Field label="Cliente">
        <Select value={f.client_id || ''} onChange={e => setF({ ...f, client_id: e.target.value })}
          options={[{ value: '', label: 'Selecciona' }, ...clients.map(c => ({ value: c.id, label: c.name }))]} />
      </Field>
      <Field label="Servicios (uno o varios)">
        <ServicePicker
          services={services}
          selectedIds={serviceIds}
          onToggle={(id) => setServiceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
          maxHeight="max-h-48"
        />
        {serviceIds.length > 0 && (
          <div className="text-[11px] text-text-muted mt-1.5">
            {serviceIds.length} servicio{serviceIds.length > 1 ? 's' : ''} · {fmtDuration(totalDuration)} en total
          </div>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha"><Input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Hora"><Input type="time" value={f.time} onChange={e => setF({ ...f, time: e.target.value })} /></Field>
      </div>
      <Field label="Estado">
        <Select value={f.status} onChange={e => setF({ ...f, status: e.target.value })}
          options={[
            { value: 'pending', label: 'Pendiente' },
            { value: 'confirmed', label: 'Confirmada' },
            { value: 'completed', label: 'Completada' },
            { value: 'cancelled', label: 'Cancelada' },
          ]} />
      </Field>

      {err && (
        <div role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
          {err}
        </div>
      )}

      <div className="flex gap-2.5 pt-3 border-t border-border">
        {onDelete && (
          <Btn variant="ghost" onClick={handleDelete} loading={deleting} disabled={saving}>
            {deleting ? 'Eliminando…' : (confirmDel ? '¿Confirmar?' : 'Eliminar')}
          </Btn>
        )}
        <Btn icon="check" onClick={submit} loading={saving} disabled={!serviceIds.length || deleting}>
          {saving ? 'Guardando…' : (f.id ? 'Guardar cambios' : 'Guardar Cita')}
        </Btn>
      </div>
    </div>
  );
}
