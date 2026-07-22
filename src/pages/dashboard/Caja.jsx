import { useEffect, useState } from 'react';
import { Header } from '../Dashboard.jsx';
import { Icon, Btn, Modal, Field, Input, Select, ListLoading } from '../../components/ui.jsx';
import { api_transactions, api_services, api_staff } from '../../lib/api';
import { fmtMoney } from '../../lib/money';

export default function Caja() {
  const today = new Date().toISOString().slice(0,10);
  const [tx, setTx] = useState(null); // null = loading
  const [showAdd, setShowAdd] = useState(false);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
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

      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard label="Total" value={fmt(total)} sub={`${txList.length} txs`} icon="cash" accent="var(--gold)" loading={tx === null} />
        <StatCard label="Efectivo" value={fmt(byMethod('efectivo'))} icon="cash" accent="#6db86d" loading={tx === null} />
        <StatCard label="Tarjeta" value={fmt(byMethod('tarjeta'))} icon="card" accent="var(--gold)" loading={tx === null} />
        <StatCard label="Transferencia" value={fmt(byMethod('transferencia'))} icon="transfer" accent="#64a0d0" loading={tx === null} />
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
              <div key={t.id} className="px-4 py-3 border-b border-border last:border-0 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg grid place-items-center flex-shrink-0" style={{ background: `${methodColor[t.method]}20` }}>
                  <Icon name={methodIcon[t.method]} size={15} color={methodColor[t.method]} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{t.client_name || '—'}</div>
                  <div className="text-xs text-text-muted">{t.service_name} · {t.staff_name} · {t.time?.slice(0,5)}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold">{fmt(t.amount)}</div>
                  <div className="text-[10px] font-semibold" style={{ color: methodColor[t.method] }}>{methodLabel[t.method]}</div>
                </div>
              </div>
            ))}
            {txList.length === 0 && <div className="text-center text-text-muted py-10 text-sm">Sin transacciones aún</div>}
          </>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Registrar Pago">
        <PayForm services={services} staff={staff} onSaved={() => { setShowAdd(false); load(); }} />
      </Modal>
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
        {sub && <div className="text-[11px] text-text-muted mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function PayForm({ services, staff, onSaved }) {
  const [f, setF] = useState({ client_name:'', service_name:'', staff_name:'', amount:0, method:'efectivo' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    setSaving(true);
    try {
      const payload = { ...f, amount: Number(f.amount) || 0 };
      const res = await api_transactions.create(payload);
      if (res.error) throw res.error;
      onSaved();
    } catch (e) {
      setErr(e.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Field label="Cliente"><Input value={f.client_name} onChange={e=>setF({...f, client_name:e.target.value})} /></Field>
      <Field label="Servicio">
        <Select value={f.service_name} onChange={e=>{ const s = services.find(x => x.name === e.target.value); setF({...f, service_name:e.target.value, amount: s?.price || f.amount}); }}
          options={[{value:'',label:'Selecciona'}, ...services.map(s => ({value:s.name, label:s.name}))]} />
      </Field>
      <Field label="Empleada">
        <Select value={f.staff_name} onChange={e=>setF({...f, staff_name:e.target.value})}
          options={[{value:'',label:'Selecciona'}, ...staff.map(s => ({value:s.name, label:s.name}))]} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto (USD)"><Input type="number" step="0.01" min="0" value={f.amount ?? ''} onChange={e=>setF({...f, amount: e.target.value === '' ? '' : Number(e.target.value)})} /></Field>
        <Field label="Método">
          <Select value={f.method} onChange={e=>setF({...f, method:e.target.value})}
            options={[{value:'efectivo',label:'Efectivo'},{value:'tarjeta',label:'Tarjeta'},{value:'transferencia',label:'Transferencia'}]} />
        </Field>
      </div>

      {err && (
        <div role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
          {err}
        </div>
      )}

      <Btn icon="check" onClick={submit} loading={saving} disabled={!f.amount}>
        {saving ? 'Registrando…' : 'Registrar'}
      </Btn>
    </div>
  );
}
