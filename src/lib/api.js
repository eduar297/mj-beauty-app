import { supabase } from './supabase';
import imageCompression from 'browser-image-compression';

// Extrae el path interno (después de "/services/") de una URL pública del bucket.
const pathFromUrl = (url) => {
  if (!url) return null;
  const m = url.match(/\/services\/(.+)$/);
  return m ? m[1] : null;
};

// Para que el nombre del archivo en Storage refleje el formato real del blob
// (browser-image-compression puede entregar webp, jpeg o png según fileType).
const extFromMime = (mime) => {
  switch (mime) {
    case 'image/webp': return 'webp';
    case 'image/jpeg': return 'jpg';
    case 'image/png':  return 'png';
    default: return null;
  }
};

// ─── STAFF ───────────────────────────────────────────────────────────
export const api_staff = {
  list: () => supabase.from('staff').select('*').eq('active', true).order('name'),
  // Lista pública (sin PIN ni email) para mostrar avatares en la pantalla de login.
  listForLogin: () =>
    supabase.from('staff').select('id,name,role,color,initials,photo_url').eq('active', true).order('name'),
  // Verifica que el PIN coincida con la empleada seleccionada.
  byIdAndPin: (id, pin) =>
    supabase.from('staff').select('*').eq('id', id).eq('pin', pin).eq('active', true).maybeSingle(),
  create: (data) => supabase.from('staff').insert(data).select().single(),
  update: (id, data) => supabase.from('staff').update(data).eq('id', id).select().single(),
  remove: (id) => supabase.from('staff').update({ active: false }).eq('id', id),
  uploadPhoto: async (file, name) => {
    // Avatar redondo, 30–80px en UI. 800px wide cubre hi-DPI con margen.
    // WebP da ~25–30% menos peso que JPEG a calidad equivalente.
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.25,
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.82,
    });
    const ext = extFromMime(compressed.type) || (file.name?.split('.').pop() || 'jpg').toLowerCase();
    const slug = (name || 'empleada').replace(/\W+/g, '-').toLowerCase();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${slug}.${ext}`;
    const { error } = await supabase.storage.from('staff')
      .upload(path, compressed, { contentType: compressed.type, upsert: false });
    if (error) throw error;
    return supabase.storage.from('staff').getPublicUrl(path).data.publicUrl;
  },
};

// ─── CLIENTS ─────────────────────────────────────────────────────────
// Normaliza el teléfono para comparaciones consistentes (acepta tipeo libre).
const normalizePhone = (p) => (p || '').replace(/[\s\-().]/g, '').trim();

export const api_clients = {
  list: () => supabase.from('clients').select('*').order('name'),
  create: (data) => supabase.from('clients').insert(data).select().single(),
  update: (id, data) => supabase.from('clients').update(data).eq('id', id).select().single(),
  remove: (id) => supabase.from('clients').delete().eq('id', id),

  // Lookup público — solo expone id+name (privacidad: el teléfono lo tipea cualquiera).
  findByPhone: async (phone) => {
    const p = normalizePhone(phone);
    if (!p || p.length < 6) return { data: null };
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, status')
      .eq('phone', p)
      .maybeSingle();
    if (error) return { data: null, error };
    return { data };
  },

  // Idempotente: por teléfono. Devuelve { id, isNew } para que el caller pueda
  // mostrar "Quedaste registrada" cuando aplique.
  upsertByPhone: async ({ phone, name }) => {
    const p = normalizePhone(phone);
    if (!p) throw new Error('Teléfono requerido');
    const cleanName = (name || '').trim();
    const { data: existing } = await supabase
      .from('clients').select('id, name').eq('phone', p).maybeSingle();
    if (existing) {
      if (cleanName && cleanName !== existing.name) {
        await supabase.from('clients').update({ name: cleanName }).eq('id', existing.id);
      }
      return { id: existing.id, isNew: false };
    }
    const { data: created, error } = await supabase
      .from('clients')
      .insert({ name: cleanName || 'Clienta', phone: p, status: 'new' })
      .select('id').single();
    if (error) throw error;
    return { id: created.id, isNew: true };
  },
};

// ─── SERVICES ────────────────────────────────────────────────────────
export const api_services = {
  // Orden: por categoría → orden manual (sort_order) → nombre (estable cuando
  // varios servicios tienen el mismo sort_order, p.ej. recién creados).
  list: () =>
    supabase.from('services').select('*').eq('active', true)
      .order('cat').order('sort_order').order('name'),
  listPublic: () =>
    supabase.from('services').select('*').eq('active', true)
      .order('cat').order('sort_order').order('name'),
  create: (data) => supabase.from('services').insert(data).select().single(),
  update: (id, data) => supabase.from('services').update(data).eq('id', id).select().single(),
  remove: (id) => supabase.from('services').update({ active: false }).eq('id', id),
  // Reordena un set de servicios. Recibe los IDs en el orden deseado; asigna
  // sort_order = i a cada uno. Solo se hace para los IDs pasados (típico:
  // todos los servicios de una categoría), así no toca otras categorías.
  reorder: async (orderedIds) => {
    // updates secuenciales — la tabla es pequeña (decenas de servicios).
    for (let i = 0; i < orderedIds.length; i++) {
      await supabase.from('services').update({ sort_order: i }).eq('id', orderedIds[i]);
    }
    return { ok: true };
  },
  uploadPhoto: async (file, name, serviceId) => {
    // Fotos de servicio: se ven a ~340×190 en cards y ~512×288 en detalle.
    // 1600px wide es suficiente con margen para hi-DPI. WebP recorta peso ~25-30%.
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.85,
    });
    const ext = extFromMime(compressed.type) || (file.name?.split('.').pop() || 'jpg').toLowerCase();
    const slug = (name || 'foto').replace(/\W+/g, '-').toLowerCase();
    const folder = serviceId ? `${serviceId}/` : '';
    const path = `${folder}${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${slug}.${ext}`;
    const { error } = await supabase.storage.from('services')
      .upload(path, compressed, { contentType: compressed.type, upsert: false });
    if (error) throw error;
    return supabase.storage.from('services').getPublicUrl(path).data.publicUrl;
  },
};

// ─── SERVICE PHOTOS (galería multi-foto por servicio) ────────────────
export const api_service_photos = {
  byService: (serviceId) =>
    supabase.from('service_photos').select('*').eq('service_id', serviceId)
      .order('sort_order').order('created_at'),

  listAll: () =>
    supabase.from('service_photos').select('*, services(name,cat,popular)')
      .order('created_at', { ascending: false }),

  // Landing: featured manuales + fotos de servicios populares, sin duplicar.
  listForLanding: async (limit = 12) => {
    const [{ data: feat }, { data: pop }] = await Promise.all([
      supabase.from('service_photos').select('*, services(name,cat)')
        .eq('featured', true).order('created_at', { ascending: false }),
      supabase.from('service_photos').select('*, services!inner(name,cat,popular)')
        .eq('services.popular', true).order('created_at', { ascending: false }),
    ]);
    const seen = new Set();
    const out = [];
    for (const p of [...(feat || []), ...(pop || [])]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id); out.push(p);
      if (out.length >= limit) break;
    }
    return { data: out };
  },

  create: (data) => supabase.from('service_photos').insert(data).select().single(),
  update: (id, data) => supabase.from('service_photos').update(data).eq('id', id).select().single(),

  remove: async (id) => {
    const { data: row } = await supabase.from('service_photos').select('*').eq('id', id).maybeSingle();
    if (row) {
      const paths = [row.url, row.before_url, row.after_url].map(pathFromUrl).filter(Boolean);
      if (paths.length) await supabase.storage.from('services').remove(paths);
    }
    return supabase.from('service_photos').delete().eq('id', id);
  },
};

// ─── PRODUCTS (productos de belleza a la venta) ──────────────────────
export const api_products = {
  // Mismo orden que services: categoría → orden manual → nombre.
  list: () =>
    supabase.from('products').select('*').eq('active', true)
      .order('cat').order('sort_order').order('name'),
  listPublic: () =>
    supabase.from('products').select('*').eq('active', true)
      .order('cat').order('sort_order').order('name'),
  // Destacados para la sección de la landing.
  listFeatured: (limit = 8) =>
    supabase.from('products').select('*').eq('active', true).eq('featured', true)
      .order('sort_order').order('name').limit(limit),
  create: (data) => supabase.from('products').insert(data).select().single(),
  update: (id, data) => supabase.from('products').update(data).eq('id', id).select().single(),
  remove: (id) => supabase.from('products').update({ active: false }).eq('id', id),
  reorder: async (orderedIds) => {
    // updates secuenciales — la tabla es pequeña (decenas de productos).
    for (let i = 0; i < orderedIds.length; i++) {
      await supabase.from('products').update({ sort_order: i }).eq('id', orderedIds[i]);
    }
    return { ok: true };
  },
  // Suma/resta unidades clampando en 0 (la BD tiene check stock >= 0).
  adjustStock: async (id, delta) => {
    const { data: row } = await supabase.from('products').select('stock').eq('id', id).maybeSingle();
    const next = Math.max(0, (row?.stock ?? 0) + delta);
    return supabase.from('products').update({ stock: next }).eq('id', id).select().single();
  },
  uploadPhoto: async (file, name) => {
    // Fotos de producto: cards cuadradas de ~220-320px. 1200px cubre hi-DPI.
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.4,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.85,
    });
    const ext = extFromMime(compressed.type) || (file.name?.split('.').pop() || 'jpg').toLowerCase();
    const slug = (name || 'producto').replace(/\W+/g, '-').toLowerCase();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${slug}.${ext}`;
    const { error } = await supabase.storage.from('products')
      .upload(path, compressed, { contentType: compressed.type, upsert: false });
    if (error) throw error;
    return supabase.storage.from('products').getPublicUrl(path).data.publicUrl;
  },
};

