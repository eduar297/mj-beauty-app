import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Field, Input, Select, Btn } from './ui.jsx';
import {
  api_appointments, api_clients, api_services, api_staff, api_staff_services,
  api_time_off,
} from '../lib/api';
import { computeAvailableSlots } from '../lib/availability.js';

// Clave para recordar a la clienta en este navegador. Mejora la UX en mobile:
// al volver a reservar, el teléfono (y el nombre) ya están pre-llenados.
const LS_KEY = 'mj-booking-identity';
const readLocalIdentity = () => {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LS_KEY) : null;
    if (!raw) return { phone: '', name: '' };
    const parsed = JSON.parse(raw);
    return { phone: parsed.phone || '', name: parsed.name || '' };
  } catch { return { phone: '', name: '' }; }
};
const saveLocalIdentity = ({ phone, name }) => {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify({ phone, name }));
  } catch {}
};

// Formulario público de reserva — usado tanto por Landing como por Services.
// Es la "registración" implícita: la primera vez crea fila en clients,
// la próxima reconoce a la clienta por teléfono.
export default function PublicBookingForm({ onClose, defaultService, services: servicesProp }) {
  const today = new Date().toISOString().slice(0, 10);

  // Estado del formulario — pre-llenado con la identidad guardada en este
  // navegador (si existe). Esto evita re-tipear el teléfono en cada visita.
  const [phone, setPhone] = useState(() => readLocalIdentity().phone);
  const [name, setName] = useState(() => readLocalIdentity().name);
  const [serviceName, setServiceName] = useState(defaultService || '');
  const [date, setDate] = useState(today);
  const [preferredStaffId, setPreferredStaffId] = useState('');
  const [time, setTime] = useState('');
  const [step, setStep] = useState(1);

  // Datos cargados
  const [services, setServices] = useState(servicesProp || null);
  const [allStaff, setAllStaff] = useState([]); // staff activos con weekly_hours
  const [staffServices, setStaffServices] = useState({}); // serviceId -> [staffId]
  const [existingClient, setExistingClient] = useState(null); // {id, name}
  const [phoneLookupBusy, setPhoneLookupBusy] = useState(false);

  // Slots por fecha
  const [slotsInfo, setSlotsInfo] = useState({ slots: [], staffBySlot: {} });
  const [slotsLoading, setSlotsLoading] = useState(false);

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
  }, [servicesProp]);

  // Cargar el mapping serviceId -> [staffId] solo de los servicios disponibles
  useEffect(() => {
    if (!services?.length) return;
    Promise.all(services.map(s =>
      api_staff_services.byService(s.id).then(r => [s.id, (r.data || []).map(x => x.staff_id)])
    )).then(pairs => setStaffServices(Object.fromEntries(pairs)));
  }, [services]);

  const selectedService = useMemo(
    () => (services || []).find(s => s.name === serviceName) || null,
    [services, serviceName]
  );

  // Empleadas elegibles para el servicio elegido
  const eligibleStaff = useMemo(() => {
    if (!selectedService) return [];
    const ids = new Set(staffServices[selectedService.id] || []);
    // Fallback: si nadie está linkeado a ese servicio aún, mostrar todo el staff activo.
    const pool = ids.size > 0 ? allStaff.filter(s => ids.has(s.id)) : allStaff;
    return pool;
  }, [selectedService, staffServices, allStaff]);

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

  // Computar slots disponibles cuando cambia (servicio, fecha, preferencia).
  useEffect(() => {
    if (step !== 2 || !selectedService || !date || eligibleStaff.length === 0) {
      setSlotsInfo({ slots: [], staffBySlot: {} });
      return;
    }
    setTime(''); // reset al cambiar fecha/servicio/preferencia
    setSlotsLoading(true);
    const dayStartIso = `${date}T00:00:00.000Z`;
    const dayEndIso   = `${date}T23:59:59.999Z`;
    Promise.all([
      api_time_off.byDateRange(dayStartIso, dayEndIso),
      api_appointments.listForAvailability({ from: date, to: date }),
    ]).then(([offRes, apptRes]) => {
      const info = computeAvailableSlots({
        service: selectedService,
        date,
        eligibleStaff,
        timeOffs: offRes.data || [],
        appointments: apptRes.data || [],
        preferredStaffId: preferredStaffId || null,
      });
      setSlotsInfo(info);
    }).finally(() => setSlotsLoading(false));
  }, [step, selectedService?.id, date, preferredStaffId, eligibleStaff.length]);

  const submit = async () => {
    setErr('');
    setSubmitting(true);
    try {
      // 1. Upsert cliente por teléfono
      const { id: clientId, isNew: newClient } = await api_clients.upsertByPhone({ phone, name });
      // 2. Decidir staff_id
      const candidates = slotsInfo.staffBySlot[time] || [];
      let staffId = null;
      if (preferredStaffId && candidates.includes(preferredStaffId)) {
        staffId = preferredStaffId;
      } else if (candidates.length > 0) {
        staffId = candidates[0];
      }
      if (!staffId) throw new Error('Esa hora ya no está disponible — elige otra');

      // 3. Crear cita
      const res = await api_appointments.create({
        client_id: clientId,
        service_id: selectedService.id,
        staff_id: staffId,
        preferred_staff_id: preferredStaffId || null,
        date, time,
        duration: selectedService.duration || 60,
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

  const canContinue = phone.replace(/\D/g, '').length >= 7 && name.trim() && serviceName;
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
              placeholder="+57 300 000 0000" />
          </Field>

          {/* Hint contextual sobre si la clienta es conocida o nueva */}
          <div className="-mt-2 mb-3 text-xs min-h-[18px] flex justify-between items-center gap-3">
            <div className="min-w-0 truncate">
              {phoneLookupBusy ? (
                <span className="text-text-muted">Buscando…</span>
              ) : existingClient ? (
                <span className="text-gold">👋 ¡Hola de nuevo, {existingClient.name}!</span>
              ) : phone.replace(/\D/g, '').length >= 7 ? (
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

          <Field label="Servicio">
            <Select value={serviceName} onChange={e => setServiceName(e.target.value)}
              options={services === null
                ? [{ value: '', label: 'Cargando servicios…' }]
                : [{ value: '', label: 'Selecciona un servicio' }, ...services.map(x => ({ value: x.name, label: `${x.name} — ${x.duration}min` }))]} />
          </Field>

          <Btn onClick={() => canContinue && setStep(2)} disabled={!canContinue}>Continuar →</Btn>
        </>
      ) : (
        <>
          <Field label="Fecha">
            <Input type="date" value={date} min={today} onChange={e => setDate(e.target.value)} />
          </Field>

          {eligibleStaff.length >= 1 && (
            <Field label={`Empleada${eligibleStaff.length > 1 ? ' (opcional)' : ''}`}>
              <Select value={preferredStaffId}
                onChange={e => setPreferredStaffId(e.target.value)}
                options={[
                  { value: '', label: 'Cualquiera disponible' },
                  ...eligibleStaff.map(s => ({ value: s.id, label: s.name })),
                ]} />
              <div className="text-[11px] text-text-muted mt-1">
                Elige una para ver solo sus turnos disponibles, o deja "Cualquiera" para ver todas las horas posibles.
              </div>
            </Field>
          )}

          <Field label="Horas disponibles">
            {slotsLoading ? (
              <div className="text-xs text-text-muted py-2">Calculando disponibilidad…</div>
            ) : slotsInfo.slots.length === 0 ? (
              <div className="text-xs text-text-muted bg-bg-elevated border border-border rounded-lg px-3 py-3">
                No hay horas disponibles ese día — prueba otra fecha
                {preferredStaffId && ' o quita la preferencia de empleada'}.
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-48 overflow-y-auto py-1">
                {slotsInfo.slots.map(s => (
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
