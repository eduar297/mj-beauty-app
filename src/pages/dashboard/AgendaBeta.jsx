// Vista beta de la Agenda usando Schedule-X (@schedule-x/react v4).
// Convive con la Agenda original — sirve para comparar UX antes de decidir
// si reemplazamos la implementación custom.
import 'temporal-polyfill/global';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScheduleXCalendar, useNextCalendarApp } from '@schedule-x/react';
import {
  createViewDay,
  createViewWeek,
  createViewMonthGrid,
  createViewMonthAgenda,
} from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import { createCurrentTimePlugin } from '@schedule-x/current-time';
import '@schedule-x/theme-default/dist/index.css';

import { Header } from '../Dashboard.jsx';
import { Btn, Modal, ListLoading } from '../../components/ui.jsx';
import { api_appointments, api_services, api_staff, api_clients } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth.jsx';
import { ApptForm } from './Agenda.jsx';

const TZ = 'America/Bogota';
const FALLBACK_COLOR = '#e0b265';

// Mismos colores y labels que la Agenda original — coherencia visual.
const STATUS_INFO = {
  pending:   { short: 'Pend.', pill: 'bg-gold/20 text-gold border-gold/40' },
  confirmed: { short: 'Conf.', pill: 'bg-green-500/15 text-green-400 border-green-500/40' },
  completed: { short: 'Hecho', pill: 'bg-blue-500/15 text-blue-400 border-blue-500/40' },
  cancelled: { short: 'Canc.', pill: 'bg-red-500/15 text-red-400 border-red-500/40' },
};

// ── Helpers ───────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const addDaysISO = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function zonedFrom(dateISO, timeStr) {
  const [hh = 0, mm = 0] = (timeStr || '0:0').split(':').map(Number);
  const [y, mo, d] = dateISO.split('-').map(Number);
  return Temporal.ZonedDateTime.from({
    year: y, month: mo, day: d,
    hour: hh, minute: mm, second: 0,
    timeZone: TZ,
  });
}

const clientNameFor = (a) =>
  a.clients?.name ||
  (a.notes?.match(/Cliente web: ([^·]+)/) || [])[1]?.trim() ||
  'Cliente';

// Mapea cita → evento de Schedule-X. Empacamos `_raw` para que el custom
// component reciba la cita completa sin tener que mantener un lookup paralelo.
function apptToEvent(a) {
  const duration = Number(a.duration) || 60;
  const start = zonedFrom(a.date, a.time || '10:00');
  const end = start.add({ minutes: duration });
  return {
    id: a.id,
    title: clientNameFor(a),
    start,
    end,
    calendarId: a.staff_id || '_default',
    _options: {
      additionalClasses: [
        `sx-status-${a.status || 'pending'}`,
        a.status === 'cancelled' ? 'sx-cancelled' : '',
      ].filter(Boolean),
    },
    _raw: a,
  };
}

function buildCalendars(staff) {
  // `main` se usa para borde/acento; `container` para fondo. Subimos el
  // contenedor a alpha ~40 para que el color de la empleada sea evidente
  // sin saturar texto.
  const mk = (color) => ({
    colorName: color,
    lightColors: { main: color, container: `${color}66`, onContainer: '#0d0c0a' },
    darkColors:  { main: color, container: `${color}40`, onContainer: '#ffffff' },
  });
  const out = { _default: { ...mk(FALLBACK_COLOR), colorName: '_default' } };
  for (const s of staff) {
    out[s.id] = { ...mk(s.color || FALLBACK_COLOR), colorName: s.id };
  }
  return out;
}

