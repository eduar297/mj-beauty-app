import { useEffect, useRef, useState } from 'react';
import { Header } from '../Dashboard.jsx';
import { Icon, Btn, Field, Input, Textarea, ListLoading, Spinner } from '../../components/ui.jsx';
import PhotoCropEditor, { ASPECT_LANDING_CARD } from '../../components/PhotoCropEditor.jsx';
import { api_settings, api_services } from '../../lib/api';

const EMPTY = {
  business_name: '',
  tagline: '',
  about_title: '',
  about_text: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  city: '',
  hours_weekday: '',
  hours_saturday: '',
  hours_sunday: '',
  instagram_url: '',
  facebook_url: '',
  tiktok_url: '',
  google_maps_url: '',
  service_cat_photos: {},
  closed_weekdays: [0, 6],   // domingo y sábado cerrados por defecto
};

// Días de la semana, en el orden en que se leen (lunes primero).
// El número es el que usa JS: 0=domingo … 6=sábado.
const WEEKDAYS = [
  { n: 1, label: 'Lun' }, { n: 2, label: 'Mar' }, { n: 3, label: 'Mié' },
  { n: 4, label: 'Jue' }, { n: 5, label: 'Vie' }, { n: 6, label: 'Sáb' },
  { n: 0, label: 'Dom' },
];

// Categorías de servicio que se muestran en la landing (cat interno + label + fallback).
const SERVICE_CATS = [
  { cat: 'Uñas',     label: 'Uñas',     fallback: '/assets/svc-nails.jpeg' },
  { cat: 'Pedicura', label: 'Pedicura', fallback: '/assets/svc-pedicure.jpeg' },
  { cat: 'Pelo',     label: 'Cabello',  fallback: '/assets/svc-hair.jpeg' },
  { cat: 'Faciales', label: 'Faciales', fallback: '/assets/svc-facial.jpeg' },
  { cat: 'Cejas',    label: 'Cejas',    fallback: '/assets/svc-cejas.jpeg' },
  { cat: 'Pestañas', label: 'Pestañas', fallback: '/assets/svc-pestanas.jpeg' },
];

