import { supabase } from './supabase';

// ─── STAFF ───────────────────────────────────────────────────────────
export const api_staff = {
  list: () => supabase.from('staff').select('*').eq('active', true).order('name'),
  byPin: (pin) => supabase.from('staff').select('*').eq('pin', pin).eq('active', true).maybeSingle(),
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
  list: (date) => {
    let q = supabase.from('appointments').select('*, clients(name), staff(name,color), services(name,cat)');
    if (date) q = q.eq('date', date);
    return q.order('time');
  },
  create: (data) => supabase.from('appointments').insert(data).select().single(),
  update: (id, data) => supabase.from('appointments').update(data).eq('id', id).select().single(),
  remove: (id) => supabase.from('appointments').delete().eq('id', id),
  // Realtime
  subscribe: (callback) => {
    return supabase
      .channel('appointments_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, callback)
      .subscribe();
  },
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
    return supabase
      .channel('transactions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, callback)
      .subscribe();
  },
};