// ─── APPOINTMENTS ────────────────────────────────────────────────────
// Recolecta destinatarios para una notificación de cita:
// siempre todas las admins activas + la empleada asignada (si existe y no es admin).
const _collectAppointmentRecipients = async (staffId) => {
  const { data: admins } = await supabase
    .from('staff').select('id').eq('role', 'admin').eq('active', true);
  const set = new Set((admins || []).map(a => a.id));
  if (staffId) set.add(staffId);
  return Array.from(set);
};

const _fetchApptWithRefs = async (id) => {
  const { data } = await supabase
    .from('appointments')
    .select('id, date, time, status, staff_id, clients(name), services(name)')
    .eq('id', id).maybeSingle();
  return data;
};

const _notifyAppointment = async (apptId, type, overrideStaffId = null) => {
  const appt = await _fetchApptWithRefs(apptId);
  if (!appt) return;
  const recipients = await _collectAppointmentRecipients(overrideStaffId ?? appt.staff_id);
  if (recipients.length === 0) return;
  const clientName = appt.clients?.name || 'Clienta';
  const svcName = appt.services?.name || 'servicio';
  const fmtDate = appt.date;
  const fmtTime = (appt.time || '').slice(0, 5);
  const titles = {
    appointment_pending:   'Nueva cita pendiente',
    appointment_confirmed: 'Cita confirmada',
    appointment_cancelled: 'Cita cancelada',
  };
  const rows = recipients.map(rid => ({
    recipient_staff_id: rid,
    type,
    appointment_id: appt.id,
    title: titles[type] || 'Cita',
    body: `${clientName} · ${svcName} · ${fmtDate} ${fmtTime}`,
  }));
  await supabase.from('notifications').insert(rows);
};

