import { useEffect, useState, useRef } from 'react';
import { Header } from '../Dashboard.jsx';
import { Icon, Btn, Modal, Field, Input, Select, ListLoading, Spinner, PROD_CAT_COLORS, PROD_CAT_ICONS } from '../../components/ui.jsx';
import PhotoCropEditor, { ASPECT_SQUARE } from '../../components/PhotoCropEditor.jsx';
import { LOW_STOCK } from '../../components/ProductCard.jsx';
import { api_products } from '../../lib/api';
import { fmtMoney } from '../../lib/money';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import {
  useReorderSensors, useSortableCard, ReorderControls, ReorderHint, AUTO_SCROLL,
} from '../../components/reorder.jsx';

const CATS = ['Uñas', 'Piel', 'Cabello', 'Maquillaje', 'Accesorios', 'Otros'];

export default function Productos() {
  const [list, setList] = useState(null); // null = loading
  const [activeCat, setActiveCat] = useState('Uñas');
  const [editing, setEditing] = useState(null);
  const [reorderMode, setReorderMode] = useState(false);
  const fmt = fmtMoney;

  const load = async () => {
    const { data } = await api_products.list();
    setList(data || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = (list || []).filter(p => p.cat === activeCat);

  const sensors = useReorderSensors();

  // Aplica un orden nuevo para la categoría activa: primero al estado local
  // (feedback inmediato) y luego a la BD en background.
  const applyOrder = async (newOrderForCat) => {
    setList(prev => {
      const others = (prev || []).filter(p => p.cat !== activeCat);
      // Reasignar sort_order localmente para que coincida con la BD
      const updated = newOrderForCat.map((p, i) => ({ ...p, sort_order: i }));
      return [...others, ...updated];
    });
    try { await api_products.reorder(newOrderForCat.map(p => p.id)); }
    catch (e) { console.error('Error al reordenar:', e); load(); /* re-sync */ }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filtered.findIndex(p => p.id === active.id);
    const newIndex = filtered.findIndex(p => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    applyOrder(arrayMove(filtered, oldIndex, newIndex));
  };

  // Mover sin arrastrar (botones "al inicio" / ← / →).
  const moveTo = (id, target) => {
    const oldIndex = filtered.findIndex(p => p.id === id);
    const newIndex = Math.max(0, Math.min(filtered.length - 1, target));
    if (oldIndex < 0 || oldIndex === newIndex) return;
    applyOrder(arrayMove(filtered, oldIndex, newIndex));
  };

  // Optimista: ajusta el stock local de inmediato y persiste en background.
  const adjustStock = async (p, delta) => {
    const next = Math.max(0, (p.stock || 0) + delta);
    if (next === p.stock) return;
    setList(prev => (prev || []).map(x => x.id === p.id ? { ...x, stock: next } : x));
    try {
      const res = await api_products.adjustStock(p.id, delta);
      if (res.error) throw res.error;
    } catch (e) { console.error('Error ajustando stock:', e); load(); /* re-sync */ }
  };

  return (
    <div>
      <Header title="Productos" subtitle="Catálogo e inventario"
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
            <Btn icon="plus" onClick={() => setEditing({ cat: activeCat, name:'', price:0, stock:0, featured:false, description:'' })}>Nuevo</Btn>
          </div>
        } />

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {CATS.map(c => {
          const color = PROD_CAT_COLORS[c]; const active = activeCat === c;
          const count = (list || []).filter(p => p.cat === c).length;
          return (
            <button key={c} onClick={() => setActiveCat(c)}
              style={{ background: active ? `${color}22` : 'var(--bg-card)', color: active ? color : 'var(--text-secondary)', borderColor: active ? color+'55' : 'var(--border)' }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm border whitespace-nowrap flex-shrink-0 cursor-pointer">
              <Icon name={PROD_CAT_ICONS[c]} size={13} /> {c}
              <span style={{ background: active ? `${color}30` : 'var(--bg-elevated)' }} className="text-[10px] px-1.5 rounded font-bold">{count}</span>
            </button>
          );
        })}
      </div>

      {reorderMode && <ReorderHint />}

      {list === null ? (
        <ListLoading label="Cargando productos…" />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragEnd={handleDragEnd} autoScroll={AUTO_SCROLL}>
          <SortableContext items={filtered.map(p => p.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {filtered.map((p, i) => (
                <SortableProductCard key={p.id} product={p} fmt={fmt}
                  reorderMode={reorderMode}
                  index={i} total={filtered.length}
                  onMove={(target) => moveTo(p.id, target)}
                  onAdjustStock={adjustStock}
                  onClick={() => !reorderMode && setEditing({ ...p })} />
              ))}
              {filtered.length === 0 && <div className="col-span-full text-center text-text-muted py-10 text-sm">Sin productos en {activeCat}</div>}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editing && (
        <Modal open={true} onClose={() => setEditing(null)} title={editing.id ? editing.name : 'Nuevo Producto'}>
          <ProductForm
            initial={editing}
            onSaved={() => { setEditing(null); load(); }}
            onDelete={editing.id ? async () => { await api_products.remove(editing.id); setEditing(null); await load(); } : null}
          />
        </Modal>
      )}
    </div>
  );
}

// Tarjeta de producto sortable. En modo normal el click abre el editor y los
// steppers ajustan stock sin abrirlo; en modo reordenar el drag mueve la tarjeta.
function SortableProductCard({ product: p, fmt, reorderMode, index, total, onMove, onAdjustStock, onClick }) {
  const { setNodeRef, style, isDragging, handleProps } = useSortableCard(p.id);
  const color = PROD_CAT_COLORS[p.cat];
  const out = (p.stock ?? 0) <= 0;
  const low = !out && p.stock <= LOW_STOCK;
  return (
    <div ref={setNodeRef} style={style}
      onClick={!reorderMode ? onClick : undefined}
      className={`bg-bg-card border rounded-2xl overflow-hidden transition relative ${
        reorderMode
          ? 'border-gold/40 select-none ring-2 ring-gold/20'
          : 'border-border cursor-pointer hover:-translate-y-0.5 motion-reduce:transform-none'
      } ${isDragging ? 'shadow-2xl' : ''}`}>
      {reorderMode && (
        <ReorderControls handleProps={handleProps} index={index} total={total}
          onMove={onMove} name={p.name} />
      )}
      <div className="h-24 bg-bg-elevated relative">
        {p.photo_url && <img src={p.photo_url} alt="" loading="lazy" draggable={false} className={`w-full h-full object-cover ${out ? 'grayscale opacity-60' : ''}`} />}
        {p.featured && !reorderMode && (
          <div style={{ background: color + 'cc' }} className="absolute top-2 left-2 text-[9px] font-bold text-[#0d0c0a] px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
            <Icon name="star" size={9} color="#0d0c0a" /> Destacado
          </div>
        )}
      </div>
      <div className="p-3.5">
        <div className="flex justify-between items-start gap-2 mb-1">
          <div className="font-semibold text-sm min-w-0">{p.name}</div>
          <span className="font-serif font-bold flex-shrink-0" style={{ color }}>{fmt(p.price)}</span>
        </div>
        <p className="text-[11px] text-text-muted line-clamp-2 mb-2.5">{p.description}</p>
        {!reorderMode && (
          <div className="flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
            <span className={`text-xs font-semibold ${out ? 'text-red-400' : low ? 'text-gold' : 'text-text-secondary'}`}>
              {out ? 'Agotado' : `${p.stock} en stock`}
            </span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => onAdjustStock(p, -1)} disabled={out}
                aria-label={`Quitar una unidad de ${p.name}`}
                className="w-7 h-7 rounded-full grid place-items-center border border-border-strong text-text-secondary hover:border-gold hover:text-gold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                <span className="text-sm leading-none">−</span>
              </button>
              <button type="button" onClick={() => onAdjustStock(p, +1)}
                aria-label={`Agregar una unidad de ${p.name}`}
                className="w-7 h-7 rounded-full grid place-items-center border border-border-strong text-text-secondary hover:border-gold hover:text-gold transition cursor-pointer">
                <Icon name="plus" size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductForm({ initial, onSaved, onDelete }) {
  const [f, setF] = useState({ ...initial });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');
  const [pendingFile, setPendingFile] = useState(null); // file elegido, esperando crop
  const fileRef = useRef();

  // El admin elige una foto → abre el crop editor (cuadrado, como se ve en
  // las cards). La subida real ocurre cuando aplica el crop.
  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-seleccionar el mismo archivo si cancela
    if (!file) return;
    setPendingFile(file);
  };

  const uploadCropped = async (croppedFile) => {
    setUploading(true);
    try {
      const url = await api_products.uploadPhoto(croppedFile, f.name || 'producto');
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
        price: Number(f.price) || 0,
        stock: Math.max(0, Number(f.stock) || 0),
      };
      delete data.created_at;
      const res = f.id ? await api_products.update(f.id, data) : await api_products.create(data);
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

      <Field label="Nombre"><Input value={f.name||''} onChange={e=>setF({...f, name:e.target.value})} placeholder="Ej: Esmalte semipermanente" /></Field>
      <Field label="Categoría">
        <Select value={f.cat} onChange={e=>setF({...f, cat:e.target.value})} options={CATS.map(c => ({value:c, label:c}))} />
      </Field>
      <Field label="Descripción">
        <textarea value={f.description||''} onChange={e=>setF({...f, description:e.target.value})} rows={3}
          className="w-full bg-bg-card border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gold resize-y" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio (USD)">
          <Input type="number" step="0.01" min="0" value={f.price ?? ''}
            placeholder="Ej: 2.99"
            onChange={e=>setF({...f, price: e.target.value === '' ? '' : Number(e.target.value)})} />
        </Field>
        <Field label="Stock (unidades)">
          <Input type="number" value={f.stock ?? ''}
            onChange={e=>setF({...f, stock: e.target.value === '' ? '' : Math.max(0, Number(e.target.value))})} />
        </Field>
      </div>
      <label className="flex items-center gap-2.5 mb-5 cursor-pointer">
        <input type="checkbox" checked={!!f.featured} onChange={e=>setF({...f, featured:e.target.checked})} className="w-4 h-4 accent-gold" />
        <span className="text-sm text-text-secondary">Destacado (mostrar en la página principal)</span>
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

      {/* Editor de crop/zoom — se abre al elegir una foto */}
      <PhotoCropEditor
        file={pendingFile}
        open={!!pendingFile}
        onClose={() => setPendingFile(null)}
        onApply={uploadCropped}
        aspect={ASPECT_SQUARE}
        label="Ajustar foto del producto"
      />
    </div>
  );
}
