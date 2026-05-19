import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon, Modal, Field, Input, Select, Btn, ListLoading, CAT_COLORS, CAT_ICONS, BeforeAfterPair, PhotoTile, Lightbox, photosToSlides } from '../components/ui.jsx';
import { api_services, api_service_photos, api_appointments, api_settings } from '../lib/api';

const TODAY = () => new Date().toISOString().slice(0, 10);

export default function Services() {
  const { cat: paramCat } = useParams();
  const nav = useNavigate();
  const cats = ['Uñas', 'Pedicura', 'Pelo', 'Faciales', 'Cejas', 'Pestañas'];
  const [activeCat, setActiveCat] = useState(paramCat || 'Uñas');
  const [services, setServices] = useState(null); // null = loading
  const [photosBy, setPhotosBy] = useState({}); // service_id → photos[]
  const [settings, setSettings] = useState(null);
  const [bookingService, setBookingService] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { slides, index }
  const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  useEffect(() => {
    api_services.listPublic().then(({ data }) => setServices(data || []));
    api_service_photos.listAll().then(({ data }) => {
      const byService = {};
      for (const p of (data || [])) (byService[p.service_id] ??= []).push(p);
      setPhotosBy(byService);
    });
    api_settings.get().then(({ data }) => setSettings(data || {}));
  }, []);

  const openLightboxFor = (serviceId, photoId) => {
    const photos = photosBy[serviceId] || [];
    const { slides, indexFor } = photosToSlides(photos);
    setLightbox({ slides, index: indexFor[photoId] ?? 0 });
  };

  const filtered = (services || []).filter(s => s.cat === activeCat);
  const SVC_IMGS = { 'Uñas': '/assets/svc-nails.png', 'Pedicura': '/assets/svc-nails.png', 'Pelo': '/assets/svc-hair.png', 'Faciales': '/assets/svc-facial.png', 'Cejas': '/assets/svc-cejas.png', 'Pestañas': '/assets/svc-pestanas.png' };

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="sticky top-0 z-10 bg-bg-card/90 backdrop-blur border-b border-border h-16 flex items-center justify-between px-4 sm:px-10 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => nav('/')} className="border border-border rounded-lg px-3 py-1.5 text-xs text-text-secondary flex items-center gap-1 cursor-pointer hover:border-gold transition-colors">
            <Icon name="chevronLeft" size={13} /><span className="hidden sm:inline">Inicio</span>
          </button>
          <div className="font-serif font-semibold truncate" style={{ fontSize: 'clamp(16px,3vw,20px)' }}>
            Nuestros <span className="text-gold italic">Servicios</span>
          </div>
        </div>
        <button onClick={() => setBookingService('')} className="bg-gold text-[#0d0c0a] px-4 py-2 rounded-lg text-sm font-bold flex-shrink-0 cursor-pointer hover:opacity-90 transition">Reservar</button>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-10 py-8">
        <div className="flex gap-2 mb-7 overflow-x-auto pb-1">
          {cats.map(c => {
            const color = CAT_COLORS[c]; const active = activeCat === c;
            return (
              <button key={c} onClick={() => setActiveCat(c)}
                style={{ background: active ? `${color}22` : 'var(--bg-card)', color: active ? color : 'var(--text-secondary)', borderColor: active ? color + '55' : 'var(--border)' }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm border whitespace-nowrap flex-shrink-0 cursor-pointer">
                <Icon name={CAT_ICONS[c]} size={14} color={active ? color : 'var(--text-muted)'} />
                {c}
              </button>
            );
          })}
        </div>

        {services === null ? (
          <ListLoading label="Cargando servicios…" />
        ) : (
          <div className="grid gap-4 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 340px))' }}>
            {filtered.map(s => {
              const color = CAT_COLORS[s.cat];
              return (
                <div key={s.id} className="bg-bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-1 motion-reduce:transform-none transition group">
                  <div className="h-40 overflow-hidden relative">
                    <img src={s.photo_url || SVC_IMGS[s.cat]} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 motion-reduce:transform-none transition" />
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
                    <ServicePhotoStrip photos={photosBy[s.id]} onOpen={(photoId) => openLightboxFor(s.id, photoId)} />
                    <button onClick={() => setBookingService(s.name)}
                      style={{ background: `${color}22`, borderColor: `${color}44`, color }}
                      className="w-full py-2 rounded-lg text-xs font-bold border cursor-pointer hover:opacity-90 transition">Reservar</button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-text-muted py-12">Aún no hay servicios en esta categoría.</div>
            )}
          </div>
        )}
      </div>

      <Modal open={bookingService !== null} onClose={() => setBookingService(null)} title="Reservar Cita">
        {bookingService !== null && (
          <SimpleBooking
            defaultService={bookingService}
            services={services || []}
            settings={settings}
            onClose={() => setBookingService(null)}
          />
        )}
      </Modal>

      <Lightbox open={!!lightbox} onClose={() => setLightbox(null)} slides={lightbox?.slides || []} index={lightbox?.index || 0} />
    </div>
  );
}

function ServicePhotoStrip({ photos, onOpen }) {
  if (!photos || photos.length === 0) return null;
  const MAX = 4;
  const visible = photos.slice(0, MAX);
  const extra = photos.length - visible.length;
  return (
    <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
      {visible.map((p, i) => (
        <button key={p.id} type="button" onClick={() => onOpen(p.id)}
          className="relative flex-shrink-0 rounded-lg overflow-hidden border border-border bg-bg-elevated cursor-pointer hover:border-gold/50 transition"
          style={{ width: p.kind === 'pair' ? 96 : 56, height: 56 }}
          aria-label="Ver foto">
          {p.kind === 'pair' ? (
            <div className="grid grid-cols-2 gap-px bg-border w-full h-full">
              <img src={p.before_url} alt="Antes" loading="lazy" className="w-full h-full object-cover" />
              <img src={p.after_url} alt="Después" loading="lazy" className="w-full h-full object-cover" />
            </div>
          ) : (
            <img src={p.url} alt="" loading="lazy" className="w-full h-full object-cover" />
          )}
          {p.kind === 'combined' && (
            <span className="absolute bottom-0 inset-x-0 bg-bg-card/85 text-gold text-[8px] font-bold text-center uppercase tracking-wider py-0.5">A/D</span>
          )}
          {i === visible.length - 1 && extra > 0 && (
            <span className="absolute inset-0 bg-black/55 text-text-primary text-xs font-bold grid place-items-center">+{extra}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function SimpleBooking({ defaultService, services, settings, onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', service: defaultService || '', date: TODAY(), time: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    setSubmitting(true);
    try {
      const svc = services.find(s => s.name === form.service);
      const res = await api_appointments.create({
        service_id: svc?.id,
        date: form.date,
        time: form.time,
        duration: svc?.duration || 60,
        status: 'pending',
        notes: `Cliente web: ${form.name} · ${form.phone}`,
      });
      if (res.error) throw res.error;
      setDone(true);
      // Si hay WhatsApp configurado, abre chat con mensaje pre-armado
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

  return (
    <>
      <Field label="Nombre"><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Tu nombre" /></Field>
      <Field label="Teléfono"><Input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+57 300 000 0000" /></Field>
      <Field label="Servicio">
        <Select value={form.service} onChange={e => setForm({...form, service: e.target.value})}
          options={[{value:'',label:'Selecciona'}, ...services.map(s => ({value:s.name,label:s.name}))]} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha"><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></Field>
        <Field label="Hora"><Input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} /></Field>
      </div>

      {err && (
        <div role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
          {err}
        </div>
      )}

      <Btn onClick={submit} loading={submitting} disabled={!form.name || !form.service || !form.date || !form.time}>
        {submitting ? 'Reservando…' : 'Confirmar'}
      </Btn>
    </>
  );
}
