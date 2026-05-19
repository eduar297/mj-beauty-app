import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Icon, Modal, Field, Input, Select, Btn, GoldDivider } from '../components/ui.jsx';
import { api_appointments, api_services, api_settings } from '../lib/api';

export default function Landing() {
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api_settings.get().then(({ data }) => setSettings(data || {}));
  }, []);

  const cats = [
    { label: 'Uñas',     sub: 'Manicure & Pedicure',       img: '/assets/svc-nails.jpeg',    cat: 'Uñas' },
    { label: 'Cabello',  sub: 'Cortes, Tintes & Más',      img: '/assets/svc-hair.jpeg',     cat: 'Pelo' },
    { label: 'Faciales', sub: 'Limpieza & Tratamientos',   img: '/assets/svc-facial.jpeg',   cat: 'Faciales' },
    { label: 'Cejas',    sub: 'Diseño & Laminado',         img: '/assets/svc-cejas.jpeg',    cat: 'Cejas' },
    { label: 'Pestañas', sub: 'Lifting & Extensiones',     img: '/assets/svc-pestanas.jpeg', cat: 'Pestañas' },
  ];

  const s = settings || {};
  const brand = s.business_name || 'MJ Beauty';

  return (
    <div className="min-h-screen bg-bg text-text">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-gold focus:text-[#0d0c0a] focus:px-3 focus:py-1.5 focus:rounded-md focus:font-semibold">Saltar al contenido</a>

      <nav className="sticky top-0 z-50 bg-bg-card/80 backdrop-blur border-b border-border h-16 flex items-center justify-between px-4 sm:px-10">
        <div className="font-serif text-xl font-bold text-gold">{brand.split(' ')[0]} <span className="italic font-normal">{brand.split(' ').slice(1).join(' ') || 'Beauty'}</span></div>
        <div className="hidden md:flex gap-8 text-sm text-text-secondary">
          <a href="#servicios" className="hover:text-gold transition-colors focus-visible:outline-none focus-visible:text-gold">Servicios</a>
          <a href="#nosotras"  className="hover:text-gold transition-colors focus-visible:outline-none focus-visible:text-gold">Nosotras</a>
          <a href="#contacto"  className="hover:text-gold transition-colors focus-visible:outline-none focus-visible:text-gold">Contacto</a>
        </div>
        <div className="hidden md:flex gap-2.5">
          <button onClick={() => nav('/login')} className="text-xs px-4 py-1.5 rounded-lg border border-border-strong text-text-secondary hover:text-gold hover:border-gold transition-colors cursor-pointer">Gestión</button>
          <button onClick={() => setBookingOpen(true)} className="text-xs px-4 py-1.5 rounded-lg bg-gold text-[#0d0c0a] font-bold hover:opacity-90 transition cursor-pointer">Reservar</button>
        </div>
        <button onClick={() => setMenuOpen(v => !v)} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} className="md:hidden text-text-primary p-2 cursor-pointer">
          <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
        </button>
      </nav>

      {menuOpen && (
        <div className="md:hidden fixed top-16 inset-x-0 z-40 bg-bg-card border-b border-border p-4 flex flex-col gap-1 shadow-2xl">
          <a href="#servicios" onClick={() => setMenuOpen(false)} className="py-3 px-2 border-b border-border">Servicios</a>
          <a href="#nosotras"  onClick={() => setMenuOpen(false)} className="py-3 px-2 border-b border-border">Nosotras</a>
          <a href="#contacto"  onClick={() => setMenuOpen(false)} className="py-3 px-2 border-b border-border">Contacto</a>
          <div className="flex gap-2 mt-3">
            <button onClick={() => { setMenuOpen(false); nav('/login'); }} className="flex-1 py-2.5 rounded-lg border border-border-strong text-text-secondary cursor-pointer">Gestión</button>
            <button onClick={() => { setMenuOpen(false); setBookingOpen(true); }} className="flex-1 py-2.5 rounded-lg bg-gold text-[#0d0c0a] font-bold cursor-pointer">Reservar</button>
          </div>
        </div>
      )}

      <main id="contenido">
        <section className="min-h-[88vh] flex items-center justify-center px-4 py-20 sm:px-10 relative overflow-hidden">
          <img src="/assets/hero-bg.png" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-20 dark:opacity-40 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-bg via-transparent to-bg pointer-events-none" />
          <div className="relative z-10 max-w-3xl text-center w-full">
            <img src="/assets/logo.jpeg" alt={`Logo ${brand}`} className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 rounded-full object-cover border border-gold/30 shadow-lg shadow-gold/10" />
            <div className="inline-flex items-center gap-2 border border-border-strong rounded-full px-4 py-1 mb-6 text-[11px] text-gold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" aria-hidden="true" /> {s.tagline || 'Salón de Belleza Premium'}
            </div>
            <h1 className="font-serif font-bold leading-[1.05] text-text" style={{ fontSize: 'clamp(36px,8vw,88px)' }}>
              Tu Belleza,<br /><span className="text-gold italic">Nuestro Arte</span>
            </h1>
            <p className="text-text-secondary mt-5 max-w-md mx-auto leading-relaxed font-light" style={{ fontSize: 'clamp(14px,2vw,17px)' }}>
              Servicios de belleza de alta calidad en un ambiente exclusivo.
            </p>
            <div className="flex gap-3 justify-center flex-wrap mt-8">
              <button onClick={() => setBookingOpen(true)} className="bg-gold text-[#0d0c0a] px-7 py-3 rounded-lg font-bold shadow-lg shadow-gold/20 hover:-translate-y-0.5 motion-reduce:transform-none transition cursor-pointer">Reservar Ahora</button>
              <a href="#servicios" className="border border-border-strong px-7 py-3 rounded-lg font-medium hover:border-gold transition cursor-pointer">Ver Servicios</a>
            </div>
          </div>
        </section>

        <section id="servicios" className="px-4 py-20 sm:px-10 bg-bg-card scroll-mt-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <div className="text-[11px] uppercase tracking-widest text-gold mb-3">Lo que hacemos</div>
              <h2 className="font-serif font-semibold mb-2" style={{ fontSize: 'clamp(28px,5vw,40px)' }}>Nuestros Servicios</h2>
            </div>
            <div className="grid gap-3.5 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              {cats.map(c => (
                <Link key={c.label} to={`/servicios/${c.cat}`}
                  aria-label={`Ver servicios de ${c.label}: ${c.sub}`}
                  className="group bg-bg-card border border-border hover:border-gold/40 rounded-2xl overflow-hidden transition hover:-translate-y-1 motion-reduce:transform-none hover:shadow-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card">
                  <div className="relative overflow-hidden" style={{ height: 'clamp(80px,14vw,110px)' }}>
                    <img src={c.img} alt="" aria-hidden="true" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 motion-reduce:transform-none transition" />
                  </div>
                  <div className="p-3.5">
                    <div className="font-bold text-sm">{c.label}</div>
                    <div className="text-[11px] text-text-muted mt-0.5">{c.sub}</div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link to="/servicios" className="inline-block px-7 py-3 border border-border-strong rounded-lg text-gold font-semibold hover:bg-gold-dim transition cursor-pointer">
                Ver todos los servicios y precios →
              </Link>
            </div>
          </div>
        </section>

        <section id="nosotras" className="px-4 py-20 sm:px-10 scroll-mt-20">
          <div className="max-w-5xl mx-auto grid gap-10 md:grid-cols-2 items-center">
            <div className="relative">
              <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-border-strong shadow-xl">
                <img src="/assets/about-placeholder.jpeg" alt={`Equipo de ${brand}`} loading="lazy" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-4 -right-4 hidden sm:block bg-bg-card border border-border-strong rounded-xl px-4 py-3 shadow-lg">
                <div className="text-[10px] uppercase tracking-widest text-gold">Calidad</div>
                <div className="font-serif text-lg font-semibold">Premium</div>
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-gold mb-3">Sobre nosotras</div>
              <h2 className="font-serif font-semibold mb-4" style={{ fontSize: 'clamp(28px,5vw,40px)' }}>
                {s.about_title || 'Belleza con identidad'}
              </h2>
              <GoldDivider />
              <p className="text-text-secondary leading-relaxed font-light mt-4 whitespace-pre-line">
                {s.about_text ||
                  `En ${brand} creemos que cada clienta merece sentirse única. Combinamos técnica, productos de alta calidad y un ambiente acogedor para que tu visita sea siempre una experiencia especial.`}
              </p>
              <div className="flex flex-wrap gap-3 mt-6">
                <button onClick={() => setBookingOpen(true)} className="bg-gold text-[#0d0c0a] px-6 py-2.5 rounded-lg font-bold hover:opacity-90 transition cursor-pointer">Reservar cita</button>
                <a href="#contacto" className="border border-border-strong px-6 py-2.5 rounded-lg font-medium hover:border-gold transition cursor-pointer">Contáctanos</a>
              </div>
            </div>
          </div>
        </section>

        <section id="contacto" className="px-4 py-20 sm:px-10 bg-bg-card scroll-mt-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <div className="text-[11px] uppercase tracking-widest text-gold mb-3">Estamos para ti</div>
              <h2 className="font-serif font-semibold mb-2" style={{ fontSize: 'clamp(28px,5vw,40px)' }}>Contáctanos</h2>
              <p className="text-text-muted text-sm max-w-md mx-auto">Escríbenos, visítanos o agenda tu cita en línea.</p>
            </div>

            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <ContactCard
                icon="phone"
                title="Teléfono"
                value={s.phone}
                href={s.phone ? `tel:${s.phone.replace(/\s+/g, '')}` : null}
                empty="Próximamente"
              />
              <ContactCard
                icon="whatsapp"
                title="WhatsApp"
                value={s.whatsapp ? `+${s.whatsapp}` : null}
                href={s.whatsapp ? `https://wa.me/${s.whatsapp}` : null}
                external
                empty="Próximamente"
              />
              <ContactCard
                icon="mail"
                title="Email"
                value={s.email}
                href={s.email ? `mailto:${s.email}` : null}
                empty="Próximamente"
              />
              <ContactCard
                icon="map"
                title="Dirección"
                value={[s.address, s.city].filter(Boolean).join(' · ') || null}
                href={s.google_maps_url || null}
                external
                empty="Próximamente"
              />
            </div>

            {(s.hours_weekday || s.hours_saturday || s.hours_sunday) && (
              <div className="mt-8 bg-bg-elevated border border-border rounded-2xl p-6 max-w-2xl mx-auto">
                <div className="flex items-center gap-2 mb-4">
                  <Icon name="clock" size={18} color="var(--gold)" />
                  <h3 className="font-serif text-lg font-semibold">Horario de atención</h3>
                </div>
                <dl className="grid gap-2 text-sm">
                  {s.hours_weekday && <Row term="Lunes a Viernes" desc={s.hours_weekday} />}
                  {s.hours_saturday && <Row term="Sábados" desc={s.hours_saturday} />}
                  {s.hours_sunday && <Row term="Domingos" desc={s.hours_sunday} />}
                </dl>
              </div>
            )}

            {(s.instagram_url || s.facebook_url || s.tiktok_url) && (
              <div className="flex justify-center gap-3 mt-8">
                {s.instagram_url && <SocialBtn href={s.instagram_url} icon="instagram" label="Instagram" />}
                {s.facebook_url  && <SocialBtn href={s.facebook_url}  icon="facebook"  label="Facebook" />}
                {s.tiktok_url    && <SocialBtn href={s.tiktok_url}    icon="tiktok"    label="TikTok" />}
              </div>
            )}

            <div className="text-center mt-10">
              <button onClick={() => setBookingOpen(true)} className="bg-gold text-[#0d0c0a] px-7 py-3 rounded-lg font-bold shadow-lg shadow-gold/20 hover:-translate-y-0.5 motion-reduce:transform-none transition cursor-pointer">
                Reservar mi cita
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-10 px-4 sm:px-10 bg-[var(--sidebar-bg)]">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-between gap-3 items-center">
          <div>
            <div className="font-serif text-xl text-gold font-bold">{brand}</div>
            <div className="text-xs text-text-muted mt-1">{s.tagline || 'Salón de Belleza Premium'}</div>
          </div>
          <div className="text-xs text-text-muted">© {new Date().getFullYear()} {brand}.</div>
        </div>
      </footer>

      <Modal open={bookingOpen} onClose={() => setBookingOpen(false)} title="Reservar Cita">
        <BookingForm onClose={() => setBookingOpen(false)} settings={settings} />
      </Modal>
    </div>
  );
}