export const api_appointments = {
  // list('2026-05-18')                 → un solo día (compat anterior)
  // list({ from: '..', to: '..' })     → rango inclusivo (semana / mes)
  list: (arg) => {
    // IMPORTANTE: appointments tiene 2 FKs hacia staff (staff_id y
    // preferred_staff_id), así que el join debe ser explícito o PostgREST
    // devuelve error de "ambiguous relationship". `staff!staff_id(...)`
    // fuerza usar la FK de staff_id; lo mismo aplica si quisiéramos
    // mostrar la empleada preferida.
    let q = supabase.from('appointments').select(
      '*, clients(name,phone), staff:staff_id(name,color), services(name,cat,duration)'
    );
    if (typeof arg === 'string') q = q.eq('date', arg);
    else if (arg && typeof arg === 'object') {
      if (arg.from) q = q.gte('date', arg.from);
      if (arg.to)   q = q.lte('date', arg.to);
    }
    return q.order('date').order('time');
  },
  // Listado mínimo para computar slots públicos (solo lo necesario para
  // detectar conflictos: staff_id, date, time, duration, status).
  listForAvailability: ({ from, to }) =>
    supabase.from('appointments').select('staff_id, date, time, duration, status')
      .gte('date', from).lte('date', to),

  create: async (data) => {
    const res = await supabase.from('appointments').insert(data).select().single();
    if (!res.error && res.data) {
      // Solo notificamos cuando es pendiente (booking público o admin marca pending).
      if (res.data.status === 'pending') {
        try { await _notifyAppointment(res.data.id, 'appointment_pending'); } catch {}
      }
    }
    return res;
  },

  update: async (id, data) => {
    // Capturar el estado previo para detectar transiciones.
    const { data: before } = await supabase
      .from('appointments').select('status, staff_id').eq('id', id).maybeSingle();
    const res = await supabase.from('appointments').update(data).eq('id', id).select().single();
    if (!res.error && res.data && before) {
      if (before.status !== res.data.status) {
        if (res.data.status === 'confirmed') {
          try { await _notifyAppointment(id, 'appointment_confirmed'); } catch {}
        } else if (res.data.status === 'cancelled') {
          try { await _notifyAppointment(id, 'appointment_cancelled'); } catch {}
        }
      }
    }
    return res;
  },
  remove: (id) => supabase.from('appointments').delete().eq('id', id),
  // Realtime — cada llamada crea su propio canal para permitir varios suscriptores.
  subscribe: (callback) => {
    const name = `appointments_${Math.random().toString(36).slice(2, 9)}`;
    return supabase
      .channel(name)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, callback)
      .subscribe();
  },
};

