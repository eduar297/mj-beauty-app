import { useEffect, useState } from 'react';
import { Header } from '../Dashboard.jsx';
import { Icon, Btn, Field, Input, Textarea, ListLoading } from '../../components/ui.jsx';
import { api_settings } from '../../lib/api';

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
};

export default function Configuracion() {
  const [f, setF] = useState(null); // null = loading
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    api_settings.get().then(({ data }) => setF({ ...EMPTY, ...(data || {}) }));
  }, []);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

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

          <div className="flex justify-end mt-6">
            <Btn type="submit" icon="save" onClick={submit} loading={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Btn>
          </div>
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