export default function Configuracion() {
  const [f, setF] = useState(null); // null = loading
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  // Edición de fotos de portada de categoría.
  const [editingCat, setEditingCat] = useState(null);   // cat que se está reemplazando
  const [pendingFile, setPendingFile] = useState(null); // archivo elegido, esperando crop
  const [uploadingCat, setUploadingCat] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    api_settings.get().then(({ data }) => setF({ ...EMPTY, ...(data || {}) }));
  }, []);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const pickCatPhoto = (cat) => { setEditingCat(cat); fileRef.current?.click(); };
  const onCatFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-elegir el mismo archivo
    if (file) setPendingFile(file);
  };
  const uploadCatPhoto = async (croppedFile) => {
    const cat = editingCat;
    setUploadingCat(cat);
    try {
      const url = await api_services.uploadPhoto(croppedFile, `categoria-${cat}`);
      setF(prev => ({ ...prev, service_cat_photos: { ...(prev.service_cat_photos || {}), [cat]: url } }));
    } catch (e2) {
      alert('Error subiendo foto: ' + (e2.message || e2));
    } finally {
      setUploadingCat(null);
    }
  };
  const resetCatPhoto = (cat) =>
    setF(prev => {
      const next = { ...(prev.service_cat_photos || {}) };
      delete next[cat];
      return { ...prev, service_cat_photos: next };
    });

  const submit = async (e) => {
    e?.preventDefault();
    if (!f) return;
    setErr('');
    setSaving(true);
    try {
      const { id, created_at, updated_at, ...payload } = f;
      const res = await api_settings.update(payload);
      if (res.error) throw res.error;
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3000);
    } catch (e2) {
      setErr(e2.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Header
        title="Personalización"
        subtitle="Edita la información pública del sitio web"
        action={
          <Btn type="submit" icon="save" onClick={submit} loading={saving} disabled={!f}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Btn>
        }
      />

      {savedAt && (
        <div role="status" aria-live="polite" className="mb-5 px-4 py-3 rounded-lg text-sm border bg-green-500/10 border-green-500/30 text-green-400">
          Guardado · cambios visibles en la web
        </div>
      )}
      {err && (
        <div role="alert" className="mb-5 px-4 py-3 rounded-lg text-sm border bg-red-500/10 border-red-500/30 text-red-400">
          {err}
        </div>
      )}

      {f === null ? (
        <ListLoading label="Cargando configuración…" />
      ) : (
        <div>
          <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            <Card icon="info" title="Identidad" subtitle="Cómo se llama tu negocio">
              <Field label="Nombre del negocio"><Input value={f.business_name} onChange={set('business_name')} placeholder="MJ Beauty" /></Field>
              <Field label="Eslogan / tagline"><Input value={f.tagline} onChange={set('tagline')} placeholder="Salón de Belleza Premium" /></Field>
            </Card>

            <Card icon="sparkle" title="Sección Nosotras" subtitle="Texto que aparece en la web">
              <Field label="Título"><Input value={f.about_title} onChange={set('about_title')} placeholder="Sobre Nosotras" /></Field>
              <Field label="Descripción">
                <Textarea
                  rows={6}
                  value={f.about_text}
                  onChange={set('about_text')}
                  placeholder="Cuenta tu historia, qué te hace especial, cuántos años de experiencia…"
                />
              </Field>
            </Card>

            <Card icon="phone" title="Contacto" subtitle="Para que tus clientas te encuentren">
              <Field label="Teléfono"><Input value={f.phone} onChange={set('phone')} placeholder="+57 300 000 0000" /></Field>
              <Field label="WhatsApp (solo números, con código país)"><Input value={f.whatsapp} onChange={set('whatsapp')} placeholder="573000000000" /></Field>
              <Field label="Email"><Input type="email" value={f.email} onChange={set('email')} placeholder="hola@mjbeauty.com" /></Field>
            </Card>

            <Card icon="map" title="Ubicación" subtitle="Dónde estás">
              <Field label="Dirección"><Input value={f.address} onChange={set('address')} placeholder="Cra 10 # 20-30, Local 4" /></Field>
              <Field label="Ciudad"><Input value={f.city} onChange={set('city')} placeholder="Bogotá, Colombia" /></Field>
              <Field label="Google Maps (URL)"><Input value={f.google_maps_url} onChange={set('google_maps_url')} placeholder="https://maps.google.com/…" /></Field>
            </Card>

            <Card icon="clock" title="Horario" subtitle="Días y horas de atención">
              {/* Qué días se puede reservar. Los apagados quedan bloqueados
                  en la página pública (típico: sábado y domingo cerrados). */}
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Días que abrimos
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {WEEKDAYS.map(({ n, label }) => {
                    const closed = (f.closed_weekdays || []).includes(n);
                    return (
                      <button key={n} type="button"
                        aria-pressed={!closed}
                        onClick={() => {
                          const cur = f.closed_weekdays || [];
                          setF({
                            ...f,
                            closed_weekdays: closed ? cur.filter(x => x !== n) : [...cur, n],
                          });
                        }}
                        className={`w-12 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                          closed
                            ? 'bg-bg-elevated border-border text-text-muted line-through'
                            : 'bg-gold-dim border-gold/50 text-gold'
                        }`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-text-muted mt-2">
                  Los días apagados no aparecen para reservar. Para cerrar un día suelto
                  (feriado, vacaciones) usa "Cerrar día" en la Agenda.
                </div>
              </div>

              <Field label="Lunes a Viernes"><Input value={f.hours_weekday} onChange={set('hours_weekday')} placeholder="9:00 AM – 7:00 PM" /></Field>
              <Field label="Sábados"><Input value={f.hours_saturday} onChange={set('hours_saturday')} placeholder="9:00 AM – 5:00 PM" /></Field>
              <Field label="Domingos"><Input value={f.hours_sunday} onChange={set('hours_sunday')} placeholder="Cerrado" /></Field>
            </Card>

            <Card icon="instagram" title="Redes sociales" subtitle="Enlaces opcionales">
              <Field label="Instagram"><Input value={f.instagram_url} onChange={set('instagram_url')} placeholder="https://instagram.com/mjbeauty" /></Field>
              <Field label="Facebook"><Input value={f.facebook_url} onChange={set('facebook_url')} placeholder="https://facebook.com/mjbeauty" /></Field>
              <Field label="TikTok"><Input value={f.tiktok_url} onChange={set('tiktok_url')} placeholder="https://tiktok.com/@mjbeauty" /></Field>
            </Card>
          </div>

          <section className="bg-bg-card border border-border rounded-2xl p-5 mt-5">
            <header className="flex items-center gap-2.5 mb-1 pb-3 border-b border-border">
              <div className="w-9 h-9 rounded-lg grid place-items-center bg-gold-dim text-gold border border-border-strong">
                <Icon name="scissors" size={16} />
              </div>
              <div className="min-w-0">
                <h2 className="font-serif text-base font-semibold leading-tight">Portadas de categorías</h2>
                <p className="text-[11px] text-text-muted mt-0.5">Las fotos que se ven en "Nuestros Servicios" de la página</p>
              </div>
            </header>

            <div className="grid gap-3 pt-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
              {SERVICE_CATS.map(({ cat, label, fallback }) => {
                const custom = f.service_cat_photos?.[cat];
                const img = custom || fallback;
                const busy = uploadingCat === cat;
                return (
                  <div key={cat} className="rounded-xl border border-border overflow-hidden bg-bg-elevated">
                    <div className="relative aspect-video bg-bg-card">
                      {busy ? (
                        <div className="absolute inset-0 grid place-items-center text-text-muted text-xs gap-1">
                          <Spinner size={16} color="var(--gold)" /> Subiendo…
                        </div>
                      ) : (
                        <img src={img} alt={label} className="w-full h-full object-cover" />
                      )}
                      {custom && !busy && (
                        <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wider bg-gold text-[#0d0c0a] px-1.5 py-0.5 rounded-full">Personalizada</span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <div className="text-sm font-semibold mb-2">{label}</div>
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => pickCatPhoto(cat)} disabled={busy}
                          className="flex-1 text-xs py-1.5 rounded-lg border border-border-strong text-text-secondary hover:border-gold hover:text-gold transition cursor-pointer disabled:opacity-50">
                          Cambiar
                        </button>
                        {custom && (
                          <button type="button" onClick={() => resetCatPhoto(cat)} disabled={busy}
                            aria-label={`Volver a la foto por defecto de ${label}`}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-border text-text-muted hover:text-red-400 hover:border-red-400 transition cursor-pointer disabled:opacity-50">
                            <Icon name="close" size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-text-muted mt-3">
              Recuerda tocar "Guardar cambios" para que las fotos nuevas se publiquen.
            </p>
          </section>

          <div className="flex justify-end mt-6">
            <Btn type="submit" icon="save" onClick={submit} loading={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Btn>
          </div>

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onCatFile} />
          <PhotoCropEditor
            file={pendingFile}
            open={!!pendingFile}
            onClose={() => setPendingFile(null)}
            onApply={uploadCatPhoto}
            aspect={ASPECT_LANDING_CARD}
            label="Ajustar portada de categoría"
          />
        </div>
      )}
    </form>
  );
}

function Card({ icon, title, subtitle, children }) {
  return (
    <section className="bg-bg-card border border-border rounded-2xl p-5">
      <header className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border">
        <div className="w-9 h-9 rounded-lg grid place-items-center bg-gold-dim text-gold border border-border-strong">
          <Icon name={icon} size={16} />
        </div>
        <div className="min-w-0">
          <h2 className="font-serif text-base font-semibold leading-tight">{title}</h2>
          {subtitle && <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}
