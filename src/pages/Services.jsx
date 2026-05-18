import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon, Modal, Field, Input, Select, Btn, CAT_COLORS, CAT_ICONS } from '../components/ui.jsx';
import { api_services, api_appointments } from '../lib/api';

export default function Services() {
  const { cat: paramCat } = useParams();
  const nav = useNavigate();
  const cats = ['Uñas', 'Pelo', 'Faciales', 'Cejas', 'Pestañas'];
  const [activeCat, setActiveCat] = useState(paramCat || 'Uñas');
  const [services, setServices] = useState([]);
  const [bookingService, setBookingService] = useState(null);
  const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  useEffect(() => { api_services.listPublic().then(({ data }) => setServices(data || [])); }, []);

  const filtered = services.filter(s => s.cat === activeCat);
  const SVC_IMGS = { 'Uñas': '/assets/svc-nails.png', 'Pelo': '/assets/svc-hair.png', 'Faciales': '/assets/svc-facial.png', 'Cejas': '/assets/svc-cejas.png', 'Pestañas': '/assets/svc-pestanas.png' };

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="sticky top-0 z-10 bg-bg-card/90 backdrop-blur border-b border-border h-16 flex items-center justify-between px-4 sm:px-10 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => nav('/')} className="border border-border rounded-lg px-3 py-1.5 text-xs text-text-secondary flex items-center gap-1">
            <Icon name="chevronLeft" size={13} /><span className="hidden sm:inline">Inicio</span>
          </button>
          <div className="font-serif font-semibold truncate" style={{ fontSize: 'clamp(16px,3vw,20px)' }}>
            Nuestros <span className="text-gold italic">Servicios</span>
          </div>
        </div>
        <button onClick={() => setBookingService('')} className="bg-gold text-[#0d0c0a] px-4 py-2 rounded-lg text-sm font-bold flex-shrink-0">Reservar</button>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-10 py-8">
        <div className="flex gap-2 mb-7 overflow-x-auto pb-1">
          {cats.map(c => {
            const color = CAT_COLORS[c]; const active = activeCat === c;
            return (
              <button key={c} onClick={() => setActiveCat(c)}
                style={{ background: active ? `${color}22` : 'var(--bg-card)', color: active ? color : 'var(--text-secondary)', borderColor: active ? color + '55' : 'var(--border)' }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm border whitespace-nowrap flex-shrink-0">
                <Icon name={CAT_ICONS[c]} size={14} color={active ? color : 'var(--text-muted)'} />
                {c}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {filtered.map(s => {
            const color = CAT_COLORS[s.cat];
            return (
              <div key={s.id} className="bg-bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-1 transition group">
                <div className="h-40 overflow-hidden relative">
                  <img src={s.photo_url || SVC_IMGS[s.cat]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                  {s.popular && (
                    <div style={{ background: `${color}cc` }} className="absolute top-2.5 right-2.5 text-[9px] font-bold text-[#0d0c0a] px-2 py-0.5 rounded-full uppercase tracking-wider">Popular</div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold">{s.name}</div>
                    <div className="font-serif font-bold text-lg ml-2 flex-shrink-0" style={{ color }}>{fmt(s.price)}</div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-text-muted mb-2.5">
                    <Icon name="clock" size={12} /> {s.duration} min
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed mb-3 line-clamp-2">{s.description}</p>
                  <button onClick={() => setBookingService(s.name)}
                    style={{ background: `${color}22`, borderColor: `${color}44`, color }}
                    className="w-full py-2 rounded-lg text-xs font-bold border">Reservar</button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-text-muted py-12">Aún no hay servicios en esta categoría.</div>
          )}
        </div>
      </div>

      <Modal open={bookingService !== null} onClose={() => setBookingService(null)} title="Reservar Cita">
        {bookingService !== null && <SimpleBooking defaultService={bookingService} services={services} onClose={() => setBookingService(null)} />}
      </Modal>
    </div>
  );
}

function SimpleBooking({ defaultService, services, onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', service: defaultService || '', date: '', time: '' });
  const [done, setDone] = useState(false);
  const submit = async () => {
    const svc = services.find(s => s.name === form.service);
    await api_appointments.create({ service_id: svc?.id, date: form.date, time: form.time, duration: svc?.duration || 60, status: 'pending', notes: `Cliente web: ${form.name} · ${form.phone}` });
    setDone(true);
  };
  if (done) return (
    <div className="text-center py-4">
      <div className="w-16 h-16 rounded-full bg-green-500/15 grid place-items-center mx-auto mb-4"><Icon name="check" size={28} color="#6db86d" /></div>
      <h3 className="font-serif text-xl mb-2">¡Cita Reservada!</h3>
      <Btn onClick={onClose}>Cerrar</Btn>
    </div>
  );
  return (
    <>
      <Field label="Nombre"><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Tu nombre" /></Field>
      <Field label="Teléfono"><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+57 300 000 0000" /></Field>
      <Field label="Servicio"><Select value={form.service} onChange={e => setForm({...form, service: e.target.value})} options={[{value:'',label:'Selecciona'}, ...services.map(s => ({value:s.name,label:s.name}))]} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha"><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></Field>
        <Field label="Hora"><Input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} /></Field>
      </div>
      <Btn onClick={submit} disabled={!form.name || !form.service || !form.date || !form.time}>Confirmar</Btn>
    </>
  );
}