// ── Componente principal ──────────────────────────────────────────────
export default function AgendaBeta() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [appts, setAppts] = useState(null);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [clients, setClients] = useState([]);
  const [staffFilter, setStaffFilter] = useState('');
  const [editing, setEditing] = useState(null);

  const loadedRef = useRef({ from: '', to: '' });

  const loadWindow = async (from, to) => {
    const { data } = await api_appointments.list({ from, to });
    setAppts(data || []);
    loadedRef.current = { from, to };
  };

  useEffect(() => {
    const center = todayISO();
    loadWindow(addDaysISO(center, -90), addDaysISO(center, 180));
    api_services.list().then(({ data }) => setServices(data || []));
    api_staff.list().then(({ data }) => setStaff(data || []));
    api_clients.list().then(({ data }) => setClients(data || []));
    const ch = api_appointments.subscribe(() => {
      const { from, to } = loadedRef.current;
      if (from && to) loadWindow(from, to);
    });
    return () => { ch?.unsubscribe?.(); };
  }, []);

  const filtered = useMemo(() => {
    if (appts === null) return null;
    return appts.filter(a => {
      if (user?.role === 'empleada' && a.staff_id !== user.id) return false;
      if (isAdmin && staffFilter && a.staff_id !== staffFilter) return false;
      return true;
    });
  }, [appts, user, isAdmin, staffFilter]);

  const pendingCount = useMemo(
    () => (filtered || []).filter(a => a.status === 'pending').length,
    [filtered]
  );

  const showCalendar = appts !== null;

  return (
    <div>
      <Header
        title="Agenda · Beta"
        action={
          <Btn icon="plus" onClick={() => setEditing({ date: todayISO() })}>Nueva</Btn>
        }
      />

      {/* Filtro empleada (solo admin) + badge pendientes */}
      {isAdmin && staff.length > 0 && (
        <div className="-mx-4 sm:mx-0 mb-3">
          <div className="flex items-center gap-2 overflow-x-auto sm:overflow-visible sm:flex-wrap px-4 sm:px-0 pb-1 sm:pb-0
                          [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="hidden sm:inline text-[11px] text-text-muted uppercase tracking-widest flex-shrink-0">Empleada:</span>
            <button onClick={() => setStaffFilter('')}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border cursor-pointer transition whitespace-nowrap ${
                staffFilter === '' ? 'bg-gold text-[#0d0c0a] border-gold font-semibold' : 'bg-bg-card border-border text-text-muted hover:text-text-secondary hover:border-border-strong'
              }`}>
              Todas
            </button>
            {staff.map(s => (
              <button key={s.id} onClick={() => setStaffFilter(s.id)}
                style={staffFilter === s.id ? { background: s.color, borderColor: s.color, color: '#0d0c0a' } : {}}
                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border cursor-pointer transition flex items-center gap-1.5 whitespace-nowrap ${
                  staffFilter === s.id ? 'font-semibold' : 'bg-bg-card border-border text-text-muted hover:text-text-secondary hover:border-border-strong'
                }`}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: staffFilter === s.id ? '#0d0c0a' : s.color }} />
                {s.name}
              </button>
            ))}
            {pendingCount > 0 && (
              <span className="flex-shrink-0 sm:ml-auto text-[11px] px-2.5 py-1.5 rounded-full bg-gold/15 text-gold border border-gold/40 whitespace-nowrap font-semibold">
                {pendingCount} pendiente{pendingCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>
      )}

      {!showCalendar ? (
        <ListLoading label="Cargando agenda…" />
      ) : (
        <div className="bg-bg-card border border-border rounded-2xl overflow-hidden shadow-sm sx-mj">
          {/* key fuerza re-creación del calendar si cambia la lista de
              empleadas (los colores se inicializan una vez en createCalendar). */}
          <CalendarInner
            key={`sx-${staff.map(s => s.id).join('|')}`}
            appointments={filtered || []}
            staff={staff}
            onPickAppt={(appt) => setEditing({ ...appt })}
            onPickEmpty={(dateISO) => setEditing({ date: dateISO })}
          />
        </div>
      )}

      {editing && (
        <Modal open={true} onClose={() => setEditing(null)} title={editing.id ? 'Editar cita' : 'Nueva Cita'}>
          <ApptForm
            initial={editing}
            services={services}
            staff={staff}
            clients={clients}
            defaultDate={editing.date || todayISO()}
            onSaved={() => setEditing(null)}
            onDelete={editing.id ? async () => { await api_appointments.remove(editing.id); setEditing(null); } : null}
          />
        </Modal>
      )}
    </div>
  );
}

