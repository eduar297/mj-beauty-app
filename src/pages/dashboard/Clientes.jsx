import { useEffect, useState } from 'react';
import { Header } from '../Dashboard.jsx';
import { Icon, Btn, StatusBadge, Avatar, Modal, Field, Input, Select } from '../../components/ui.jsx';
import { api_clients } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth.jsx';

export default function Clientes() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const isAdmin = user?.role === 'admin';
  const fmt = n => new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n||0);

  const load = () => api_clients.list().then(({data}) => setList(data || []));
  useEffect(() => { load(); }, []);

  const filtered = list.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  );

  return (
    <div>
      <Header title="Clientes" subtitle={`${list.length} registradas`}
        action={isAdmin && <Btn icon="plus" onClick={() => setEditing({})}>Nueva</Btn>} />

      <div className="relative mb-4">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"><Icon name="search" size={15} color="var(--text-muted)" /></div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…"
          className="w-full bg-bg-card border border-border rounded-lg pl-10 pr-3 py-2.5 text-base outline-none focus:border-gold" />
      </div>

      <div className="flex flex-col gap-2.5">
        {filtered.map(c => (
          <div key={c.id} onClick={() => isAdmin && setEditing(c)}
            className="bg-bg-card border border-border rounded-xl p-4 cursor-pointer hover:bg-bg-hover transition">
            <div className="flex items-center gap-3 mb-2">
              <Avatar initials={c.name?.split(' ').map(w=>w[0]).join('').slice(0,2)} size={36} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{c.name}</div>
                <div className="text-xs text-text-muted">{c.phone || c.email || '—'}</div>
              </div>
              <StatusBadge status={c.status} />
            </div>
            <div className="flex gap-4 pt-2 border-t border-border">
              <Stat label="Visitas" value={c.visits || 0} />
              <Stat label="Total" value={fmt(c.spent)} accent />
              <Stat label="Última" value={c.last_visit ? new Date(c.last_visit).toLocaleDateString('es-CO',{day:'numeric',month:'short'}) : '—'} />
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center text-text-muted py-10 text-sm">Sin resultados</div>}
      </div>

      {editing && (
        <Modal open={true} onClose={() => setEditing(null)} title={editing.id ? editing.name : 'Nueva Clienta'}>
          <ClientForm initial={editing} onSaved={() => { setEditing(null); load(); }} />
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <div className="text-[10px] text-text-muted uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${accent ? 'text-gold' : ''}`}>{value}</div>
    </div>
  );
}

function ClientForm({ initial, onSaved }) {
  const [f, setF] = useState({ name:'', phone:'', email:'', notes:'', status:'regular', ...initial });
  const submit = async () => {
    if (f.id) await api_clients.update(f.id, f);
    else await api_clients.create(f);
    onSaved();
  };
  return (
    <div>
      <Field label="Nombre"><Input value={f.name||''} onChange={e=>setF({...f, name:e.target.value})} placeholder="Nombre completo" /></Field>
      <Field label="Teléfono"><Input value={f.phone||''} onChange={e=>setF({...f, phone:e.target.value})} placeholder="+57 …" /></Field>
      <Field label="Email"><Input type="email" value={f.email||''} onChange={e=>setF({...f, email:e.target.value})} placeholder="correo@…" /></Field>
      <Field label="Estado">
        <Select value={f.status} onChange={e=>setF({...f, status:e.target.value})}
          options={[{value:'regular',label:'Regular'},{value:'vip',label:'VIP'},{value:'new',label:'Nueva'}]} />
      </Field>
      <Field label="Notas"><Input value={f.notes||''} onChange={e=>setF({...f, notes:e.target.value})} placeholder="Alergias, preferencias…" /></Field>
      <Btn icon="check" onClick={submit}>{f.id ? 'Guardar cambios' : 'Crear clienta'}</Btn>
    </div>
  );
}
