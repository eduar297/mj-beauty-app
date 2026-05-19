import { useEffect, useRef, useState, useMemo } from 'react';
import { Header } from '../Dashboard.jsx';
import { Icon, Btn, Avatar, Modal, Field, Input, Select, ColorPicker, ListLoading, Spinner, TagInput } from '../../components/ui.jsx';
import { api_staff, api_services } from '../../lib/api';

const CATEGORIES = ['Uñas', 'Pedicura', 'Pelo', 'Faciales', 'Cejas', 'Pestañas'];

export default function Empleadas() {
  const [list, setList] = useState(null); // null = loading
  const [services, setServices] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const { data } = await api_staff.list();
    setList(data || []);
  };
  useEffect(() => {
    load();
    api_services.list().then(({ data }) => setServices(data || []));
  }, []);

  // Categorías + nombres de servicios + especialidades ya usadas, sin duplicar.
  const suggestions = useMemo(() => {
    const set = new Set(CATEGORIES);
    for (const s of services) if (s.name) set.add(s.name);
    for (const e of (list || [])) for (const sp of (e.specialties || [])) set.add(sp);
    return Array.from(set);
  }, [services, list]);

  return (
    <div>
      <Header title="Empleadas" subtitle="Equipo MJ Beauty"
        action={<Btn icon="plus" onClick={() => setEditing({})}>Agregar</Btn>} />

      {list === null ? (
        <ListLoading label="Cargando equipo…" />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {list.map(s => (
            <div key={s.id} className="bg-bg-card border border-border rounded-2xl p-5 text-center cursor-pointer hover:-translate-y-0.5 motion-reduce:transform-none transition" onClick={() => setEditing({...s})}>
              <div className="grid place-items-center">
                <Avatar initials={s.initials || s.name?.[0]} color={s.color} size={64} photoUrl={s.photo_url} alt={s.name} />
              </div>
              <div className="font-serif text-base font-semibold mt-3">{s.name}</div>
              <div className="text-xs text-text-muted mt-0.5 capitalize">{s.role}</div>
              {s.schedule && <div className="text-[11px] text-text-muted mt-0.5">{s.schedule}</div>}
              {s.specialties?.length > 0 && (
                <div className="flex justify-center gap-1 mt-2.5 flex-wrap">
                  {s.specialties.map(sp => (
                    <span key={sp} style={{ background: `${s.color}15`, color: s.color, borderColor: `${s.color}33` }}
                      className="text-[10px] px-2 py-0.5 rounded-full border">{sp}</span>
                  ))}
                </div>
              )}
              <div className="text-[10px] text-text-muted mt-3">PIN: <span className="font-mono">{'•'.repeat(s.pin?.length || 4)}</span></div>
            </div>
          ))}
          {list.length === 0 && <div className="col-span-full text-center text-text-muted py-10 text-sm">Sin empleadas</div>}
        </div>
      )}

      {editing && (
        <Modal open={true} onClose={() => setEditing(null)} title={editing.id ? editing.name : 'Agregar Empleada'}>
          <StaffForm initial={editing} suggestions={suggestions} onSaved={() => { setEditing(null); load(); }}
            onDelete={editing.id ? async () => { await api_staff.remove(editing.id); setEditing(null); await load(); } : null} />
        </Modal>
      )}
    </div>
  );
}

function StaffForm({ initial, suggestions, onSaved, onDelete }) {
  const [f, setF] = useState({ name:'', role:'empleada', pin:'', color:'#c9a96e', schedule:'', specialties:[], ...initial });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef();

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const url = await api_staff.uploadPhoto(file, f.name || 'empleada');
      setF(prev => ({ ...prev, photo_url: url }));
    } catch (err) { setErr('Error subiendo foto: ' + err.message); }
    setUploading(false);
  };

  const submit = async () => {
    setErr('');
    setSaving(true);
    try {
      const data = { ...f, initials: (f.name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() };
      delete data.created_at;
      const res = f.id ? await api_staff.update(f.id, data) : await api_staff.create(data);
      if (res.error) throw res.error;
      onSaved();
    } catch (e) {
      setErr(e.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="mb-4 flex flex-col items-center gap-2.5">
        <div onClick={() => !uploading && fileRef.current.click()}
          className="relative w-24 h-24 rounded-full border-2 border-dashed border-border bg-bg-card cursor-pointer overflow-hidden grid place-items-center">
          {uploading
            ? <Spinner size={18} color="var(--gold)" />
            : f.photo_url
              ? <img src={f.photo_url} alt="" className="w-full h-full object-cover" />
              : <div className="text-text-muted text-[10px] text-center px-2 leading-tight">Toca para<br />subir foto</div>}
          {f.photo_url && !uploading && (
            <div className="absolute inset-0 grid place-items-center bg-black/0 hover:bg-black/40 transition opacity-0 hover:opacity-100">
              <Icon name="edit" size={18} color="#fff" />
            </div>
          )}
        </div>
        {f.photo_url && !uploading && (
          <button type="button" onClick={() => setF(p => ({ ...p, photo_url: null }))}
            className="text-[11px] text-text-muted hover:text-red-400 cursor-pointer">
            Quitar foto
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
      </div>

      <Field label="Nombre"><Input value={f.name} onChange={e=>setF({...f, name:e.target.value})} /></Field>
      <Field label="Rol">
        <Select value={f.role} onChange={e=>setF({...f, role:e.target.value})}
          options={[{value:'empleada',label:'Empleada'},{value:'admin',label:'Administrador/a'}]} />
      </Field>
      <Field label="PIN (4 dígitos)">
        <Input value={f.pin} onChange={e=>setF({...f, pin:e.target.value.replace(/\D/g,'').slice(0,4)})} placeholder="1234" />
      </Field>
      <Field label="Color"><ColorPicker value={f.color||'#c9a96e'} onChange={e=>setF({...f, color:e.target.value})} /></Field>
      <Field label="Horario"><Input value={f.schedule||''} onChange={e=>setF({...f, schedule:e.target.value})} placeholder="Lun–Sáb 9am–6pm" /></Field>
      <Field label="Especialidades">
        <TagInput
          value={f.specialties || []}
          onChange={(v) => setF({ ...f, specialties: v })}
          suggestions={suggestions}
          color={f.color}
          placeholder="Escribe o elige una… (Enter o coma para agregar)"
        />
      </Field>

      {err && (
        <div role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
          {err}
        </div>
      )}

      <div className="flex gap-2.5 pt-3 border-t border-border">
        {onDelete && <Btn variant="ghost" onClick={handleDelete} loading={deleting} disabled={saving || uploading}>{deleting ? 'Desactivando…' : 'Desactivar'}</Btn>}
        <Btn icon="check" onClick={submit} loading={saving} disabled={!f.name || !f.pin || f.pin.length < 4 || deleting || uploading}>
          {saving ? (f.id ? 'Guardando…' : 'Creando…') : (f.id ? 'Guardar' : 'Crear')}
        </Btn>
      </div>
    </div>
  );
}