// ── Inner: solo se monta cuando ya tenemos staff/citas para evitar
//          reinicializaciones del calendar (useNextCalendarApp solo crea
//          la instancia una vez en mount). ─────────────────────────────
function CalendarInner({ appointments, staff, onPickAppt, onPickEmpty }) {
  const apptById = useMemo(() => {
    const m = new Map();
    for (const a of appointments) m.set(a.id, a);
    return m;
  }, [appointments]);
  const apptByIdRef = useRef(apptById);
  apptByIdRef.current = apptById;

  const [eventsService] = useState(() => createEventsServicePlugin());
  const [currentTimePlugin] = useState(() => createCurrentTimePlugin({
    fullWeekWidth: true,
  }));

  const calendars = useMemo(() => buildCalendars(staff), [staff]);
  const initialEvents = useMemo(() => appointments.map(apptToEvent), []); // primera vez

  const calendar = useNextCalendarApp(
    {
      views: [
        createViewDay(),
        createViewWeek(),
        createViewMonthGrid(),
        createViewMonthAgenda(),
      ],
      defaultView: typeof window !== 'undefined' && window.innerWidth < 768
        ? createViewDay().name
        : createViewWeek().name,
      locale: 'es-ES',
      firstDayOfWeek: 1, // lunes
      isDark: true,
      timezone: TZ,
      dayBoundaries: { start: '07:00', end: '22:00' },
      weekOptions: { gridHeight: 700, nDays: 7 },
      calendars,
      events: initialEvents,
      callbacks: {
        onEventClick(event) {
          const appt = apptByIdRef.current.get(event.id);
          if (appt) onPickAppt(appt);
        },
        onClickDate(date /* Temporal.PlainDate */) {
          const iso = `${date.year}-${pad(date.month)}-${pad(date.day)}`;
          onPickEmpty(iso);
        },
      },
    },
    [eventsService, currentTimePlugin]
  );

  // Sincroniza cuando cambian las citas (filtro, realtime, recarga).
  useEffect(() => {
    if (!calendar) return;
    eventsService.set(appointments.map(apptToEvent));
  }, [appointments, calendar, eventsService]);

  if (!calendar) {
    return <ListLoading label="Inicializando calendario…" />;
  }

  return (
    <ScheduleXCalendar
      calendarApp={calendar}
      customComponents={{
        timeGridEvent: TimeGridEventCard,
        dateGridEvent: DateGridEventCard,
        monthGridEvent: MonthGridEventCard,
        monthAgendaEvent: MonthAgendaEventRow,
      }}
    />
  );
}

