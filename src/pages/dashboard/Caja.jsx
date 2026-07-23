import { useEffect, useState } from 'react';
import { Header } from '../Dashboard.jsx';
import { Icon, Btn, Modal, Field, Input, Select, ListLoading } from '../../components/ui.jsx';
import ServicePicker from '../../components/ServicePicker.jsx';
import { api_transactions, api_services, api_staff, api_settings } from '../../lib/api';
import { fmtMoney } from '../../lib/money';
import { useFx } from '../../hooks/useFx.jsx';

export default function Caja() {
  const today = new Date().toISOString().slice(0,10);
  const [tx, setTx] = useState(null); // null = loading
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null); // transacción en edición
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const fx = useFx();
  const fmt = fmtMoney;

  const load = async () => {
    const { data } = await api_transactions.list(today);
    setTx(data || []);
  };
  useEffect(() => {
    load();
    api_services.list().then(({data}) => setServices(data || []));
    api_staff.list().then(({data}) => setStaff(data || []));
    const ch = api_transactions.subscribe(load);
    return () => { ch?.unsubscribe?.(); };
  }, []);

  const txList = tx || [];
  const total = txList.reduce((a,t) => a + Number(t.amount||0), 0);
  const byMethod = (m) => txList.filter(t => t.method === m).reduce((a,t) => a + Number(t.amount||0), 0);
  const methodIcon = { efectivo:'cash', tarjeta:'card', transferencia:'transfer' };
  const methodColor = { efectivo:'#6db86d', tarjeta:'var(--gold)', transferencia:'#64a0d0' };
  const methodLabel = { efectivo:'Efectivo', tarjeta:'Tarjeta', transferencia:'Transferencia' };

  return (
    <div>
      <Header title="Caja del Día" subtitle={new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
        action={<Btn icon="plus" onClick={() => setShowAdd(true)}>Registrar</Btn>} />

      <RateChip />

      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard label="Total" value={fmt(total)} sub={`${txList.length} txs${fx.fmtCup(total) ? ' · ' + fx.fmtCup(total) : ''}`} icon="cash" accent="var(--gold)" loading={tx === null} />
        <StatCard label="Efectivo" value={fmt(byMethod('efectivo'))} sub={fx.fmtCup(byMethod('efectivo'))} icon="cash" accent="#6db86d" loading={tx === null} />
        <StatCard label="Tarjeta" value={fmt(byMethod('tarjeta'))} sub={fx.fmtCup(byMethod('tarjeta'))} icon="card" accent="var(--gold)" loading={tx === null} />
        <StatCard label="Transferencia" value={fmt(byMethod('transferencia'))} sub={fx.fmtCup(byMethod('transferencia'))} icon="transfer" accent="#64a0d0" loading={tx === null} />
      </div>

      <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex justify-between text-sm">
          <span className="font-semibold">Transacciones de hoy</span>
          <span className="text-text-muted text-xs">{tx === null ? '…' : `${txList.length} registros`}</span>
        </div>

        {tx === null ? (
          <ListLoading label="Cargando caja…" />
        ) : (
          <>
            {txList.map(t => (
              <div key={t.id} className="border-b border-border last:border-0 flex items-center">
                <button type="button" onClick={() => setEditing(t)}
                  className="flex-1 min-w-0 px-4 py-3 flex items-center gap-3 text-left cursor-pointer hover:bg-bg-hover transition">
                  <div className="w-9 h-9 rounded-lg grid place-items-center flex-shrink-0" style={{ background: `${methodColor[t.method]}20` }}>
                    <Icon name={methodIcon[t.method]} size={15} color={methodColor[t.method]} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{t.client_name || '—'}</div>
                    <div className="text-xs text-text-muted truncate">{[t.service_name, t.staff_name, t.time?.slice(0,5)].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold">{fmt(t.amount)}</div>
                    {fx.fmtCup(t.amount) && <div className="text-[10px] text-text-muted">{fx.fmtCup(t.amount)}</div>}
                    <div className="text-[10px] font-semibold" style={{ color: methodColor[t.method] }}>{methodLabel[t.method]}</div>
                  </div>
                </button>
                <button type="button" title="Editar" onClick={() => setEditing(t)}
                  className="px-3 self-stretch grid place-items-center text-text-muted hover:text-gold cursor-pointer flex-shrink-0">
                  <Icon name="edit" size={15} />
                </button>
              </div>
            ))}
            {txList.length === 0 && <div className="text-center text-text-muted py-10 text-sm">Sin transacciones aún</div>}
          </>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Registrar Pago">
        <PayForm services={services} staff={staff} onSaved={() => { setShowAdd(false); load(); }} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar Pago">
        {editing && (
          <PayForm services={services} staff={staff} initial={editing}
            onSaved={() => { setEditing(null); load(); }}
            onDeleted={() => { setEditing(null); load(); }} />
        )}
      </Modal>
    </div>
  );
}

// Tasa del día USD → CUP: editable a mano en un toque. Se guarda en
// site_settings y se propaga a toda la app vía el contexto FX.
function RateChip() {
  const { rate, setRate } = useFx();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);

  const open = () => { setVal(rate ? String(rate) : ''); setEditing(true); };
  const save = async () => {
    setSaving(true);
    const r = Number(val) || 0;
    const res = await api_settings.setRate(r);
    setSaving(false);
    if (!res.error) { setRate(r); setEditing(false); }
  };

  return (
    <div className="mb-4 flex items-center gap-2 flex-wrap bg-bg-card border border-border rounded-xl px-3 py-2.5">
      <Icon name="cash" size={15} color="var(--gold)" />
      {editing ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs text-text-muted whitespace-nowrap">1 USD =</span>
          <input type="number" step="0.01" min="0" inputMode="decimal" autoFocus
            value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            className="w-24 bg-bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-sm text-text outline-none focus:border-gold appearance-none" />
          <span className="text-xs text-text-muted">CUP</span>
          <Btn small icon="check" onClick={save} loading={saving}>Guardar</Btn>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-text-muted hover:text-text-secondary underline cursor-pointer">Cancelar</button>
        </div>
      ) : (
        <button type="button" onClick={open} className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer group">
          <span className="text-sm">
            {rate > 0
              ? <>Tasa del día: <span className="font-bold">1 USD = {new Intl.NumberFormat('es-CU').format(rate)} CUP</span></>
              : <span className="text-text-muted">Definir tasa del dólar (USD → CUP)</span>}
          </span>
          <span className="text-text-muted group-hover:text-gold ml-auto flex items-center gap-1 text-xs whitespace-nowrap">
            <Icon name="edit" size={13} /> editar
          </span>
        </button>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon, accent, loading }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 flex gap-3">
      <div className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${accent}20` }}>
        <Icon name={icon} size={17} color={accent} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-text-muted uppercase tracking-wider font-semibold">{label}</div>
        <div className="font-bold leading-tight" style={{ fontSize: 'clamp(16px,3vw,22px)' }}>
          {loading ? <span className="inline-block w-20 h-5 bg-bg-hover rounded animate-pulse motion-reduce:animate-none" /> : value}
        </div>
        {sub && <div className="text-[11px] text-text-muted mt-0.5 truncate">{sub}</div>}
      </div>
    </div>
  );
}

function PayForm({ services, staff, initial, onSaved, onDeleted }) {
  const isEdit = !!initial;
  const fx = useFx();
  const [clientName, setClientName] = useState(initial?.client_name || '');
  const [selectedIds, setSelectedIds] = useState(initial?.service_ids || []);
  const [serviceName, setServiceName] = useState(initial?.service_name || '');
  const [staffName, setStaffName] = useState(initial?.staff_name || '');
  const [amount, setAmount] = useState(initial?.amount ?? '');
  // En edición no auto-pisamos el monto (la idea es poder corregirlo);
  // al crear, el monto sigue a la suma de los servicios hasta que se toque.
  const [amountTouched, setAmountTouched] = useState(isEdit);
  const [method, setMethod] = useState(initial?.method || 'efectivo');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');

  const selectedServices = services.filter(s => selectedIds.includes(s.id));
  const suggestedTotal = selectedServices.reduce((a,s) => a + Number(s.price||0), 0);

  const toggle = (id) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    setSelectedIds(next);
    const sel = services.filter(s => next.includes(s.id));
    setServiceName(sel.map(s => s.name).join(' + '));
    if (!amountTouched) setAmount(sel.reduce((a,s) => a + Number(s.price||0), 0));
  };

  const amountNum = Number(amount) || 0;

  const submit = async () => {
    setErr('');
    setSaving(true);
    try {
      const payload = {
        client_name: clientName.trim() || null,
        service_name: serviceName.trim() || null,
        service_ids: selectedIds.length ? selectedIds : null,
        staff_name: staffName || null,
        amount: amountNum,
        method,
      };
      const res = isEdit
        ? await api_transactions.update(initial.id, payload)
        : await api_transactions.create(payload);
      if (res.error) throw res.error;
      onSaved();
    } catch (e) {
      setErr(e.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!window.confirm('¿Eliminar esta transacción? No se puede deshacer.')) return;
    setDeleting(true);
    try {
      const res = await api_transactions.remove(initial.id);
      if (res.error) throw res.error;
      onDeleted?.();
    } catch (e) {
      setErr(e.message || 'No se pudo eliminar');
      setDeleting(false);
    }
  };

  return (
    <div>
      <Field label="Cliente"><Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nombre de la clienta" /></Field>

      <Field label="Servicios (elige uno o varios)">
        <ServicePicker services={services} selectedIds={selectedIds} onToggle={toggle} maxHeight="max-h-52" />
        {selectedIds.length > 0 ? (
          <div className="mt-2 text-xs flex items-center justify-between gap-2 flex-wrap">
            <span className="text-text-secondary truncate">
              {selectedIds.length} servicio{selectedIds.length > 1 ? 's' : ''} · sugerido {fx.fmtDual(suggestedTotal)}
            </span>
            {amountNum !== suggestedTotal && (
              <button type="button" onClick={() => { setAmount(suggestedTotal); setAmountTouched(false); }}
                className="text-gold underline underline-offset-2 cursor-pointer whitespace-nowrap">usar {fmtMoney(suggestedTotal)}</button>
            )}
          </div>
        ) : serviceName ? (
          <div className="mt-2 text-xs text-text-muted truncate">Actual: {serviceName}</div>
        ) : null}
      </Field>

      <Field label="Empleada (opcional)">
        <Select value={staffName} onChange={e => setStaffName(e.target.value)}
          options={[{value:'',label:'Sin asignar'}, ...staff.map(s => ({value:s.name, label:s.name}))]} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto (USD)">
          <Input type="number" value={amount ?? ''}
            onChange={e => { setAmountTouched(true); setAmount(e.target.value === '' ? '' : Number(e.target.value)); }} />
        </Field>
        <Field label="Método">
          <Select value={method} onChange={e => setMethod(e.target.value)}
            options={[{value:'efectivo',label:'Efectivo'},{value:'tarjeta',label:'Tarjeta'},{value:'transferencia',label:'Transferencia'}]} />
        </Field>
      </div>
      {fx.fmtCup(amountNum) && (
        <div className="-mt-2 mb-3 text-xs text-text-muted">≈ {fx.fmtCup(amountNum)} al cambio de hoy</div>
      )}

      {err && (
        <div role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
          {err}
        </div>
      )}

      <div className="flex gap-2.5 items-center">
        <Btn icon="check" onClick={submit} loading={saving} disabled={!amountNum || deleting}>
          {saving ? 'Guardando…' : (isEdit ? 'Guardar cambios' : 'Registrar')}
        </Btn>
        {isEdit && (
          <button type="button" onClick={del} disabled={saving || deleting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/30 cursor-pointer disabled:opacity-50">
            <Icon name="trash" size={14} color="currentColor" /> {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        )}
      </div>
    </div>
  );
}