// ─── SITE SETTINGS (personalización pública) ─────────────────────────
export const api_settings = {
  get: () => supabase.from('site_settings').select('*').eq('id', 1).maybeSingle(),
  update: (data) =>
    supabase.from('site_settings')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select()
      .single(),
};

// ─── TRANSACTIONS ────────────────────────────────────────────────────
export const api_transactions = {
  list: (date) => {
    let q = supabase.from('transactions').select('*');
    if (date) q = q.eq('date', date);
    return q.order('time', { ascending: false });
  },
  create: (data) => supabase.from('transactions').insert(data).select().single(),
  subscribe: (callback) => {
    const name = `transactions_${Math.random().toString(36).slice(2, 9)}`;
    return supabase
      .channel(name)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, callback)
      .subscribe();
  },
};

// ─── STAFF ↔ SERVICES (qué servicios hace cada empleada) ────────────
export const api_staff_services = {
  byStaff: (staffId) =>
    supabase.from('staff_services').select('service_id').eq('staff_id', staffId),
  byService: (serviceId) =>
    supabase.from('staff_services').select('staff_id').eq('service_id', serviceId),
  // Set canónico: borra los que sobran, inserta los nuevos. Idempotente.
  set: async (staffId, serviceIds) => {
    const current = await supabase
      .from('staff_services').select('service_id').eq('staff_id', staffId);
    const currentIds = new Set((current.data || []).map(r => r.service_id));
    const wantIds = new Set(serviceIds || []);
    const toRemove = [...currentIds].filter(id => !wantIds.has(id));
    const toAdd    = [...wantIds].filter(id => !currentIds.has(id));
    if (toRemove.length) {
      await supabase.from('staff_services').delete()
        .eq('staff_id', staffId).in('service_id', toRemove);
    }
    if (toAdd.length) {
      await supabase.from('staff_services')
        .insert(toAdd.map(sid => ({ staff_id: staffId, service_id: sid })));
    }
    return { ok: true };
  },
};

// ─── STAFF TIME OFF (bloqueos / vacaciones) ─────────────────────────
export const api_time_off = {
  byStaff: (staffId, fromIso = null) => {
    let q = supabase.from('staff_time_off').select('*').eq('staff_id', staffId);
    if (fromIso) q = q.gte('end_at', fromIso);
    return q.order('start_at');
  },
  byDateRange: (fromIso, toIso) =>
    supabase.from('staff_time_off').select('id, staff_id, start_at, end_at')
      .lte('start_at', toIso).gte('end_at', fromIso),
  create: (data) => supabase.from('staff_time_off').insert(data).select().single(),
  remove: (id) => supabase.from('staff_time_off').delete().eq('id', id),
};

// ─── NOTIFICATIONS (centro por empleada con realtime) ───────────────
export const api_notifications = {
  listForStaff: (staffId, limit = 20) =>
    supabase.from('notifications').select('*')
      .eq('recipient_staff_id', staffId)
      .order('created_at', { ascending: false })
      .limit(limit),
  unreadCount: (staffId) =>
    supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('recipient_staff_id', staffId).is('read_at', null),
  markRead: (id) =>
    supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id),
  markAllRead: (staffId) =>
    supabase.from('notifications').update({ read_at: new Date().toISOString() })
      .eq('recipient_staff_id', staffId).is('read_at', null),
  subscribe: (staffId, callback) => {
    const name = `notifications_${staffId}_${Math.random().toString(36).slice(2, 9)}`;
    return supabase
      .channel(name)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_staff_id=eq.${staffId}`,
        },
        callback,
      )
      .subscribe();
  },
};
