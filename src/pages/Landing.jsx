import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { Icon, Modal, Field, Input, Select, Btn, CAT_COLORS, CAT_ICONS, GoldDivider } from '../components/ui.jsx';
import { api_appointments, api_services } from '../lib/api';
import { useEffect } from 'react';

export default function Landing() {
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const cats = [
    { label: 'Uñas', sub: 'Manicure & Pedicure', img: '/assets/svc-nails.png', cat: 'Uñas' },
    { label: 'Cabello', sub: 'Cortes, Tintes & Más', img: '/assets/svc-hair.png', cat: 'Pelo' },
    { label: 'Faciales', sub: 'Limpieza & Tratamientos', img: '/assets/svc-facial.png', cat: 'Faciales' },
    { label: 'Cejas', sub: 'Diseño & Laminado', img: '/assets/svc-cejas.png', cat: 'Cejas' },
    { label: 'Pestañas', sub: 'Lifting & Extensiones', img: '/assets/svc-pestanas.png', cat: 'Pestañas' },
  ];

  return (
    <div className="min-h-screen bg-bg text-text">
      <nav className="sticky top-0 z-50 bg-bg-card/80 backdrop-blur border-b border-border h-16 flex items-center justify-between px-4 sm:px-10">
        <div className="font-serif text-xl font-bold text-gold">MJ <span className="italic font-normal">Beauty</span></div>
        <div className="hidden md:flex gap-8 text-sm text-text-secondary">
          <a href="#servicios" className="hover:text-gold">Servicios</a>
          <a href="#nosotras" className="hover:text-gold">Nosotras</a>
          <a href="#contacto" className="hover:text-gold">Contacto</a>
        </div>
        <div className="hidden md:flex gap-2.5">
          <button onClick={() => nav('/login')} className="text-xs px-4 py-1.5 rounded-lg border border-border-strong text-text-secondary hover:text-gold hover:border-gold">Gestión</button>
          <button onClick={() => setBookingOpen(true)} className="text-xs px-4 py-1.5 rounded-lg bg-gold text-[#0d0c0a] font-bold hover:opacity-90">Reservar</button>
        </div>
        <button onClick={() => setMenuOpen(v => !v)} className="md:hidden text-text-primary p-2">
          <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
        </button>
      </nav>

      {menuOpen && (
        <div className="md:hidden fixed top-16 inset-x-0 z-40 bg-bg-card border-b border-border p-4 flex flex-col gap-1 shadow-2xl">
          <a href="#servicios" onClick={() => setMenuOpen(false)} className="py-3 px-2 border-b border-border">Servicios</a>
          <a href="#nosotras" onClick={() => setMenuOpen(false)} className="py-3 px-2 border-b border-border">Nosotras</a>
          <a href="#contacto" onClick={() => setMenuOpen(false)} className="py-3 px-2 border-b border-border">Contacto</a>
          <div className="flex gap-2 mt-3">
            <button onClick={() => { setMenuOpen(false); nav('/login'); }} className="flex-1 py-2.5 rounded-lg border border-border-strong text-text-secondary">Gestión</button>
            <button onClick={() => { setMenuOpen(false); setBookingOpen(true); }} className="flex-1 py-2.5 rounded-lg bg-gold text-[#0d0c0a] font-bold">Reservar</button>
          </div>
        </div>
      )}

      <section className="min-h-[88vh] flex items-center justify-center px-4 py-20 sm:px-10 relative overflow-hidden">
        <img src="/assets/hero-bg.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 dark:opacity-40 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg via-transparent to-bg pointer-events-none" />
        <div className="relative z-10 max-w-3xl text-center w-full">
          <img src="/assets/logo-light.svg" alt="" className="w-20 sm:w-24 mx-auto mb-4" />
          <div className="inline-flex items-center gap-2 border border-border-strong rounded-full px-4 py-1 mb-6 text-[11px] text-gold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-gold" /> Salón de Belleza Premium
          </div>
          <h1 className="font-serif font-bold leading-[1.05] text-text" style={{ fontSize: 'clamp(36px,8vw,88px)' }}>
            Tu Belleza,<br /><span className="text-gold italic">Nuestro Arte</span>
          </h1>
          <p className="text-text-secondary mt-5 max-w-md mx-auto leading-relaxed font-light" style={{ fontSize: 'clamp(14px,2vw,17px)' }}>
            Servicios de belleza de alta calidad en un ambiente exclusivo.
          </p>
          <div className="flex gap-3 justify-center flex-wrap mt-8">
            <button onClick={() => setBookingOpen(true)} className="bg-gold text-[#0d0c0a] px-7 py-3 rounded-lg font-bold shadow-lg shadow-gold/20 hover:-translate-y-0.5 transition">Reservar Ahora</button>
            <a href="#servicios" className="border border-border-strong px-7 py-3 rounded-lg font-medium hover:border-gold transition">Ver Servicios</a>
          </div>
        </div>
      </section>

      <section id="servicios" className="px-4 py-20 sm:px-10 bg-bg-card">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[11px] uppercase tracking-widest text-gold mb-3">Lo que hacemos</div>
            <h2 className="font-serif font-semibold mb-2" style={{ fontSize: 'clamp(28px,5vw,40px)' }}>Nuestros Servicios</h2>
          </div>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {cats.map(s => (
              <Link key={s.label} to={`/servicios/${s.cat}`}
                className="group bg-bg-card border border-border hover:border-gold/40 rounded-2xl overflow-hidden transition hover:-translate-y-1 hover:shadow-xl">
                <div className="relative overflow-hidden" style={{ height: 'clamp(80px,14vw,110px)' }}>
                  <img src={s.img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                </div>
                <div className="p-3.5">
                  <div className="font-bold text-sm">{s.label}</div>
                  <div className="text-[11px] text-text-muted mt-0.5">{s.sub}</div>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/servicios" className="inline-block px-7 py-3 border border-border-strong rounded-lg text-gold font-semibold hover:bg-gold-dim transition">
              Ver todos los servicios y precios →
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10 px-4 sm:px-10 bg-[var(--sidebar-bg)]">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-between gap-3 items-center">
          <div>
            <div className="font-serif text-xl text-gold font-bold">MJ Beauty</div>
            <div className="text-xs text-text-muted mt-1">Salón de Belleza Premium</div>
          </div>
          <div className="text-xs text-text-muted">© 2026 MJ Beauty.</div>
        </div>
      </footer>

      <Modal open={bookingOpen} onClose={() => setBookingOpen(false)} title="Reservar Cita">
        <BookingForm onClose={() => setBookingOpen(false)} />
      </Modal>
    </div>
  );
}

function BookingForm({ onClose, defaultService }) {
  const [form, setForm] = useState({ name: '', phone: '', service: defaultService || '', date: '', time: '' });
  const [services, setServices] = useState([]);
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);

  useEffect(() => { api_services.listPublic().then(({ data }) => setServices(data || [])); }, []);

  const submit = async () => {
    // Crear cliente si no existe + cita pendiente
    const svc = services.find(s => s.name === form.service);
    await api_appointments.create({
      service_id: svc?.id, date: form.date, time: form.time,
      duration: svc?.duration || 60, status: 'pending',
      notes: `Cliente web: ${form.name} · ${form.phone}`,
    });
    setDone(true);
  };

  if (done) return (
    <div className="text-center py-4">
      <div className="w-16 h-16 rounded-full bg-green-500/15 grid place-items-center mx-auto mb-4">
        <Icon name="check" size={28} color="#6db86d" />
      </div>
      <h3 className="font-serif text-xl mb-2">¡Cita Reservada!</h3>
      <p className="text-text-secondary text-sm mb-5">Te contactaremos para confirmar.</p>
      <Btn onClick={onClose}>Cerrar</Btn>
    </div>
  );

  return (
    <div>
      <div className="flex gap-2 mb-5">{[1,2].map(s => <div key={s} className={`flex-1 h-1 rounded ${s <= step ? 'bg-gold' : 'bg-border'}`} />)}</div>
      {step === 1 ? (
        <>
          <Field label="Nombre completo"><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Tu nombre" /></Field>
          <Field label="Teléfono"><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+57 300 000 0000" /></Field>
          <Field label="Servicio">
            <Select value={form.service} onChange={e => setForm({...form, service: e.target.value})}
              options={[{value:'',label:'Selecciona un servicio'}, ...services.map(s => ({value:s.name,label:s.name}))]} />
          </Field>
          <Btn onClick={() => form.name && form.service && setStep(2)}>Continuar →</Btn>
        </>
      ) : (
        <>
          <Field label="Fecha"><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></Field>
          <Field label="Hora"><Input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} /></Field>
          <div className="flex gap-2.5">
            <Btn variant="ghost" onClick={() => setStep(1)}>← Atrás</Btn>
            <Btn onClick={submit}>Confirmar Cita</Btn>
          </div>
        </>
      )}
    </div>
  );
}
