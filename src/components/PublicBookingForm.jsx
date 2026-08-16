import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Field, Input, Btn } from './ui.jsx';
import ServicePicker from './ServicePicker.jsx';
import { fmtDuration } from '../lib/duration';
import {
  api_appointments, api_clients, api_services, api_staff, api_closed_days,
} from '../lib/api';
import { computeAllSlots } from '../lib/availability.js';
import { todayISO } from '../lib/dates';

// Clave para recordar a la clienta en este navegador. Mejora la UX en mobile:
// al volver a reservar, el teléfono (y el nombre) ya están pre-llenados.
const LS_KEY = 'mj-booking-identity';
export const readLocalIdentity = () => {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LS_KEY) : null;
    if (!raw) return { phone: '', name: '' };
    const parsed = JSON.parse(raw);
    return { phone: parsed.phone || '', name: parsed.name || '' };
  } catch { return { phone: '', name: '' }; }
};
export const saveLocalIdentity = ({ phone, name }) => {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify({ phone, name }));
  } catch {}
};

// Formulario público de reserva — usado tanto por Landing como por Services.
// Es la "registración" implícita: la primera vez crea fila en clients,
// la próxima reconoce a la clienta por teléfono.
export default function PublicBookingForm({ onClose, defaultService, services: servicesProp }) {
  // Hora LOCAL, no UTC: con toISOString() en Cuba ya era "mañana" a las 8 PM.
  const today = todayISO();

  // Estado del formulario — pre-llenado con la identidad guardada en este
  // navegador (si existe). Esto evita re-tipear el teléfono en cada visita.
  const [phone, setPhone] = useState(() => readLocalIdentity().phone);
  const [name, setName] = useState(() => readLocalIdentity().name);
  // Multi-servicio: la clienta puede elegir varios en una sola cita
  // (ej: pestañas + uñas). Guardamos los ids seleccionados.
  const [selectedIds, setSelectedIds] = useState([]);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('');
  const [step, setStep] = useState(1);

  // Datos cargados
  const [services, setServices] = useState(servicesProp || null);
  const [allStaff, setAllStaff] = useState([]); // staff activos (para las ventanas horarias)
  // Días que el salón cerró — no se ofrecen horarios en ellos.
  const [closedDays, setClosedDays] = useState([]); // [{date, reason}]
  const [existingClient, setExistingClient] = useState(null); // {id, name}
  const [phoneLookupBusy, setPhoneLookupBusy] = useState(false);

  // Horarios del día (siempre todos, sin filtrar)
  const [slots, setSlots] = useState([]);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [err, setErr] = useState('');

  // Carga inicial: servicios (si no llegaron por prop) + staff activos.
  useEffect(() => {
    if (!servicesProp) {
      api_services.listPublic().then(({ data }) => setServices(data || []));
    }
    api_staff.list().then(({ data }) => setAllStaff(data || []));
    api_closed_days.list({ from: today }).then(({ data }) => setClosedDays(data || []));
  }, [servicesProp]);

  // Si llega defaultService (reserva de un servicio puntual), lo pre-selecciona.
  useEffect(() => {
    if (!defaultService || !services?.length) return;
    const svc = services.find(s => s.name === defaultService);
    if (svc) setSelectedIds(prev => (prev.length ? prev : [svc.id]));
  }, [defaultService, services]);

  const selectedServices = useMemo(
    () => (services || []).filter(s => selectedIds.includes(s.id)),
    [services, selectedIds]
  );

  // Duración total = suma de los servicios elegidos (se agenda todo junto).
  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + (Number(s.duration) || 0), 0),
    [selectedServices]
  );

  // Lookup por teléfono (debounced 600ms) cuando hay 7+ dígitos
  const lookupTimer = useRef(null);
  useEffect(() => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) { setExistingClient(null); return; }
    lookupTimer.current = setTimeout(async () => {
      setPhoneLookupBusy(true);
      try {
        const { data } = await api_clients.findByPhone(phone);
        if (data) {
          setExistingClient(data);
          // Pre-llena el nombre solo si la clienta no tipeó nada aún
          setName(prev => prev.trim() ? prev : (data.name || ''));
        } else {
          setExistingClient(null);
        }
      } finally {
        setPhoneLookupBusy(false);
      }
    }, 600);
    return () => clearTimeout(lookupTimer.current);
  }, [phone]);

  // ¿El salón cerró el día elegido?
  const closedInfo = useMemo(
    () => closedDays.find(c => c.date === date) || null,
    [closedDays, date]
  );

  // Horarios del día: SIEMPRE se muestran todos (no se filtra por citas ni por
  // empleada). La clienta reserva y el salón confirma o reagenda después.
  // Excepción: si el salón cerró ese día, no se ofrece ninguno.
  useEffect(() => {
    if (step !== 2 || !date) { setSlots([]); return; }
    setTime(''); // reset al cambiar de fecha
    if (closedDays.some(c => c.date === date)) { setSlots([]); return; }
    setSlots(computeAllSlots({ date, staff: allStaff, stepMinutes: 30 }));
  }, [step, date, allStaff.length, closedDays]);

  const submit = async () => {
    // Red de seguridad: nunca mandamos una cita sin los datos de la clienta,
    // aunque se llegue aquí por un camino raro.
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8 || (name.trim().match(/\p{L}/gu) || []).length < 3 || selectedIds.length === 0) {
      setErr('Completa tu nombre, tu teléfono y al menos un servicio.');
      setStep(1);
      return;
    }
    if (closedDays.some(c => c.date === date)) {
      setErr('Ese día el salón no atiende. Elige otra fecha.');
      return;
    }
    setErr('');
    setSubmitting(true);
    try {
      // 1. Upsert cliente por teléfono
      const { id: clientId, isNew: newClient } = await api_clients.upsertByPhone({ phone, name });

      // 2. Crear cita SIN empleada asignada — el salón asigna al confirmar.
      // service_id es el principal (compat), service_ids todos.
      const primary = selectedServices[0];
      const res = await api_appointments.create({
        client_id: clientId,
        service_id: primary.id,
        service_ids: selectedIds,
        staff_id: null,
        date, time,
        duration: totalDuration || 60,
        status: 'pending',
        notes: null,
      });
      if (res.error) throw res.error;
      // Persistir identidad en este dispositivo para autocompletar la próxima vez.
      saveLocalIdentity({ phone, name });
      setIsNew(newClient);
      setDone(true);
    } catch (e) {
      setErr(e.message || 'No se pudo reservar');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return (
    <div className="text-center py-4">
      <div className="w-16 h-16 rounded-full bg-gold-dim grid place-items-center mx-auto mb-4 border border-gold/40">
        <Icon name="clock" size={28} color="var(--gold)" />
      </div>
      <h3 className="font-serif text-xl mb-2">Esperando aprobación</h3>
      <p className="text-text-secondary text-sm mb-2">
        Tu cita está en revisión. Te notificaremos en breve por esta página o por WhatsApp cuando sea confirmada.
      </p>
      {isNew && (
        <p className="text-xs text-gold mt-3">
          ✨ Quedaste registrada como clienta — tus próximas citas serán más rápidas.
        </p>
      )}
      <div className="mt-5">
        <Btn onClick={onClose}>Cerrar</Btn>
      </div>
    </div>
  );

  // Validación de los datos de la clienta. Antes entraban reservas sin nombre
  // real (aparecían como "Cliente" en la agenda) o con teléfonos incompletos,
  // así que ahora exigimos un nombre con letras de verdad y un móvil completo.
  const phoneDigits = phone.replace(/\D/g, '');
  const cleanName = name.trim();
  const phoneOk = phoneDigits.length >= 8;                       // móvil cubano = 8 dígitos
  const nameOk = (cleanName.match(/\p{L}/gu) || []).length >= 3;  // al menos 3 letras
  const servicesOk = selectedIds.length > 0;
  const canContinue = phoneOk && nameOk && servicesOk;
  // Qué le falta a la clienta, para no dejarla adivinando por qué está trabado.
  const missing = [
    !nameOk && 'tu nombre',
    !phoneOk && 'un teléfono de 8 dígitos',
    !servicesOk && 'al menos un servicio',
  ].filter(Boolean);
  const touched = phone !== '' || name !== '' || selectedIds.length > 0;
  const canConfirm = date && time && !submitting;

  return (
    <div>
      <div className="flex gap-2 mb-5" aria-label={`Paso ${step} de 2`}>
        {[1, 2].map(n => <div key={n} className={`flex-1 h-1 rounded ${n <= step ? 'bg-gold' : 'bg-border'}`} />)}
      </div>

      {step === 1 ? (
        <>
          <Field label="Teléfono">
            <Input value={phone} type="tel"
              onChange={e => setPhone(e.target.value)}
              placeholder="5 123 4567" />
          </Field>

          {/* Hint contextual sobre si la clienta es conocida o nueva */}
          <div className="-mt-2 mb-3 text-xs min-h-[18px] flex justify-between items-center gap-3">
            <div className="min-w-0 truncate">
              {phoneLookupBusy ? (
                <span className="text-text-muted">Buscando…</span>
              ) : existingClient ? (
                <span className="text-gold">👋 ¡Hola de nuevo, {existingClient.name}!</span>
              ) : phoneOk ? (
                <span className="text-text-muted">¿Es tu primera vez? Tu información quedará guardada para próximas citas.</span>
              ) : null}
            </div>
            {existingClient && (
              <button type="button"
                onClick={() => {
                  try { window.localStorage.removeItem(LS_KEY); } catch {}
                  setPhone(''); setName(''); setExistingClient(null);
                }}
                className="text-text-muted hover:text-text-secondary underline underline-offset-2 cursor-pointer whitespace-nowrap flex-shrink-0">
                No soy yo
              </button>
            )}
          </div>

          <Field label="Nombre completo">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" />
          </Field>

          <Field label="Servicios (elige uno o varios)">
            {services === null ? (
              <div className="text-xs text-text-muted py-2">Cargando servicios…</div>
            ) : (
              <ServicePicker
                services={services}
                selectedIds={selectedIds}
                onToggle={(id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                maxHeight="max-h-60"
              />
            )}
          </Field>

          {selectedIds.length > 0 && (
            <div className="-mt-2 mb-3 text-xs flex items-center justify-between gap-2">
              <span className="text-text-secondary">
                {selectedIds.length} servicio{selectedIds.length > 1 ? 's' : ''} · {fmtDuration(totalDuration)} en total
              </span>
              {selectedIds.length > 1 && <span className="text-gold">Se agenda todo en una cita</span>}
            </div>
          )}

          {touched && missing.length > 0 && (
            <div className="-mt-1 mb-3 text-xs text-text-muted">
              Para continuar falta: <span className="text-gold">{missing.join(' · ')}</span>
            </div>
          )}

          <Btn onClick={() => canContinue && setStep(2)} disabled={!canContinue}>Continuar →</Btn>
        </>
      ) : (
        <>
          <Field label="Fecha">
            <Input type="date" value={date} min={today} onChange={e => setDate(e.target.value)} />
          </Field>

          <Field label="Elige una hora">
            {closedInfo ? (
              <div className="text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-3">
                <div className="text-red-400 font-semibold mb-1">Agenda llena — ese día no atendemos</div>
                <div className="text-text-secondary">
                  {closedInfo.reason || 'El salón está cerrado ese día.'} Por favor elige otra fecha.
                </div>
              </div>
            ) : slots.length === 0 ? (
              <div className="text-xs text-text-muted bg-bg-elevated border border-border rounded-lg px-3 py-3">
                No quedan horarios para ese día — prueba con otra fecha.
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-48 overflow-y-auto py-1">
                {slots.map(s => (
                  <button key={s} type="button"
                    onClick={() => setTime(s)}
                    aria-pressed={time === s}
                    className={`text-xs py-1.5 rounded-md border cursor-pointer transition ${
                      time === s
                        ? 'bg-gold text-[#0d0c0a] border-gold font-semibold'
                        : 'bg-bg-elevated border-border text-text-secondary hover:border-gold/50 hover:text-gold'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="text-[11px] text-text-muted mt-1.5">
              Tu cita queda como solicitud; te confirmamos la hora por WhatsApp.
            </div>
          </Field>

          {err && (
            <div role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
              {err}
            </div>
          )}

          <div className="flex gap-2.5">
            <Btn variant="ghost" onClick={() => setStep(1)} disabled={submitting}>← Atrás</Btn>
            <Btn onClick={submit} loading={submitting} disabled={!canConfirm}>
              {submitting ? 'Reservando…' : 'Solicitar Cita'}
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}