function ContactCard({ icon, title, value, href, external, empty }) {
  const isEmpty = !value;
  const inner = (
    <div className={`h-full bg-bg-elevated border border-border rounded-2xl p-5 transition ${href ? 'hover:border-gold/50 hover:-translate-y-0.5 motion-reduce:transform-none cursor-pointer' : ''}`}>
      <div className="w-10 h-10 rounded-lg grid place-items-center bg-gold-dim border border-border-strong text-gold mb-3">
        <Icon name={icon} size={18} />
      </div>
      <div className="text-[11px] uppercase tracking-widest text-text-muted">{title}</div>
      <div className={`mt-1 font-medium text-sm break-words ${isEmpty ? 'text-text-muted italic' : 'text-text-primary'}`}>
        {value || empty}
      </div>
    </div>
  );
  if (!href) return inner;
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      aria-label={`${title}: ${value}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 rounded-2xl"
    >
      {inner}
    </a>
  );
}

function SocialBtn({ href, icon, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="w-11 h-11 rounded-full border border-border-strong text-text-secondary grid place-items-center hover:text-gold hover:border-gold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
    >
      <Icon name={icon} size={18} />
    </a>
  );
}

function Row({ term, desc }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border last:border-0 pb-2 last:pb-0">
      <dt className="text-text-muted">{term}</dt>
      <dd className="text-text-primary font-medium">{desc}</dd>
    </div>
  );
}

function BookingForm({ onClose, defaultService, settings }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ name: '', phone: '', service: defaultService || '', date: today, time: '' });
  const [services, setServices] = useState(null); // null = loading
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { api_services.listPublic().then(({ data }) => setServices(data || [])); }, []);

  const submit = async () => {
    setErr('');
    setSubmitting(true);
    try {
      const svc = (services || []).find(x => x.name === form.service);
      const res = await api_appointments.create({
        service_id: svc?.id, date: form.date, time: form.time,
        duration: svc?.duration || 60, status: 'pending',
        notes: `Cliente web: ${form.name} · ${form.phone}`,
      });
      if (res.error) throw res.error;
      setDone(true);
      if (settings?.whatsapp) {
        const fmtDate = new Date(form.date + 'T00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
        const msg = `Hola! Acabo de reservar una cita por la web.%0A%0A• Nombre: ${form.name}%0A• Teléfono: ${form.phone}%0A• Servicio: ${form.service}%0A• Fecha: ${fmtDate}%0A• Hora: ${form.time}%0A%0A¿Me la pueden confirmar?`;
        window.open(`https://wa.me/${settings.whatsapp}?text=${msg}`, '_blank', 'noopener');
      }
    } catch (e) {
      setErr(e.message || 'No se pudo reservar');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return (
    <div className="text-center py-4">
      <div className="w-16 h-16 rounded-full bg-green-500/15 grid place-items-center mx-auto mb-4">
        <Icon name="check" size={28} color="#6db86d" />
      </div>
      <h3 className="font-serif text-xl mb-2">¡Cita Reservada!</h3>
      <p className="text-text-secondary text-sm mb-5">
        {settings?.whatsapp ? 'Abrimos WhatsApp para que confirmes con el salón.' : 'Te contactaremos para confirmar.'}
      </p>
      <Btn onClick={onClose}>Cerrar</Btn>
    </div>
  );

  const canContinue = form.name && form.service;
  const canConfirm = form.date && form.time && !submitting;

  return (
    <div>
      <div className="flex gap-2 mb-5" aria-label={`Paso ${step} de 2`}>
        {[1, 2].map(n => <div key={n} className={`flex-1 h-1 rounded ${n <= step ? 'bg-gold' : 'bg-border'}`} />)}
      </div>
      {step === 1 ? (
        <>
          <Field label="Nombre completo"><Input value={form.name}    onChange={e => setForm({...form, name: e.target.value})}    placeholder="Tu nombre" /></Field>
          <Field label="Teléfono">       <Input value={form.phone}   onChange={e => setForm({...form, phone: e.target.value})}   placeholder="+57 300 000 0000" type="tel" /></Field>
          <Field label="Servicio">
            <Select value={form.service} onChange={e => setForm({...form, service: e.target.value})}
              options={services === null
                ? [{ value: '', label: 'Cargando servicios…' }]
                : [{ value: '', label: 'Selecciona un servicio' }, ...services.map(x => ({ value: x.name, label: x.name }))]} />
          </Field>
          <Btn onClick={() => canContinue && setStep(2)} disabled={!canContinue}>Continuar →</Btn>
        </>
      ) : (
        <>
          <Field label="Fecha"><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></Field>
          <Field label="Hora"> <Input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} /></Field>

          {err && (
            <div role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
              {err}
            </div>
          )}

          <div className="flex gap-2.5">
            <Btn variant="ghost" onClick={() => setStep(1)} disabled={submitting}>← Atrás</Btn>
            <Btn onClick={submit} loading={submitting} disabled={!form.date || !form.time}>{submitting ? 'Reservando…' : 'Confirmar Cita'}</Btn>
          </div>
        </>
      )}
    </div>
  );
}
