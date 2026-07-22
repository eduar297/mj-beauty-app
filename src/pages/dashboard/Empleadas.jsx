import { useEffect, useRef, useState, useMemo } from 'react';
import { Header } from '../Dashboard.jsx';
import { Icon, Btn, Avatar, Modal, Field, Input, Select, ColorPicker, ListLoading, Spinner, CAT_COLORS } from '../../components/ui.jsx';
import PhotoCropEditor, { ASPECT_SQUARE } from '../../components/PhotoCropEditor.jsx';
import { api_staff, api_services, api_staff_services, api_time_off } from '../../lib/api';
import { fmtDuration } from '../../lib/duration';
import { DEFAULT_WEEKLY_HOURS, DAY_KEYS_ORDER, DAY_LABELS_ES, normalizeDayRanges } from '../../lib/availability.js';

export default function Empleadas() {
  const [list, setList] = useState(null); // null = loading
  const [services, setServices] = useState([]);
  const [editing, setEditing] = useState(null);
  const [staffServicesByStaff, setStaffServicesByStaff] = useState({}); // id -> [serviceId]

  const load = async () => {
    const { data } = await api_staff.list();
    setList(data || []);
    // Cargar mapping completo de staff_services para mostrar chips en la card
    const all = await Promise.all((data || []).map(s =>
      api_staff_services.byStaff(s.id).then(r => [s.id, (r.data || []).map(x => x.service_id)])
    ));
    setStaffServicesByStaff(Object.fromEntries(all));
  };
  useEffect(() => {
    load();
    api_services.list().then(({ data }) => setServices(data || []));
  }, []);

  const serviceById = useMemo(() => Object.fromEntries(services.map(s => [s.id, s])), [services]);

  return (
    <div>
      <Header title="Empleadas" subtitle="Equipo MJ Beauty"
        action={<Btn icon="plus" onClick={() => setEditing({})}>Agregar</Btn>} />

      {list === null ? (
        <ListLoading label="Cargando equipo…" />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {list.map(s => {
            const myServices = (staffServicesByStaff[s.id] || []).map(id => serviceById[id]).filter(Boolean);
            return (
              <div key={s.id} className="bg-bg-card border border-border rounded-2xl p-5 text-center cursor-pointer hover:-translate-y-0.5 motion-reduce:transform-none transition" onClick={() => setEditing({...s})}>
                <div className="grid place-items-center">
                  <Avatar initials={s.initials || s.name?.[0]} color={s.color} size={64} photoUrl={s.photo_url} alt={s.name} />
                </div>
                <div className="font-serif text-base font-semibold mt-3">{s.name}</div>
                <div className="text-xs text-text-muted mt-0.5 capitalize">{s.role}</div>
                {s.schedule && <div className="text-[11px] text-text-muted mt-0.5">{s.schedule}</div>}
                {myServices.length > 0 && (
                  <div className="flex justify-center gap-1 mt-2.5 flex-wrap">
                    {myServices.slice(0, 6).map(svc => (
                      <span key={svc.id}
                        style={{ background: `${CAT_COLORS[svc.cat] || s.color}22`, color: CAT_COLORS[svc.cat] || s.color, borderColor: `${CAT_COLORS[svc.cat] || s.color}55` }}
                        className="text-[10px] px-2 py-0.5 rounded-full border">{svc.name}</span>
                    ))}
                    {myServices.length > 6 && (
                      <span className="text-[10px] px-1.5 py-0.5 text-text-muted">+{myServices.length - 6}</span>
                    )}
                  </div>
                )}
                <div className="text-[10px] text-text-muted mt-3">PIN: <span className="font-mono">{'•'.repeat(s.pin?.length || 4)}</span></div>
              </div>
            );
          })}
          {list.length === 0 && <div className="col-span-full text-center text-text-muted py-10 text-sm">Sin empleadas</div>}
        </div>
      )}

      {editing && (
        <Modal open={true} onClose={() => setEditing(null)} title={editing.id ? editing.name : 'Agregar Empleada'}>
          <StaffForm
            initial={editing}
            services={services}
            onSaved={() => { setEditing(null); load(); }}
            onDelete={editing.id ? async () => { await api_staff.remove(editing.id); setEditing(null); await load(); } : null}
          />
        </Modal>
      )}
    </div>
  );
}

