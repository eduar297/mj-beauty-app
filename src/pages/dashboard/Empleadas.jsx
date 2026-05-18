import { useEffect, useState } from 'react';
import { Header } from '../Dashboard.jsx';
import { Icon, Btn, Avatar, Modal, Field, Input, Select } from '../../components/ui.jsx';
import { api_staff } from '../../lib/api';

export default function Empleadas() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = () => api_staff.list().then(({data}) => setList(data || []));
  useEffect(() => { load(); }, []);

  return (
    <div>
      <Header title="Empleadas" subtitle="Equipo MJ Beauty"
        action={<Btn icon="plus" onClick={() => setEditing({})}>Agregar</Btn>} />

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {list.map(s => (
          <div key={s.id} className="bg-bg-card border border-border rounded-2xl p-5 text-center cursor-pointer hover:-translate-y-0.5 transition" onClick={() => setEditing({...s})}>
            <Avatar initials={s.initials || s.name?.[0]} color={s.color} size={56} />
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

      {editing && <Modal open={true} onClose={() => setEditing(null)} title={editing.id ? editing.name : 'Agregar Empleada'}>
        <StaffForm initial={editing} onSaved={() => { setEditing(null); load(); }}
          onDelete={editing.id ? async () => { await api_staff.remove(editing.id); setEditing(null); load(); } : null} />
      </Modal>}
    </div>
  );
}

function StaffForm({ initial, onSaved, onDelete }) {
  const [f, setF] = useState({ name:'', role:'empleada', pin:'', email:'', color:'#c9a96e', schedule:'', specialties:[], ...initial });
  const submit = async () => {
    const data = { ...f, initials: (f.name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() };
    delete data.created_at;
    if (f.id) await api_staff.update(f.id, data);
    else await api_staff.create(data);
    onSaved();
  };
  return (
    <div>
      <Field label="Nombre"><Input value={f.name} onChange={e=>setF({...f, name:e.target.value})} /></Field>
      <Field label="Rol">
        <Select value={f.role} onChange={e=>setF({...f, role:e.target.value})}
          options={[{value:'empleada',label:'Empleada'},{value:'admin',label:'Administrador/a'}]} />
      </Field>
      <Field label="PIN (4-6 dígitos)"><Input value={f.pin} onChange={e=>setF({...f, pin:e.target.value.replace(/\D/g,'').slice(0,6)})} placeholder="1234" /></Field>
      <Field label="Email"><Input type="email" value={f.email||''} onChange={e=>setF({...f, email:e.target.value})} /></Field>
      <Field label="Color (hex)"><Input value={f.color||'#c9a96e'} onChange={e=>setF({...f, color:e.target.value})} placeholder="#c9a96e" /></Field>
      <Field label="Horario"><Input value={f.schedule||''} onChange={e=>setF({...f, schedule:e.target.value})} placeholder="Lun–Sáb 9am–6pm" /></Field>
      <Field label="Especialidades (coma)">
        <Input value={(f.specialties||[]).join(', ')} onChange={e=>setF({...f, specialties:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} placeholder="Uñas, Pestañas" />
      </Field>
      <div className="flex gap-2.5 pt-3 border-t border-border">
        {onDelete && <Btn variant="ghost" onClick={onDelete}>Desactivar</Btn>}
        <Btn icon="check" onClick={submit} disabled={!f.name || !f.pin || f.pin.length < 4}>{f.id ? 'Guardar' : 'Crear'}</Btn>
      </div>
    </div>
  );
}
