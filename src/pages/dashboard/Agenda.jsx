import { useEffect, useState } from 'react';
import { Header } from '../Dashboard.jsx';
import { Icon, Btn, StatusBadge, Modal, Field, Input, Select } from '../../components/ui.jsx';
import { api_appointments, api_services, api_staff, api_clients } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth.jsx';

export default function Agenda() {
  const { user } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [appts, setAppts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [clients, setClients] = useState([]);

  const load = () => api_appointments.list(date).then(({data}) => setAppts(data || []));

  useEffect(() => { load(); }, [date]);
  useEffect(() => {
    api_services.list().then(({data}) => setServices(data || []));
    api_staff.list().then(({data}) => setStaff(data || []));
    api_clients.list().then(({data}) => setClients(data || []));
    // Realtime
    const ch = api_appointments.subscribe(load);
    return () => { ch?.unsubscribe?.(); };
  }, []);

  const filtered = user?.role === 'empleada'
    ? appts.filter(a => a.staff_id === user.id)
    : appts;

  const fmtDate = d => new Date(d + 'T00:00').toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' });
  const shift = days => {
    const d = new Date(date + 'T00:00'); d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0,10));
  };

  return (
    <div>
      <Header title="Agenda" subtitle={fmtDate(date)}
        action={<div className="flex gap-2 items-center">
          <button onClick={() => shift(-1)} className="px-2.5 py-2 rounded-lg border border-border bg-bg-card"><Icon name="chevronLeft" size={14} /></button>
          <button onClick={() => shift(1)} className="px-2.5 py-2 rounded-lg border border-border bg-bg-card"><Icon name="chevronRight" size={14} /></button>
          <Btn icon="plus" onClick={() => setShowModal(true)}>Nueva</Btn>
        </div>}
      />

      <div className="flex flex-col gap-2.5">
        {filtered.length === 0 && <div className="text-center text-text-muted py-10 text-sm">No hay citas para este día</div>}
        {filtered.map(a => (
          <div key={a.id} className="bg-bg-card border border-border rounded-xl p-4" style={{ borderLeft: `3px solid ${a.staff?.color || 'var(--gold)'}` }}>
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-sm">{a.clients?.name || (a.notes?.match(/Cliente web: ([^·]+)/) || [])[1]?.trim() || 'Cliente'}</div>
                <div className="text-sm text-text-secondary mt-0.5">{a.services?.name || 'Servicio'}</div>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  <span className="text-xs text-text-muted flex items-center gap-1"><Icon name="clock" size={12} /> {a.time?.slice(0,5)} · {a.duration} min</span>
                  {a.staff?.name && <span className="text-xs font-semibold" style={{ color: a.staff?.color }}>{a.staff.name}</span>}
                </div>
              </div>
              <StatusBadge status={a.status} />
            </div>
          </div>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva Cita">
        <NewApptForm services={services} staff={staff} clients={clients} onSaved={() => { setShowModal(false); load(); }} />
      </Modal>
    </div>
  );
}

function NewApptForm({ services, staff, clients, onSaved }) {
  const [f, setF] = useState({ client_id: '', service_id: '', staff_id: '', date: new Date().toISOString().slice(0,10), time: '10:00', notes: '' });
  const submit = async () => {
    const svc = services.find(s => s.id === f.service_id);
    await api_appointments.create({ ...f, duration: svc?.duration || 60, status: 'confirmed' });
    onSaved();
  };
  return (
    <div>
      <Field label="Cliente"><Select value={f.client_id} onChange={e => setF({...f, client_id: e.target.value})} options={[{value:'',label:'Selecciona'}, ...clients.map(c => ({value:c.id, label:c.name}))]} /></Field>
      <Field label="Servicio"><Select value={f.service_id} onChange={e => setF({...f, service_id: e.target.value})} options={[{value:'',label:'Selecciona'}, ...services.map(s => ({value:s.id, label:`${s.name} — ${s.duration}min`}))]} /></Field>
      <Field label="Empleada"><Select value={f.staff_id} onChange={e => setF({...f, staff_id: e.target.value})} options={[{value:'',label:'Selecciona'}, ...staff.map(s => ({value:s.id, label:s.name}))]} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha"><Input type="date" value={f.date} onChange={e => setF({...f, date: e.target.value})} /></Field>
        <Field label="Hora"><Input type="time" value={f.time} onChange={e => setF({...f, time: e.target.value})} /></Field>
      </div>
      <Btn icon="check" onClick={submit}>Guardar Cita</Btn>
    </div>
  );
}
