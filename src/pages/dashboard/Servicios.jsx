import { useEffect, useState, useRef } from 'react';
import { Header } from '../Dashboard.jsx';
import { Icon, Btn, Modal, Field, Input, Select, ListLoading, Spinner, CAT_COLORS, CAT_ICONS, BeforeAfterPair, PhotoTile } from '../../components/ui.jsx';
import PhotoCropEditor, { ASPECT_LANDING_CARD } from '../../components/PhotoCropEditor.jsx';
import { api_services, api_service_photos } from '../../lib/api';
import { fmtMoney } from '../../lib/money';
import {
  DndContext, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, rectSortingStrategy,
  useSortable, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const CATS = ['Uñas','Pedicura','Pelo','Faciales','Cejas','Pestañas'];

export default function Servicios() {
  const [list, setList] = useState(null); // null = loading
  const [activeCat, setActiveCat] = useState('Uñas');
  const [editing, setEditing] = useState(null);
  const [reorderMode, setReorderMode] = useState(false);
  const fmt = fmtMoney;

  const load = async () => {
    const { data } = await api_services.list();
    setList(data || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = (list || []).filter(s => s.cat === activeCat);

  // Sensores: pointer (mouse) requiere desplazamiento mínimo para no romper
  // los taps; touch requiere mantener presionado 200ms para distinguir scroll.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filtered.findIndex(s => s.id === active.id);
    const newIndex = filtered.findIndex(s => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    // Reordenar localmente para feedback inmediato
    const newOrderForCat = arrayMove(filtered, oldIndex, newIndex);
    // Aplicar al estado global manteniendo el resto de categorías intactas
    setList(prev => {
      const others = (prev || []).filter(s => s.cat !== activeCat);
      // Reasignar sort_order localmente para que coincida con la BD
      const updated = newOrderForCat.map((s, i) => ({ ...s, sort_order: i }));
      return [...others, ...updated];
    });
    // Persistir en background
    try { await api_services.reorder(newOrderForCat.map(s => s.id)); }
    catch (e) { console.error('Error al reordenar:', e); load(); /* re-sync */ }
  };

  return (
    <div>
      <Header title="Catálogo de Servicios" subtitle="Precios y duración"
        action={
          <div className="flex gap-2">
            <button onClick={() => setReorderMode(m => !m)}
              className={`px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition ${
                reorderMode
                  ? 'bg-gold text-[#0d0c0a] border-gold'
                  : 'bg-bg-card border-border-strong text-text-secondary hover:border-gold hover:text-gold'
              }`}>
              {reorderMode ? 'Listo' : 'Reordenar'}
            </button>
            <Btn icon="plus" onClick={() => setEditing({ cat: activeCat, name:'', duration:60, price:0, popular:false, description:'' })}>Nuevo</Btn>
          </div>
        } />

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {CATS.map(c => {
          const color = CAT_COLORS[c]; const active = activeCat === c;
          const count = (list || []).filter(s => s.cat === c).length;
          return (
            <button key={c} onClick={() => setActiveCat(c)}
              style={{ background: active ? `${color}22` : 'var(--bg-card)', color: active ? color : 'var(--text-secondary)', borderColor: active ? color+'55' : 'var(--border)' }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm border whitespace-nowrap flex-shrink-0 cursor-pointer">
              <Icon name={CAT_ICONS[c]} size={13} /> {c}
              <span style={{ background: active ? `${color}30` : 'var(--bg-elevated)' }} className="text-[10px] px-1.5 rounded font-bold">{count}</span>
            </button>
          );
        })}
      </div>

      {reorderMode && (
        <div className="mb-3 text-xs text-text-muted bg-gold/10 border border-gold/30 rounded-lg px-3 py-2">
          Modo reordenar activo — arrastra las tarjetas para cambiar el orden. Los cambios se guardan automáticamente.
        </div>
      )}

      {list === null ? (
        <ListLoading label="Cargando servicios…" />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map(s => s.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {filtered.map(s => (
                <SortableServiceCard key={s.id} service={s} fmt={fmt}
                  reorderMode={reorderMode}
                  onClick={() => !reorderMode && setEditing({ ...s })} />
              ))}
              {filtered.length === 0 && <div className="col-span-full text-center text-text-muted py-10 text-sm">Sin servicios en {activeCat}</div>}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editing && (
        <Modal open={true} onClose={() => setEditing(null)} title={editing.id ? editing.name : 'Nuevo Servicio'}>
          <ServiceForm
            initial={editing}
            onSaved={() => { setEditing(null); load(); }}
            onDelete={editing.id ? async () => { await api_services.remove(editing.id); setEditing(null); await load(); } : null}
          />
        </Modal>
      )}
    </div>
  );
}

// Tarjeta de servicio sortable. En modo normal el click abre el editor;
// en modo reordenar muestra una manija y el drag mueve la tarjeta.
function SortableServiceCard({ service: s, fmt, reorderMode, onClick }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: s.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };
  // En modo reordenar todo el card es la manija; sin modo, solo abre el editor.
  return (
    <div ref={setNodeRef} style={style}
      {...(reorderMode ? { ...attributes, ...listeners } : {})}
      onClick={!reorderMode ? onClick : undefined}
      className={`bg-bg-card border rounded-2xl overflow-hidden transition relative ${
        reorderMode
          ? 'border-gold/40 cursor-grab active:cursor-grabbing touch-none select-none ring-2 ring-gold/20'
          : 'border-border cursor-pointer hover:-translate-y-0.5 motion-reduce:transform-none'
      } ${isDragging ? 'shadow-2xl' : ''}`}>
      {reorderMode && (
        <div className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-gold text-[#0d0c0a] grid place-items-center shadow-md pointer-events-none">
          <Icon name="menu" size={14} />
        </div>
      )}
      <div className="h-24 bg-bg-elevated relative">
        {s.photo_url && <img src={s.photo_url} alt="" loading="lazy" draggable={false} className="w-full h-full object-cover" />}
        {s.popular && <div style={{ background: CAT_COLORS[s.cat] + 'cc' }} className="absolute top-2 left-2 text-[9px] font-bold text-[#0d0c0a] px-2 py-0.5 rounded-full uppercase">Popular</div>}
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
  );
}

function ServiceForm({ initial, onSaved, onDelete }) {
  const [f, setF] = useState({ ...initial });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');
  const [pendingFile, setPendingFile] = useState(null); // file elegido, esperando crop
  const fileRef = useRef();

  // El admin elige una foto → abre el crop editor. La subida real ocurre cuando
  // aplica el crop (uploadCropped abajo). Así controla exactamente cómo se
  // verá la foto en la landing antes de subirla.
  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-seleccionar el mismo archivo si cancela
    if (!file) return;
    setPendingFile(file);
  };

  const uploadCropped = async (croppedFile) => {
    setUploading(true);
    try {
      const url = await api_services.uploadPhoto(croppedFile, f.name || 'servicio');
      setF(prev => ({ ...prev, photo_url: url }));
    } catch (err) { alert('Error subiendo foto: ' + err.message); }
    setUploading(false);
  };

  const submit = async () => {
    setErr('');
    setSaving(true);
    try {
      const data = {
        ...f,
        duration: Number(f.duration) || 60,
        price: Number(f.price) || 0,
        duration_max: f.duration_max === '' || f.duration_max == null ? null : Number(f.duration_max),
        price_max: f.price_max === '' || f.price_max == null ? null : Number(f.price_max),
      };
      delete data.created_at;
      const res = f.id ? await api_services.update(f.id, data) : await api_services.create(data);
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
      <div className="mb-4">
        <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">Foto</label>
        <div onClick={() => !uploading && fileRef.current.click()} className="h-28 rounded-xl border-2 border-dashed border-border bg-bg-card cursor-pointer relative overflow-hidden grid place-items-center">
          {f.photo_url && !uploading
            ? <img src={f.photo_url} alt="" className="w-full h-full object-cover" />
            : uploading
              ? <div className="text-text-muted text-sm inline-flex items-center gap-2"><Spinner size={14} color="var(--gold)" /> Subiendo…</div>
              : <div className="text-text-muted text-sm">Toca para subir foto</div>}
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
        <Field label="Duración mín (min)">
          <Input type="number" value={f.duration ?? ''}
            onChange={e=>setF({...f, duration: e.target.value === '' ? '' : Number(e.target.value)})} />
        </Field>
        <Field label="Duración máx (opcional)">
          <Input type="number" value={f.duration_max ?? ''}
            onChange={e=>setF({...f, duration_max: e.target.value === '' ? '' : Number(e.target.value)})}
            placeholder="Deja vacío si es fijo" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio mín (USD)">
          <Input type="number" step="0.01" min="0" value={f.price ?? ''}
            placeholder="Ej: 9.99"
            onChange={e=>setF({...f, price: e.target.value === '' ? '' : Number(e.target.value)})} />
        </Field>
        <Field label="Precio máx (opcional)">
          <Input type="number" step="0.01" min="0" value={f.price_max ?? ''}
            onChange={e=>setF({...f, price_max: e.target.value === '' ? '' : Number(e.target.value)})}
            placeholder="Deja vacío si es fijo" />
        </Field>
      </div>
      <div className="text-[11px] text-text-muted -mt-2 mb-3">
        Si llenas los campos "máx", se mostrará un rango (ej: "30–60 min", "$50 — $80"). La duración mín es la que se usa para reservar.
      </div>
      <label className="flex items-center gap-2.5 mb-5 cursor-pointer">
        <input type="checkbox" checked={!!f.popular} onChange={e=>setF({...f, popular:e.target.checked})} className="w-4 h-4 accent-gold" />
        <span className="text-sm text-text-secondary">Marcar como popular</span>
      </label>

      {err && (
        <div role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
          {err}
        </div>
      )}

      <div className="flex gap-2.5 pt-3 border-t border-border">
        {onDelete && <Btn variant="ghost" onClick={handleDelete} loading={deleting} disabled={saving || uploading}>{deleting ? 'Eliminando…' : 'Eliminar'}</Btn>}
        <Btn icon="check" onClick={submit} loading={saving} disabled={!f.name || uploading || deleting}>
          {saving ? (f.id ? 'Guardando…' : 'Creando…') : (f.id ? 'Guardar' : 'Crear')}
        </Btn>
      </div>

      <div className="mt-6 pt-5 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Galería</div>
            <div className="text-xs text-text-muted mt-0.5">Fotos normales y pares antes/después</div>
          </div>
        </div>
        {f.id
          ? <PhotosGallery serviceId={f.id} serviceName={f.name} />
          : <div className="text-xs text-text-muted bg-bg-card border border-dashed border-border rounded-lg p-3">Guarda el servicio primero para añadir fotos a la galería.</div>}
      </div>

      {/* Editor de crop/zoom — se abre al elegir una foto principal */}
      <PhotoCropEditor
        file={pendingFile}
        open={!!pendingFile}
        onClose={() => setPendingFile(null)}
        onApply={uploadCropped}
        aspect={ASPECT_LANDING_CARD}
        label="Ajustar foto del servicio"
      />
    </div>
  );
}

const KIND_LABEL = {
  normal:   'Foto normal',
  pair:     'Antes / Después (2 fotos)',
  combined: 'Antes / Después (1 sola foto)',
};

function PhotosGallery({ serviceId, serviceName }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const { data } = await api_service_photos.byService(serviceId);
    setList(data || []);
  };
  useEffect(() => { load(); }, [serviceId]);

  const toggleFeatured = async (p) => {
    await api_service_photos.update(p.id, { featured: !p.featured });
    load();
  };
  const removePhoto = async (p) => {
    if (!confirm('¿Eliminar esta foto?')) return;
    await api_service_photos.remove(p.id);
    load();
  };

  return (
    <div>
      {list === null
        ? <ListLoading label="Cargando galería…" />
        : list.length === 0
          ? <div className="text-xs text-text-muted bg-bg-card border border-dashed border-border rounded-lg p-3 mb-3">Aún no hay fotos en la galería.</div>
          : (
            <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {list.map(p => (
                <div key={p.id} className="relative">
                  {p.kind === 'pair'
                    ? <BeforeAfterPair beforeUrl={p.before_url} afterUrl={p.after_url} caption={p.caption} size="sm" />
                    : <PhotoTile url={p.url} kind={p.kind} caption={p.caption} size="sm" />}
                  <div className="absolute top-1.5 right-1.5 flex gap-1">
                    <button onClick={() => toggleFeatured(p)} title={p.featured ? 'Quitar destacada' : 'Marcar destacada'}
                      className={`w-7 h-7 rounded-full grid place-items-center border ${p.featured ? 'bg-gold text-[#0d0c0a] border-gold' : 'bg-bg-card/90 text-text-secondary border-border-strong'} cursor-pointer`}>
                      <Icon name="star" size={12} color={p.featured ? '#0d0c0a' : 'currentColor'} />
                    </button>
                    <button onClick={() => removePhoto(p)} title="Eliminar"
                      className="w-7 h-7 rounded-full grid place-items-center bg-bg-card/90 text-red-400 border border-border-strong cursor-pointer">
                      <Icon name="close" size={12} />
                    </button>
                  </div>
                  <div className="text-[10px] text-text-muted mt-1 px-1">{KIND_LABEL[p.kind]}</div>
                </div>
              ))}
            </div>
          )}

      {err && (
        <div role="alert" className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-2">
          {err}
        </div>
      )}

      {adding
        ? <AddPhotoPanel serviceId={serviceId} serviceName={serviceName}
            onCancel={() => setAdding(false)}
            onAdded={() => { setAdding(false); setErr(''); load(); }}
            onError={(e) => setErr(e.message || 'No se pudo subir la foto')} />
        : <Btn icon="plus" small onClick={() => setAdding(true)}>Agregar foto</Btn>}
    </div>
  );
}

function AddPhotoPanel({ serviceId, serviceName, onAdded, onCancel, onError }) {
  const [kind, setKind] = useState('normal');
  const [caption, setCaption] = useState('');
  const [files, setFiles] = useState({ single: null, before: null, after: null });
  const [uploading, setUploading] = useState(false);
  const singleRef = useRef();
  const beforeRef = useRef();
  const afterRef = useRef();

  const reset = () => { setFiles({ single: null, before: null, after: null }); setCaption(''); };

  const canSubmit = !uploading && (
    (kind === 'normal' && files.single) ||
    (kind === 'combined' && files.single) ||
    (kind === 'pair' && files.before && files.after)
  );

  const submit = async () => {
    setUploading(true);
    try {
      const data = { service_id: serviceId, kind, caption: caption || null };
      if (kind === 'pair') {
        data.before_url = await api_services.uploadPhoto(files.before, `${serviceName}-antes`, serviceId);
        data.after_url  = await api_services.uploadPhoto(files.after,  `${serviceName}-despues`, serviceId);
      } else {
        data.url = await api_services.uploadPhoto(files.single, serviceName || 'servicio', serviceId);
      }
      const res = await api_service_photos.create(data);
      if (res.error) throw res.error;
      reset();
      onAdded();
    } catch (e) {
      onError(e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-bg-card border border-border rounded-xl p-3.5">
      <div className="mb-3">
        <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Tipo</label>
        <Select value={kind} onChange={e => { setKind(e.target.value); reset(); }}
          options={[
            { value: 'normal',   label: KIND_LABEL.normal },
            { value: 'pair',     label: KIND_LABEL.pair },
            { value: 'combined', label: KIND_LABEL.combined },
          ]} />
      </div>

      {kind === 'pair' ? (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <FilePicker label="Antes"    file={files.before} fileRef={beforeRef} onPick={(f) => setFiles(s => ({ ...s, before: f }))} disabled={uploading} aspect={1} />
          <FilePicker label="Después"  file={files.after}  fileRef={afterRef}  onPick={(f) => setFiles(s => ({ ...s, after:  f }))} disabled={uploading} aspect={1} />
        </div>
      ) : (
        <div className="mb-3">
          <FilePicker
            label={kind === 'combined' ? 'Foto antes/después en una' : 'Foto'}
            file={files.single}
            fileRef={singleRef}
            onPick={(f) => setFiles(s => ({ ...s, single: f }))}
            disabled={uploading}
            aspect={kind === 'combined' ? 16 / 9 : 1}
          />
        </div>
      )}

      <div className="mb-3">
        <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Descripción (opcional)</label>
        <Input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Ej: Manicure francesa rosada" />
      </div>

      <div className="flex gap-2">
        <Btn variant="ghost" small onClick={onCancel} disabled={uploading}>Cancelar</Btn>
        <Btn small icon="save" onClick={submit} loading={uploading} disabled={!canSubmit}>
          {uploading ? 'Subiendo…' : 'Subir'}
        </Btn>
      </div>
    </div>
  );
}

function FilePicker({ label, file, fileRef, onPick, disabled, aspect = 1 }) {
  const [pending, setPending] = useState(null); // file pre-crop por picker
  const url = file ? URL.createObjectURL(file) : null;
  return (
    <div>
      <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">{label}</div>
      <div onClick={() => !disabled && fileRef.current.click()}
        className="h-24 rounded-lg border-2 border-dashed border-border bg-bg-elevated cursor-pointer relative overflow-hidden grid place-items-center">
        {url
          ? <img src={url} alt="" className="w-full h-full object-cover" />
          : <div className="text-text-muted text-xs">Toca para elegir</div>}
      </div>
      <PhotoCropEditor
        file={pending}
        open={!!pending}
        onClose={() => setPending(null)}
        onApply={(cropped) => onPick(cropped)}
        aspect={aspect}
        label={`Ajustar ${label.toLowerCase()}`}
      />
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          e.target.value = ''; // permite reabrir mismo archivo
          if (f) setPending(f); // abre el crop editor; al aplicar llama onPick
        }} />
    </div>
  );
}
