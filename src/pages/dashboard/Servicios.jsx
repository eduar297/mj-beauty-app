import { useEffect, useState, useRef } from 'react';
import { Header } from '../Dashboard.jsx';
import { Icon, Btn, Modal, Field, Input, Select, CAT_COLORS, CAT_ICONS } from '../../components/ui.jsx';
import { api_services } from '../../lib/api';

const CATS = ['Uñas','Pelo','Faciales','Cejas','Pestañas'];

export default function Servicios() {
  const [list, setList] = useState([]);
  const [activeCat, setActiveCat] = useState('Uñas');
  const [editing, setEditing] = useState(null);
  const fmt = n => new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n||0);
  const load = () => api_services.list().then(({data}) => setList(data || []));
  useEffect(() => { load(); }, []);
  const filtered = list.filter(s => s.cat === activeCat);

  return (
    <div>
      <Header title="Catálogo de Servicios" subtitle="Precios y duración"
        action={<Btn icon="plus" onClick={() => setEditing({ cat: activeCat, name:'', duration:60, price:0, popular:false, description:'' })}>Nuevo</Btn>} />

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {CATS.map(c => {
          const color = CAT_COLORS[c]; const active = activeCat === c;
          const count = list.filter(s => s.cat === c).length;
          return (
            <button key={c} onClick={() => setActiveCat(c)}
              style={{ background: active ? `${color}22` : 'var(--bg-card)', color: active ? color : 'var(--text-secondary)', borderColor: active ? color+'55' : 'var(--border)' }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm border whitespace-nowrap flex-shrink-0">
              <Icon name={CAT_ICONS[c]} size={13} /> {c}
              <span style={{ background: active ? `${color}30` : 'var(--bg-elevated)' }} className="text-[10px] px-1.5 rounded font-bold">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {filtered.map(s => (
          <div key={s.id} className="bg-bg-card border border-border rounded-2xl overflow-hidden cursor-pointer" onClick={() => setEditing({...s})}>
            <div className="h-24 bg-bg-elevated relative">
              {s.photo_url && <img src={s.photo_url} alt="" className="w-full h-full object-cover" />}
              {s.popular && <div style={{ background: CAT_COLORS[s.cat]+'cc' }} className="absolute top-2 left-2 text-[9px] font-bold text-[#0d0c0a] px-2 py-0.5 rounded-full uppercase">Popular</div>}
            </div>
            <div className="p-3.5">
              <div className="font-semibold text-sm mb-1">{s.name}</div>
              <p className="text-[11px] text-text-muted line-clamp-2 mb-2.5">{s.description}</p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-muted flex items-center gap-1"><Icon name="clock" size={12} /> {s.duration} min</span>
                <span className="font-serif font-bold" style={{ color: CAT_COLORS[s.cat] }}>{fmt(s.price)}</span>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center text-text-muted py-10 text-sm">Sin servicios en {activeCat}</div>}
      </div>

      {editing && <Modal open={true} onClose={() => setEditing(null)} title={editing.id ? editing.name : 'Nuevo Servicio'}>
        <ServiceForm initial={editing} onSaved={() => { setEditing(null); load(); }} onDelete={editing.id ? async () => { await api_services.remove(editing.id); setEditing(null); load(); } : null} />
      </Modal>}
    </div>
  );
}

function ServiceForm({ initial, onSaved, onDelete }) {
  const [f, setF] = useState({ ...initial });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const url = await api_services.uploadPhoto(file, f.name || 'servicio');
      setF(prev => ({ ...prev, photo_url: url }));
    } catch (err) { alert('Error subiendo foto: ' + err.message); }
    setUploading(false);
  };

  const submit = async () => {
    const data = { ...f }; delete data.created_at;
    if (f.id) await api_services.update(f.id, data);
    else await api_services.create(data);
    onSaved();
  };

  return (
    <div>
      <div className="mb-4">
        <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">Foto</label>
        <div onClick={() => fileRef.current.click()} className="h-28 rounded-xl border-2 border-dashed border-border bg-bg-card cursor-pointer relative overflow-hidden grid place-items-center">
          {f.photo_url
            ? <img src={f.photo_url} alt="" className="w-full h-full object-cover" />
            : <div className="text-text-muted text-sm">{uploading ? 'Subiendo…' : 'Toca para subir foto'}</div>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
      </div>
      <Field label="Nombre"><Input value={f.name||''} onChange={e=>setF({...f, name:e.target.value})} placeholder="Ej: Manicure Gel" /></Field>
      <Field label="Categoría">
        <Select value={f.cat} onChange={e=>setF({...f, cat:e.target.value})} options={CATS.map(c => ({value:c, label:c}))} />
      </Field>
      <Field label="Descripción">
        <textarea value={f.description||''} onChange={e=>setF({...f, description:e.target.value})} rows={3}
          className="w-full bg-bg-card border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gold resize-y" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duración (min)"><Input type="number" value={f.duration||60} onChange={e=>setF({...f, duration:+e.target.value})} /></Field>
        <Field label="Precio (COP)"><Input type="number" value={f.price||0} onChange={e=>setF({...f, price:+e.target.value})} /></Field>
      </div>
      <label className="flex items-center gap-2.5 mb-5 cursor-pointer">
        <input type="checkbox" checked={!!f.popular} onChange={e=>setF({...f, popular:e.target.checked})} className="w-4 h-4 accent-gold" />
        <span className="text-sm text-text-secondary">Marcar como popular</span>
      </label>
      <div className="flex gap-2.5 pt-3 border-t border-border">
        {onDelete && <Btn variant="ghost" onClick={onDelete}>Eliminar</Btn>}
        <Btn icon="check" onClick={submit}>{f.id ? 'Guardar' : 'Crear'}</Btn>
      </div>
    </div>
  );
}
