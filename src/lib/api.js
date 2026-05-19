import { supabase } from './supabase';
import imageCompression from 'browser-image-compression';

// Extrae el path interno (después de "/services/") de una URL pública del bucket.
const pathFromUrl = (url) => {
  if (!url) return null;
  const m = url.match(/\/services\/(.+)$/);
  return m ? m[1] : null;
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
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.6, maxWidthOrHeight: 800, useWebWorker: true,
    });
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const slug = (name || 'empleada').replace(/\W+/g, '-').toLowerCase();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${slug}.${ext}`;
    const { error } = await supabase.storage.from('staff').upload(path, compressed);
    if (error) throw error;
    return supabase.storage.from('staff').getPublicUrl(path).data.publicUrl;
  },
};

// ─── CLIENTS ─────────────────────────────────────────────────────────
export const api_clients = {
  list: () => supabase.from('clients').select('*').order('name'),
  create: (data) => supabase.from('clients').insert(data).select().single(),
  update: (id, data) => supabase.from('clients').update(data).eq('id', id).select().single(),
  remove: (id) => supabase.from('clients').delete().eq('id', id),
};

// ─── SERVICES ────────────────────────────────────────────────────────
export const api_services = {
  list: () => supabase.from('services').select('*').eq('active', true).order('cat'),
  listPublic: () => supabase.from('services').select('*').eq('active', true).order('cat'),
  create: (data) => supabase.from('services').insert(data).select().single(),
  update: (id, data) => supabase.from('services').update(data).eq('id', id).select().single(),
  remove: (id) => supabase.from('services').update({ active: false }).eq('id', id),
  uploadPhoto: async (file, name, serviceId) => {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1.2, maxWidthOrHeight: 2000, useWebWorker: true,
    });
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const slug = (name || 'foto').replace(/\W+/g, '-').toLowerCase();
    const folder = serviceId ? `${serviceId}/` : '';
    const path = `${folder}${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${slug}.${ext}`;
    const { error } = await supabase.storage.from('services').upload(path, compressed);
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

// ─── APPOINTMENTS ────────────────────────────────────────────────────
export const api_appointments = {
  // list('2026-05-18')                 → un solo día (compat anterior)
  // list({ from: '..', to: '..' })     → rango inclusivo (semana / mes)
  list: (arg) => {
    let q = supabase.from('appointments').select('*, clients(name), staff(name,color), services(name,cat)');
    if (typeof arg === 'string') q = q.eq('date', arg);
    else if (arg && typeof arg === 'object') {
      if (arg.from) q = q.gte('date', arg.from);
      if (arg.to)   q = q.lte('date', arg.to);
    }
    return q.order('date').order('time');
  },
  create: (data) => supabase.from('appointments').insert(data).select().single(),
  update: (id, data) => supabase.from('appointments').update(data).eq('id', id).select().single(),
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
