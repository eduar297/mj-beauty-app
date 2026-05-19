import { supabase } from './supabase';

// ─── STAFF ───────────────────────────────────────────────────────────
export const api_staff = {
  list: () => supabase.from('staff').select('*').eq('active', true).order('name'),
  // Lista pública (sin PIN ni email) para mostrar avatares en la pantalla de login.
  listForLogin: () =>
    supabase.from('staff').select('id,name,role,color,initials').eq('active', true).order('name'),
  // Verifica que el PIN coincida con la empleada seleccionada.
  byIdAndPin: (id, pin) =>
    supabase.from('staff').select('*').eq('id', id).eq('pin', pin).eq('active', true).maybeSingle(),
  create: (data) => supabase.from('staff').insert(data).select().single(),
  update: (id, data) => supabase.from('staff').update(data).eq('id', id).select().single(),
  remove: (id) => supabase.from('staff').update({ active: false }).eq('id', id),
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
  uploadPhoto: async (file, name) => {
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}-${name.replace(/\W+/g, '-')}.${ext}`;
    const { error } = await supabase.storage.from('services').upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from('services').getPublicUrl(path);
    return data.publicUrl;
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