function StaffForm({ initial, services, onSaved, onDelete }) {
  const [f, setF] = useState({
    name:'', role:'empleada', pin:'', color:'#c9a96e', schedule:'',
    weekly_hours: DEFAULT_WEEKLY_HOURS,
    ...initial,
  });
  // Normaliza weekly_hours por si la BD trajo {} u objeto incompleto.
  useEffect(() => {
    if (!initial?.weekly_hours || Object.keys(initial.weekly_hours).length === 0) {
      setF(prev => ({ ...prev, weekly_hours: DEFAULT_WEEKLY_HOURS }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);

  const [serviceIds, setServiceIds] = useState([]); // ids elegidos
  const [timeOffs, setTimeOffs] = useState([]);
  const [newOff, setNewOff] = useState({ start_at: '', end_at: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef();

  // Carga inicial: servicios linkeados + bloqueos.
  useEffect(() => {
    if (!initial?.id) return;
    api_staff_services.byStaff(initial.id).then(({ data }) =>
      setServiceIds((data || []).map(r => r.service_id))
    );
    const today = new Date(); today.setHours(0,0,0,0);
    api_time_off.byStaff(initial.id, today.toISOString()).then(({ data }) =>
      setTimeOffs(data || [])
    );
  }, [initial?.id]);

  const [pendingPhoto, setPendingPhoto] = useState(null); // file pre-crop

  // Elegir archivo → abrir editor de crop. La subida real ocurre en uploadCropped.
  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPendingPhoto(file);
  };

  const uploadCropped = async (croppedFile) => {
    setUploading(true);
    try {
      const url = await api_staff.uploadPhoto(croppedFile, f.name || 'empleada');
      setF(prev => ({ ...prev, photo_url: url }));
    } catch (err) { setErr('Error subiendo foto: ' + err.message); }
    setUploading(false);
  };

  const toggleService = (id) => {
    setServiceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Reemplaza todos los rangos del día por un array (o null para "Libre").
  const setDayRanges = (day, ranges) => {
    setF(prev => ({
      ...prev,
      weekly_hours: { ...prev.weekly_hours, [day]: ranges },
    }));
  };
  // Actualiza un rango específico dentro del día.
  const updateRange = (day, idx, patch) => {
    const ranges = normalizeDayRanges(f.weekly_hours?.[day]);
    const next = ranges.map((r, i) => i === idx ? { ...r, ...patch } : r);
    setDayRanges(day, next);
  };
  const addRange = (day) => {
    const ranges = normalizeDayRanges(f.weekly_hours?.[day]);
    // Por defecto añadimos un rango sugerido después del último (o 14-18 si es el primero).
    const last = ranges[ranges.length - 1];
    const next = last ? { start: last.end, end: '18:00' } : { start: '09:00', end: '18:00' };
    setDayRanges(day, [...ranges, next]);
  };
  const removeRange = (day, idx) => {
    const ranges = normalizeDayRanges(f.weekly_hours?.[day]);
    const next = ranges.filter((_, i) => i !== idx);
    setDayRanges(day, next.length ? next : null);
  };

  const addTimeOff = async () => {
    if (!newOff.start_at || !newOff.end_at) return;
    if (new Date(newOff.end_at) <= new Date(newOff.start_at)) {
      setErr('El fin del bloqueo debe ser después del inicio'); return;
    }
    if (!initial?.id) {
      setErr('Guarda primero la empleada para agregar bloqueos'); return;
    }
    const { data, error } = await api_time_off.create({
      staff_id: initial.id,
      start_at: new Date(newOff.start_at).toISOString(),
      end_at: new Date(newOff.end_at).toISOString(),
      reason: newOff.reason || null,
    });
    if (error) { setErr(error.message); return; }
    setTimeOffs(prev => [...prev, data].sort((a, b) => a.start_at.localeCompare(b.start_at)));
    setNewOff({ start_at: '', end_at: '', reason: '' });
  };

  const removeTimeOff = async (id) => {
    await api_time_off.remove(id);
    setTimeOffs(prev => prev.filter(t => t.id !== id));
  };

  const submit = async () => {
    setErr('');
    setSaving(true);
    try {
      const data = {
        ...f,
        initials: (f.name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(),
      };
      delete data.created_at;
      const res = f.id ? await api_staff.update(f.id, data) : await api_staff.create(data);
      if (res.error) throw res.error;
      const staffId = res.data.id;
      await api_staff_services.set(staffId, serviceIds);
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

  // Agrupar servicios por categoría para mostrar más claro en el multi-select
  const servicesByCat = useMemo(() => {
    const m = {};
    for (const s of services) (m[s.cat] = m[s.cat] || []).push(s);
    return m;
  }, [services]);

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
      <Field label="Horario (texto público)">
        <Input value={f.schedule||''} onChange={e=>setF({...f, schedule:e.target.value})} placeholder="Lun–Sáb 9am–6pm" />
      </Field>

      {/* ── Servicios que realiza ─────────────────────────── */}
      <Field label="Servicios que hace">
        <div className="space-y-2">
          {Object.entries(servicesByCat).map(([cat, items]) => (
            <div key={cat}>
              <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">{cat}</div>
              <div className="flex flex-wrap gap-1.5">
                {items.map(svc => {
                  const on = serviceIds.includes(svc.id);
                  const c = CAT_COLORS[svc.cat] || f.color;
                  return (
                    <button key={svc.id} type="button" onClick={() => toggleService(svc.id)}
                      aria-pressed={on}
                      style={on
                        ? { background: `${c}33`, color: c, borderColor: c }
                        : { borderColor: 'var(--border)' }}
                      className={`text-[11px] px-2.5 py-1 rounded-full border cursor-pointer transition ${on ? 'font-semibold' : 'text-text-muted hover:text-text-secondary hover:border-border-strong'}`}>
                      {svc.name} <span className="opacity-60">· {fmtDuration(svc.duration)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {services.length === 0 && (
            <div className="text-xs text-text-muted">No hay servicios creados aún.</div>
          )}
        </div>
      </Field>

      {/* ── Horario semanal (soporta varios rangos por día — útil para pausas) ── */}
      <Field label="Horario semanal de trabajo">
        <div className="text-[11px] text-text-muted mb-2">
          Agrega varios rangos en un mismo día si tienes pausa (ej: 9–13 y 14–18).
        </div>
        <div className="space-y-2">
          {DAY_KEYS_ORDER.map(day => {
            const ranges = normalizeDayRanges(f.weekly_hours?.[day]);
            const isOff = ranges.length === 0;
            return (
              <div key={day} className="border border-border rounded-lg p-2 bg-bg-elevated/50">
                <div className="flex justify-between items-center mb-1.5">
                  <div className="text-xs font-semibold text-text-secondary">{DAY_LABELS_ES[day]}</div>
                  {isOff ? (
                    <button type="button" onClick={() => addRange(day)}
                      className="text-[11px] text-gold hover:underline cursor-pointer">+ Activar</button>
                  ) : (
                    <div className="flex gap-3">
                      <button type="button" onClick={() => addRange(day)}
                        className="text-[11px] text-gold hover:underline cursor-pointer">+ Otro rango</button>
                      <button type="button" onClick={() => setDayRanges(day, null)}
                        className="text-[11px] text-text-muted hover:text-red-400 cursor-pointer">Libre</button>
                    </div>
                  )}
                </div>
                {isOff ? (
                  <div className="text-xs text-text-muted italic">Libre</div>
                ) : (
                  <div className="space-y-1.5">
                    {ranges.map((r, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_8px_1fr_auto] items-center gap-2">
                        <input type="time" value={r.start}
                          onChange={e => updateRange(day, idx, { start: e.target.value })}
                          className="bg-bg-elevated border border-border rounded px-2 py-1 text-xs" />
                        <span className="text-text-muted text-xs text-center">–</span>
                        <input type="time" value={r.end}
                          onChange={e => updateRange(day, idx, { end: e.target.value })}
                          className="bg-bg-elevated border border-border rounded px-2 py-1 text-xs" />
                        {ranges.length > 1 ? (
                          <button type="button" onClick={() => removeRange(day, idx)}
                            aria-label="Quitar rango"
                            className="text-text-muted hover:text-red-400 cursor-pointer w-6 grid place-items-center">
                            <Icon name="close" size={12} />
                          </button>
                        ) : <span className="w-6" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Field>

      {/* ── Bloqueos / vacaciones ─────────────────────────── */}
      {initial?.id && (
        <Field label="Bloqueos / Vacaciones">
          {timeOffs.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {timeOffs.map(t => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-xs bg-bg-elevated border border-border rounded-lg px-2.5 py-1.5">
                  <div className="min-w-0">
                    <div className="text-text-primary">
                      {new Date(t.start_at).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {' → '}
                      {new Date(t.end_at).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {t.reason && <div className="text-text-muted text-[11px]">{t.reason}</div>}
                  </div>
                  <button type="button" onClick={() => removeTimeOff(t.id)} aria-label="Eliminar bloqueo"
                    className="text-text-muted hover:text-red-400 cursor-pointer">
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input type="datetime-local" value={newOff.start_at}
              onChange={e => setNewOff(p => ({ ...p, start_at: e.target.value }))}
              className="bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs" />
            <input type="datetime-local" value={newOff.end_at}
              onChange={e => setNewOff(p => ({ ...p, end_at: e.target.value }))}
              className="bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs" />
          </div>
          <div className="flex gap-2 mt-2">
            <input type="text" placeholder="Motivo (opcional)" value={newOff.reason}
              onChange={e => setNewOff(p => ({ ...p, reason: e.target.value }))}
              className="bg-bg-elevated border border-border rounded px-2 py-1.5 text-xs flex-1" />
            <button type="button" onClick={addTimeOff} disabled={!newOff.start_at || !newOff.end_at}
              className="text-xs px-3 py-1.5 rounded bg-gold/20 text-gold border border-gold/40 cursor-pointer disabled:opacity-40">
              Agregar
            </button>
          </div>
        </Field>
      )}

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

      {/* Editor de crop cuadrado para la foto de perfil */}
      <PhotoCropEditor
        file={pendingPhoto}
        open={!!pendingPhoto}
        onClose={() => setPendingPhoto(null)}
        onApply={uploadCropped}
        aspect={ASPECT_SQUARE}
        label="Ajustar foto de perfil"
      />
    </div>
  );
}
