import { useEffect, useMemo, useState } from 'react';
import { Header } from '../Dashboard.jsx';
import { Icon, Btn, Modal, Field, Input, Select, ListLoading } from '../../components/ui.jsx';
import { api_supplies, api_purchases } from '../../lib/api';
import { fmtMoney, fmtCup } from '../../lib/money';
import { todayISO, longDate } from '../../lib/dates';
import { useFx } from '../../hooks/useFx.jsx';

export const UNITS = ['unidad', 'ml', 'g', 'par', 'juego', 'metro'];

// Cantidades con hasta 3 decimales, sin ceros de relleno (0.500 → 0.5).
export const qtyFmt = (n) =>
  new Intl.NumberFormat('es-CU', { maximumFractionDigits: 3 }).format(Number(n) || 0);

// El costo unitario puede ser muy chico (0.0125 USD de henna por servicio),
// así que necesita más decimales que un precio normal.
export const unitCostFmt = (n) =>
  `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(n) || 0)} USD`;

export default function Inventario() {
  const [supplies, setSupplies] = useState(null);   // null = cargando
  const [purchases, setPurchases] = useState([]);
  const [editing, setEditing] = useState(null);     // insumo en edición
  const [buying, setBuying] = useState(false);
  const fx = useFx();

  const load = async () => {
    const [{ data: s }, { data: p }] = await Promise.all([
      api_supplies.list(),
      api_purchases.list(),
    ]);
    setSupplies(s || []);
    setPurchases((p || []).slice(0, 15));
  };
  useEffect(() => { load(); }, []);

  const list = supplies || [];
  const totalValue = useMemo(
    () => list.reduce((a, s) => a + (Number(s.stock) || 0) * (Number(s.unit_cost) || 0), 0),
    [list]);
  const low = useMemo(
    () => list.filter(s => Number(s.min_stock) > 0 && Number(s.stock) <= Number(s.min_stock)),
    [list]);

  return (
    <div>
      <Header title="Inventario" subtitle="Lo que compras para trabajar, y lo que cuesta"
        action={
          <div className="flex gap-2">
            <Btn variant="ghost" icon="plus" onClick={() => setEditing({ name: '', unit: 'unidad', stock: 0, unit_cost: 0, min_stock: 0 })}>Insumo</Btn>
            <Btn icon="cash" onClick={() => setBuying(true)} disabled={!list.length}>Compra</Btn>
          </div>
        } />

      <div className="grid grid-cols-2 gap-3 mb-5">
        <Stat label="Valor del inventario" value={fmtMoney(totalValue)}
          sub={fmtCup(totalValue, fx.rate)} icon="box" accent="var(--gold)" loading={supplies === null} />
        <Stat label="Bajo mínimo" value={`${low.length}`}
          sub={low.length ? low.map(s => s.name).join(', ') : 'Todo con stock'}
          icon="bell" accent={low.length ? '#d4857a' : '#6db86d'} loading={supplies === null} />
      </div>

      <div className="bg-bg-card border border-border rounded-2xl overflow-hidden mb-5">
        <div className="px-4 py-3 border-b border-border flex justify-between text-sm">
          <span className="font-semibold">Insumos</span>
          <span className="text-text-muted text-xs">{supplies === null ? '…' : `${list.length}`}</span>
        </div>
        {supplies === null ? (
          <ListLoading label="Cargando inventario…" />
        ) : list.length === 0 ? (
          <div className="text-center text-text-muted py-10 text-sm px-4">
            Aún no hay insumos. Crea el primero con "Insumo" y luego registra su compra.
          </div>
        ) : list.map(s => {
          const isLow = Number(s.min_stock) > 0 && Number(s.stock) <= Number(s.min_stock);
          return (
            <button key={s.id} type="button" onClick={() => setEditing({ ...s })}
              className="w-full border-b border-border last:border-0 px-4 py-3 flex items-center gap-3 text-left cursor-pointer hover:bg-bg-hover transition">
              <div className="w-9 h-9 rounded-lg grid place-items-center flex-shrink-0"
                style={{ background: isLow ? '#d4857a20' : 'var(--bg-elevated)' }}>
                <Icon name="box" size={15} color={isLow ? '#d4857a' : 'var(--text-muted)'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                  {s.name}
                  {isLow && <span className="text-[9px] uppercase tracking-wider font-bold text-[#d4857a] border border-[#d4857a]/40 px-1.5 rounded-full">bajo</span>}
                </div>
                <div className="text-[11px] text-text-muted">
                  {qtyFmt(s.stock)} {s.unit} · {unitCostFmt(s.unit_cost)} c/u
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-bold text-sm">{fmtMoney((Number(s.stock) || 0) * (Number(s.unit_cost) || 0))}</div>
                <div className="text-[10px] text-text-muted">en stock</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex justify-between text-sm">
          <span className="font-semibold">Últimas compras</span>
          <span className="text-text-muted text-xs">{purchases.length}</span>
        </div>
        {purchases.length === 0 ? (
          <div className="text-center text-text-muted py-8 text-sm">Sin compras registradas</div>
        ) : purchases.map(p => (
          <div key={p.id} className="border-b border-border last:border-0 px-4 py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{p.supply_name || '—'}</div>
              <div className="text-[11px] text-text-muted">
                {qtyFmt(p.qty)} · {longDate(p.date)}{p.note ? ` · ${p.note}` : ''}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-bold text-sm">{fmtMoney(p.total_cost)}</div>
              {fmtCup(p.total_cost, Number(p.fx_rate) || fx.rate) && (
                <div className="text-[10px] text-text-muted">{fmtCup(p.total_cost, Number(p.fx_rate) || fx.rate)}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? editing.name : 'Nuevo insumo'}>
        {editing && (
          <SupplyForm initial={editing}
            onSaved={() => { setEditing(null); load(); }}
            onDeleted={() => { setEditing(null); load(); }} />
        )}
      </Modal>

      <Modal open={buying} onClose={() => setBuying(false)} title="Registrar compra">
        <PurchaseForm supplies={list} rate={fx.rate}
          onSaved={() => { setBuying(false); load(); }} />
      </Modal>
    </div>
  );
}

function Stat({ label, value, sub, icon, accent, loading }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 flex gap-3">
      <div className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${accent}20` }}>
        <Icon name={icon} size={17} color={accent} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-text-muted uppercase tracking-wider font-semibold truncate">{label}</div>
        <div className="font-bold leading-tight" style={{ fontSize: 'clamp(16px,3vw,22px)' }}>
          {loading ? <span className="inline-block w-16 h-5 bg-bg-hover rounded animate-pulse motion-reduce:animate-none" /> : value}
        </div>
        {!loading && sub && <div className="text-[11px] text-text-muted mt-0.5 truncate">{sub}</div>}
      </div>
    </div>
  );
}

function SupplyForm({ initial, onSaved, onDeleted }) {
  const [f, setF] = useState({ ...initial });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');
  const isEdit = !!f.id;

  const submit = async () => {
    setErr(''); setSaving(true);
    try {
      const data = {
        name: f.name.trim(),
        unit: f.unit || 'unidad',
        stock: Number(f.stock) || 0,
        unit_cost: Number(f.unit_cost) || 0,
        min_stock: Number(f.min_stock) || 0,
        note: f.note?.trim() || null,
      };
      const res = isEdit ? await api_supplies.update(f.id, data) : await api_supplies.create(data);
      if (res.error) throw res.error;
      onSaved();
    } catch (e) { setErr(e.message || 'No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!window.confirm(`¿Quitar "${f.name}" del inventario?`)) return;
    setDeleting(true);
    try {
      const res = await api_supplies.remove(f.id);
      if (res.error) throw res.error;
      onDeleted();
    } catch (e) { setErr(e.message || 'No se pudo quitar'); setDeleting(false); }
  };

  return (
    <div>
      <Field label="Nombre">
        <Input value={f.name || ''} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Ej: Henna para cejas" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unidad">
          <Select value={f.unit || 'unidad'} onChange={e => setF({ ...f, unit: e.target.value })}
            options={UNITS.map(u => ({ value: u, label: u }))} />
        </Field>
        <Field label="Avisar si baja de">
          <Input type="number" value={f.min_stock ?? ''} onChange={e => setF({ ...f, min_stock: e.target.value })} placeholder="0 = no avisar" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stock actual">
          <Input type="number" value={f.stock ?? ''} onChange={e => setF({ ...f, stock: e.target.value })} />
        </Field>
        <Field label="Costo por unidad (USD)">
          <Input type="number" value={f.unit_cost ?? ''} onChange={e => setF({ ...f, unit_cost: e.target.value })} />
        </Field>
      </div>
      <div className="text-[11px] text-text-muted -mt-2 mb-3">
        {isEdit
          ? 'Edita estos campos solo para cuadrar con el conteo real. Al registrar una compra se actualizan solos.'
          : 'Si ya tienes existencias, ponlas aquí. Lo que compres después se suma solo.'}
      </div>

      {err && <div role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">{err}</div>}

      <div className="flex gap-2.5 pt-3 border-t border-border">
        {isEdit && (
          <button type="button" onClick={del} disabled={saving || deleting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/30 cursor-pointer disabled:opacity-50">
            <Icon name="trash" size={14} color="currentColor" /> {deleting ? 'Quitando…' : 'Quitar'}
          </button>
        )}
        <Btn icon="check" onClick={submit} loading={saving} disabled={!f.name?.trim() || deleting}>
          {saving ? 'Guardando…' : (isEdit ? 'Guardar' : 'Crear')}
        </Btn>
      </div>
    </div>
  );
}

function PurchaseForm({ supplies, rate, onSaved }) {
  const [supplyId, setSupplyId] = useState(supplies[0]?.id || '');
  const [qty, setQty] = useState('');
  const [total, setTotal] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const supply = supplies.find(s => s.id === supplyId);
  const q = Number(qty) || 0;
  const cost = Number(total) || 0;

  // Lo que va a quedar después de la compra. Verlo antes evita el susto de
  // que el costo promedio se mueva sin entender por qué.
  const preview = (() => {
    if (!supply || q <= 0) return null;
    const prevStock = Number(supply.stock) || 0;
    const prevCost = Number(supply.unit_cost) || 0;
    const newStock = prevStock + q;
    const newUnit = newStock > 0 ? (prevStock * prevCost + cost) / newStock : 0;
    return { newStock, newUnit, thisUnit: cost / q };
  })();

  const submit = async () => {
    setErr(''); setSaving(true);
    try {
      const res = await api_purchases.create({
        supply, qty: q, totalCost: cost, fxRate: rate, date: todayISO(), note,
      });
      if (res.error) throw res.error;
      onSaved();
    } catch (e) { setErr(e.message || 'No se pudo registrar'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <Field label="Insumo">
        <Select value={supplyId} onChange={e => setSupplyId(e.target.value)}
          options={supplies.map(s => ({ value: s.id, label: `${s.name} (${qtyFmt(s.stock)} ${s.unit})` }))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Cantidad${supply ? ` (${supply.unit})` : ''}`}>
          <Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="Ej: 2" />
        </Field>
        <Field label="Costo total (USD)">
          <Input type="number" value={total} onChange={e => setTotal(e.target.value)} placeholder="Ej: 12.50" />
        </Field>
      </div>
      {fmtCup(cost, rate) && (
        <div className="-mt-2 mb-3 text-xs text-text-muted">≈ {fmtCup(cost, rate)} al cambio de hoy</div>
      )}
      <Field label="Nota (opcional)">
        <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Dónde la compraste, marca…" />
      </Field>

      {preview && (
        <div className="mb-4 rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-xs">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-text-muted mb-1.5">Cómo queda</div>
          <div className="flex justify-between gap-2 py-0.5">
            <span className="text-text-secondary">Stock</span>
            <strong>{qtyFmt(preview.newStock)} {supply.unit}</strong>
          </div>
          <div className="flex justify-between gap-2 py-0.5">
            <span className="text-text-secondary">Esta compra te sale a</span>
            <strong>{unitCostFmt(preview.thisUnit)}</strong>
          </div>
          <div className="flex justify-between gap-2 py-0.5 pt-1.5 border-t border-border mt-1">
            <span className="text-text-secondary">Costo promedio nuevo</span>
            <strong style={{ color: 'var(--gold)' }}>{unitCostFmt(preview.newUnit)}</strong>
          </div>
        </div>
      )}

      {err && <div role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">{err}</div>}

      <Btn icon="check" onClick={submit} loading={saving} disabled={!supply || q <= 0 || cost <= 0}>
        {saving ? 'Registrando…' : 'Registrar compra'}
      </Btn>
    </div>
  );
}