// ── Custom event components ────────────────────────────────────────────
// Card alta (vista Día/Semana time-grid). Muestra hora · cliente · servicio
// y pill de estado. Auto-compact cuando es muy corta (< 36px).
function TimeGridEventCard({ calendarEvent }) {
  const a = calendarEvent._raw;
  if (!a) return null;
  const color = a.staff?.color || FALLBACK_COLOR;
  const st = STATUS_INFO[a.status] || STATUS_INFO.pending;
  const time = (a.time || '').slice(0, 5);
  const svc = a.services?.name || 'Servicio';
  const isCancelled = a.status === 'cancelled';
  return (
    <div
      className={`h-full w-full px-2 py-1 rounded-lg overflow-hidden border border-border/40 sx-mj-event ${isCancelled ? 'opacity-55' : ''}`}
      style={{
        background: `linear-gradient(135deg, ${color}40 0%, ${color}1a 100%)`,
        borderLeft: `3px solid ${color}`,
        boxShadow: `0 1px 3px ${color}26`,
      }}
    >
      <div className="flex items-center justify-between gap-1 min-w-0">
        <span className={`text-xs font-semibold truncate ${isCancelled ? 'line-through decoration-1' : ''}`}>
          {clientNameFor(a)}
        </span>
        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border whitespace-nowrap flex-shrink-0 ${st.pill}`}>
          {st.short}
        </span>
      </div>
      <div className={`text-[10px] mt-0.5 truncate ${isCancelled ? 'text-text-muted' : 'text-text-secondary'}`}>
        {time} · {svc}
      </div>
      {a.staff?.name && (
        <div className="text-[10px] font-semibold mt-0.5 truncate" style={{ color }}>
          {a.staff.name}
        </div>
      )}
    </div>
  );
}

// Versión barra (eventos all-day en vista Semana). Reusa estilos pero
// horizontal y compacta.
function DateGridEventCard({ calendarEvent }) {
  const a = calendarEvent._raw;
  if (!a) return null;
  const color = a.staff?.color || FALLBACK_COLOR;
  const st = STATUS_INFO[a.status] || STATUS_INFO.pending;
  const isCancelled = a.status === 'cancelled';
  return (
    <div
      className={`h-full w-full px-2 py-1 rounded-md flex items-center gap-1.5 overflow-hidden ${isCancelled ? 'opacity-55' : ''}`}
      style={{
        background: `${color}33`,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border whitespace-nowrap flex-shrink-0 ${st.pill}`}>
        {st.short}
      </span>
      <span className={`text-xs font-semibold truncate ${isCancelled ? 'line-through' : ''}`}>
        {clientNameFor(a)}
      </span>
    </div>
  );
}

// Vista Mes-grid: barrita ultra compacta dentro del cell del día.
function MonthGridEventCard({ calendarEvent }) {
  const a = calendarEvent._raw;
  if (!a) return null;
  const color = a.staff?.color || FALLBACK_COLOR;
  const st = STATUS_INFO[a.status] || STATUS_INFO.pending;
  const isCancelled = a.status === 'cancelled';
  return (
    <div
      className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 overflow-hidden ${isCancelled ? 'opacity-55' : ''}`}
      style={{
        background: `${color}30`,
        borderLeft: `2px solid ${color}`,
      }}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        a.status === 'pending'   ? 'bg-gold' :
        a.status === 'confirmed' ? 'bg-green-500' :
        a.status === 'completed' ? 'bg-blue-400' :
        a.status === 'cancelled' ? 'bg-red-500' : 'bg-gold'
      }`} aria-hidden="true" />
      <span className={`font-semibold ${isCancelled ? 'line-through' : ''}`}>
        {(a.time || '').slice(0, 5)}
      </span>
      <span className={`truncate ${isCancelled ? 'text-text-muted line-through' : 'text-text-secondary'}`}>
        · {clientNameFor(a)}
      </span>
      <span className={`ml-auto text-[8px] uppercase font-bold px-1 rounded border whitespace-nowrap flex-shrink-0 ${st.pill}`}>
        {st.short}
      </span>
    </div>
  );
}

// Lista de la vista mes-agenda (móvil): fila más alta, mismo lenguaje.
function MonthAgendaEventRow({ calendarEvent }) {
  const a = calendarEvent._raw;
  if (!a) return null;
  const color = a.staff?.color || FALLBACK_COLOR;
  const st = STATUS_INFO[a.status] || STATUS_INFO.pending;
  const isCancelled = a.status === 'cancelled';
  return (
    <div
      className={`px-2 py-1.5 rounded-lg flex items-center gap-2 overflow-hidden ${isCancelled ? 'opacity-55' : ''}`}
      style={{ background: `${color}26`, borderLeft: `3px solid ${color}` }}
    >
      <div className="text-[11px] font-semibold w-12 flex-shrink-0">{(a.time || '').slice(0, 5)}</div>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-semibold truncate ${isCancelled ? 'line-through' : ''}`}>{clientNameFor(a)}</div>
        <div className="text-[10px] text-text-muted truncate">{a.services?.name || 'Servicio'}{a.staff?.name ? ` · ${a.staff.name}` : ''}</div>
      </div>
      <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border whitespace-nowrap flex-shrink-0 ${st.pill}`}>
        {st.short}
      </span>
    </div>
  );
}
