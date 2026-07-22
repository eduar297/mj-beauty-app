-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  MJ Beauty — Supabase schema                                      ║
-- ║  Pega este archivo entero en: Supabase → SQL Editor → Run         ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- ───── Extensiones ──────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ───── Tabla: staff (empleadas + admin) ─────────────────────────────
-- Nota: el login pide primero empleada + luego PIN, así que el PIN
-- NO necesita ser único globalmente — dos empleadas pueden tener el mismo.
create table if not exists staff (
  id uuid primary key default uuid_generate_v4(),
  pin text not null,                        -- 4 dígitos para login
  name text not null,
  role text not null check (role in ('admin', 'empleada')),
  phone text,
  color text default '#c9a96e',
  initials text,
  schedule text,
  bio text,
  rating numeric(2,1) default 5.0,
  specialties text[] default '{}',
  active boolean default true,
  created_at timestamptz default now()
);

-- Migration: si la tabla ya existía con UNIQUE(pin), quítalo.
alter table staff drop constraint if exists staff_pin_key;
-- Migration: el correo de empleadas ya no se usa.
alter table staff drop column if exists email;
-- Migration: foto de perfil de empleadas.
alter table staff add column if not exists photo_url text;
-- Migration: horario semanal (jsonb { mon:{start,end}|null, tue:..., ... }).
alter table staff add column if not exists weekly_hours jsonb default '{}'::jsonb;

-- ───── Tabla: clients ───────────────────────────────────────────────
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  status text default 'regular' check (status in ('regular','vip','new')),
  notes text,
  fav text,
  visits int default 0,
  spent numeric(12,0) default 0,
  last_visit date,
  created_at timestamptz default now()
);

-- Migration: el correo de clientas ya no se usa.
alter table clients drop column if exists email;
-- Index para lookup público por teléfono en el booking.
create index if not exists clients_phone_idx on clients(phone);
-- Migration: normalizar teléfonos a solo dígitos — el buscador público
-- compara sin espacios/+/guiones, y los guardados desde el dashboard
-- venían con formato (p.ej. "+53 5 4208213") y nunca coincidían.
update clients set phone = regexp_replace(phone, '\D', '', 'g')
  where phone is not null and phone ~ '\D';

-- ───── Tabla: services ──────────────────────────────────────────────
create table if not exists services (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  cat text not null check (cat in ('Uñas','Pedicura','Pelo','Faciales','Cejas','Pestañas')),
  duration int not null default 60,
  price numeric(12,0) not null default 0,
  description text,
  photo_url text,
  popular boolean default false,
  active boolean default true,
  created_at timestamptz default now()
);

-- Migration: agregar 'Pedicura' a la lista permitida (idempotente).
alter table services drop constraint if exists services_cat_check;
alter table services add constraint services_cat_check
  check (cat in ('Uñas','Pedicura','Pelo','Faciales','Cejas','Pestañas'));

-- Migration: rangos opcionales para duración y precio (e.g. "30-60 min", "$50k-$80k").
-- duration y price siguen siendo los valores base (usados para la reserva real).
-- *_max es opcional; si es null o ≤ base, el front muestra solo el valor base.
alter table services add column if not exists duration_max int;
alter table services add column if not exists price_max numeric(12,0);

-- Migration: orden manual para drag-and-drop dentro del dashboard.
-- El front lista por (cat, sort_order, name). Inicialmente todos los servicios
-- comparten sort_order=0, pero el admin puede reordenar.
alter table services add column if not exists sort_order int default 0;
create index if not exists services_sort_idx on services(cat, sort_order);

-- ───── Tabla: appointments ──────────────────────────────────────────
create table if not exists appointments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete set null,
  staff_id uuid references staff(id) on delete set null,
  service_id uuid references services(id) on delete set null,
  date date not null,
  time time not null,
  duration int not null default 60,
  status text default 'pending' check (status in ('pending','confirmed','cancelled','completed')),
  notes text,
  created_at timestamptz default now()
);

-- Migration: preferencia opcional de empleada elegida por la clienta al reservar.
alter table appointments add column if not exists preferred_staff_id uuid references staff(id) on delete set null;

-- Migration: varios servicios por cita (ej: pestañas + uñas en la misma cita).
-- service_id sigue siendo el servicio "principal" (= service_ids[1]) para
-- compatibilidad con caja, agenda y notificaciones; service_ids guarda todos.
-- duration ya es la suma total, así que la agenda y la disponibilidad no cambian.
alter table appointments add column if not exists service_ids uuid[];
update appointments set service_ids = array[service_id]
  where service_ids is null and service_id is not null;

-- ───── Tabla: site_settings (personalización pública) ──────────────
-- Fila única (id = 1). El admin edita estos campos desde el dashboard
-- y la landing los lee para renderizar Nosotras / Contacto.
create table if not exists site_settings (
  id int primary key default 1,
  business_name text default 'MJ Beauty',
  tagline text default 'Salón de Belleza Premium',
  about_title text default 'Sobre Nosotras',
  about_text text,
  phone text,
  whatsapp text,
  email text,
  address text,
  city text,
  hours_weekday text,
  hours_saturday text,
  hours_sunday text,
  instagram_url text,
  facebook_url text,
  tiktok_url text,
  google_maps_url text,
  updated_at timestamptz default now(),
  constraint site_settings_singleton check (id = 1)
);

insert into site_settings (id) values (1) on conflict do nothing;

-- Migration: fotos de portada por categoría de servicio en la landing
-- (jsonb { 'Uñas': url, 'Pelo': url, ... }). El admin las edita desde
-- Personalización; la landing usa el fallback /assets/svc-*.jpeg si falta.
alter table site_settings add column if not exists service_cat_photos jsonb default '{}'::jsonb;

-- ───── Tabla: transactions (caja) ───────────────────────────────────
create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  appointment_id uuid references appointments(id) on delete set null,
  client_name text,
  service_name text,
  staff_name text,
  amount numeric(12,0) not null default 0,
  method text not null check (method in ('efectivo','tarjeta','transferencia')),
  date date default current_date,
  time time default current_time,
  created_at timestamptz default now()
);

-- ───── Tabla: staff_services (relación N-N entre empleadas y servicios) ─
create table if not exists staff_services (
  staff_id   uuid not null references staff(id)    on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  primary key (staff_id, service_id)
);
create index if not exists staff_services_service_id_idx on staff_services(service_id);

-- ───── Tabla: staff_time_off (bloqueos puntuales / vacaciones) ──────
create table if not exists staff_time_off (
  id uuid primary key default uuid_generate_v4(),
  staff_id uuid not null references staff(id) on delete cascade,
  start_at timestamptz not null,
  end_at   timestamptz not null,
  reason text,
  created_at timestamptz default now(),
  constraint staff_time_off_valid_range check (end_at > start_at)
);
create index if not exists staff_time_off_staff_idx on staff_time_off(staff_id, start_at);

-- ───── Tabla: notifications (centro de notificaciones por empleada) ─
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_staff_id uuid not null references staff(id) on delete cascade,
  type text not null check (type in ('appointment_pending','appointment_confirmed','appointment_cancelled')),
  appointment_id uuid references appointments(id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists notifications_recipient_unread_idx
  on notifications(recipient_staff_id, created_at desc)
  where read_at is null;
create index if not exists notifications_recipient_all_idx
  on notifications(recipient_staff_id, created_at desc);

-- ───── Realtime: activar para appointments, transactions y notifications ─
-- Idempotente: ignora el error si la tabla ya está en la publicación.
do $$
begin
  alter publication supabase_realtime add table appointments;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table transactions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table notifications;
exception when duplicate_object then null;
end $$;

-- ───── Storage: bucket para fotos de servicios ──────────────────────
insert into storage.buckets (id, name, public)
values ('services', 'services', true)
on conflict do nothing;

-- ───── Storage: bucket para fotos de perfil de empleadas ───────────
insert into storage.buckets (id, name, public)
values ('staff', 'staff', true)
on conflict do nothing;

-- ───── RLS (Row Level Security) ─────────────────────────────────────
-- Para esta versión simple: lectura pública en services + clients
-- (auth de admin se hace por PIN, no por sesión Supabase Auth)
-- Si quieres cerrar todo más adelante, activamos RLS aquí.

alter table staff enable row level security;
alter table clients enable row level security;
alter table services enable row level security;
alter table appointments enable row level security;
alter table transactions enable row level security;
alter table site_settings enable row level security;

-- Lectura pública de servicios (para la landing)
drop policy if exists "services_public_read" on services;
create policy "services_public_read" on services for select using (true);

-- Lectura pública de site_settings (para Nosotras / Contacto en landing)
drop policy if exists "site_settings_public_read" on site_settings;
create policy "site_settings_public_read" on site_settings for select using (true);
drop policy if exists "site_settings_anon_all" on site_settings;
create policy "site_settings_anon_all" on site_settings for all using (true);

-- Por simplicidad: permitir todo lo demás con anon key
-- (cambia a políticas reales cuando uses Supabase Auth)
drop policy if exists "staff_anon_all"        on staff;
create policy "staff_anon_all"        on staff        for all using (true);
drop policy if exists "clients_anon_all"      on clients;
create policy "clients_anon_all"      on clients      for all using (true);
drop policy if exists "services_anon_all"     on services;
create policy "services_anon_all"     on services     for all using (true);
drop policy if exists "appointments_anon_all" on appointments;
create policy "appointments_anon_all" on appointments for all using (true);
drop policy if exists "transactions_anon_all" on transactions;
create policy "transactions_anon_all" on transactions for all using (true);

-- RLS para las nuevas tablas (mismo modelo "anon_all" hasta que migremos a Supabase Auth)
alter table staff_services enable row level security;
alter table staff_time_off enable row level security;
alter table notifications  enable row level security;

drop policy if exists "staff_services_anon_all" on staff_services;
create policy "staff_services_anon_all" on staff_services for all using (true);

drop policy if exists "staff_time_off_anon_all" on staff_time_off;
create policy "staff_time_off_anon_all" on staff_time_off for all using (true);

-- Lectura pública limitada de staff_time_off (necesaria para que el booking
-- público pueda computar slots disponibles). Toda la tabla; el riesgo es bajo
-- porque solo contiene start/end/reason, sin PII.
drop policy if exists "staff_time_off_public_read" on staff_time_off;
create policy "staff_time_off_public_read" on staff_time_off for select using (true);

drop policy if exists "notifications_anon_all" on notifications;
create policy "notifications_anon_all" on notifications for all using (true);

-- Storage: lectura pública del bucket services
drop policy if exists "services_storage_public" on storage.objects;
create policy "services_storage_public" on storage.objects for select
using (bucket_id = 'services');

drop policy if exists "services_storage_upload" on storage.objects;
create policy "services_storage_upload" on storage.objects for insert
with check (bucket_id = 'services');

drop policy if exists "services_storage_delete" on storage.objects;
create policy "services_storage_delete" on storage.objects for delete
using (bucket_id = 'services');

-- Storage: políticas del bucket staff
drop policy if exists "staff_storage_public" on storage.objects;
create policy "staff_storage_public" on storage.objects for select
using (bucket_id = 'staff');

drop policy if exists "staff_storage_upload" on storage.objects;
create policy "staff_storage_upload" on storage.objects for insert
with check (bucket_id = 'staff');

drop policy if exists "staff_storage_delete" on storage.objects;
create policy "staff_storage_delete" on storage.objects for delete
using (bucket_id = 'staff');

-- ───── Tabla: service_photos (galería multi-foto por servicio) ──────
create table if not exists service_photos (
  id uuid primary key default uuid_generate_v4(),
  service_id uuid not null references services(id) on delete cascade,
  kind text not null check (kind in ('normal','pair','combined')),
  url text,                 -- usado por kind = 'normal' y 'combined'
  before_url text,          -- usado por kind = 'pair'
  after_url  text,          -- usado por kind = 'pair'
  caption text,
  featured boolean default false,
  sort_order int default 0,
  created_at timestamptz default now()
);

create index if not exists service_photos_service_id_idx on service_photos(service_id);
create index if not exists service_photos_featured_idx   on service_photos(featured) where featured = true;

alter table service_photos enable row level security;
drop policy if exists "service_photos_public_read" on service_photos;
create policy "service_photos_public_read" on service_photos for select using (true);
drop policy if exists "service_photos_anon_all"   on service_photos;
create policy "service_photos_anon_all"   on service_photos for all using (true);

-- ───── Tabla: products (productos de belleza a la venta) ────────────
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  cat text not null default 'Otros'
    check (cat in ('Uñas','Piel','Cabello','Maquillaje','Accesorios','Otros')),
  description text,
  price numeric(12,0) not null default 0,
  photo_url text,
  stock int not null default 0 check (stock >= 0),
  featured boolean default false,           -- destacado en la landing
  active boolean default true,              -- soft delete
  sort_order int default 0,                 -- orden manual (drag-and-drop)
  created_at timestamptz default now()
);
create index if not exists products_sort_idx on products(cat, sort_order);

alter table products enable row level security;
drop policy if exists "products_public_read" on products;
create policy "products_public_read" on products for select using (true);
drop policy if exists "products_anon_all" on products;
create policy "products_anon_all" on products for all using (true);

-- Storage: bucket para fotos de productos
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict do nothing;

drop policy if exists "products_storage_public" on storage.objects;
create policy "products_storage_public" on storage.objects for select
using (bucket_id = 'products');

drop policy if exists "products_storage_upload" on storage.objects;
create policy "products_storage_upload" on storage.objects for insert
with check (bucket_id = 'products');

drop policy if exists "products_storage_delete" on storage.objects;
create policy "products_storage_delete" on storage.objects for delete
using (bucket_id = 'products');

-- ───── Migration: precios en USD con centavos ──────────────────────
-- Antes los montos eran numeric(_,0) (COP sin decimales). Ahora la app
-- maneja dólares, así que permitimos 2 decimales (ej: 2.99).
alter table products     alter column price     type numeric(12,2);
alter table services     alter column price     type numeric(12,2);
alter table services     alter column price_max type numeric(12,2);
alter table transactions alter column amount    type numeric(12,2);
alter table clients      alter column spent     type numeric(12,2);

-- ───── Tabla: reviews (reseñas públicas de clientas) ────────────────
create table if not exists reviews (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  phone text,                               -- identifica a la clienta; NO se muestra en la web
  client_id uuid references clients(id) on delete set null,
  approved boolean default true,            -- el admin puede ocultar reseñas
  created_at timestamptz default now()
);
create index if not exists reviews_created_idx on reviews(created_at desc);

-- Migration: identidad de la clienta (buscador por teléfono, como en reservas).
alter table reviews add column if not exists phone text;
alter table reviews add column if not exists client_id uuid references clients(id) on delete set null;

alter table reviews enable row level security;
drop policy if exists "reviews_public_read" on reviews;
create policy "reviews_public_read" on reviews for select using (true);
drop policy if exists "reviews_anon_all" on reviews;
create policy "reviews_anon_all" on reviews for all using (true);

-- ───── Telegram: avisos de reservas y reseñas ───────────────────────
-- Config privada (token del bot + chat destino). RLS activo SIN políticas:
-- la anon key NO puede leer esta tabla; solo las funciones security definer.
create extension if not exists pg_net;

create table if not exists notify_config (
  id boolean primary key default true check (id),   -- fila única
  telegram_token text,
  telegram_chat_id text
);
alter table notify_config enable row level security;
insert into notify_config (id) values (true) on conflict do nothing;

-- El token se configura UNA vez, aparte (no lo guardes en git):
--   update notify_config set telegram_token = '<TOKEN>', telegram_chat_id = '<CHAT_ID>';
-- telegram_chat_id admite varios destinatarios separados por coma.

-- Envía un mensaje a cada chat configurado. Si falta config o falla la red,
-- no hace nada (jamás debe romper el insert que lo disparó).
create or replace function tg_send(msg text) returns void
language plpgsql security definer set search_path = public as $$
declare cfg record; cid text;
begin
  select telegram_token, telegram_chat_id into cfg from notify_config where id;
  if cfg.telegram_token is null or cfg.telegram_chat_id is null then return; end if;
  foreach cid in array string_to_array(cfg.telegram_chat_id, ',') loop
    perform net.http_post(
      url  := 'https://api.telegram.org/bot' || cfg.telegram_token || '/sendMessage',
      body := jsonb_build_object('chat_id', trim(cid), 'text', msg)
    );
  end loop;
exception when others then null;
end $$;

-- Que la anon key no pueda invocarla vía PostgREST (/rpc/tg_send).
revoke execute on function tg_send(text) from anon, authenticated;

-- Completa el código de país si falta (móviles cubanos: 8 dígitos, empiezan
-- con 5). Así Telegram muestra el número tocable y el link de WhatsApp abre
-- el chat directo.
create or replace function tg_full_phone(p text) returns text
language sql immutable as $$
  select case
    when p is null or p = '' then null
    when length(p) = 8 and p like '5%' then '53' || p
    else p
  end
$$;

-- Línea de contacto para los mensajes: "📞 +53... · https://wa.me/53..."
create or replace function tg_contact_line(p text) returns text
language sql immutable as $$
  select coalesce(
    E'\n' || '📞 +' || tg_full_phone(p) || ' · https://wa.me/' || tg_full_phone(p),
    ''
  )
$$;

create or replace function tg_notify_appointment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_client text; v_phone text; v_service text; v_staff text; v_pref text; msg text;
begin
  select name, phone into v_client, v_phone from clients where id = new.client_id;
  -- Todos los servicios de la cita (multi-servicio), en el orden elegido.
  select string_agg(s.name, ' + ' order by array_position(new.service_ids, s.id))
    into v_service from services s where s.id = any(new.service_ids);
  if v_service is null then
    select name into v_service from services where id = new.service_id;
  end if;
  select name into v_staff from staff where id = new.staff_id;
  select name into v_pref from staff where id = new.preferred_staff_id;
  msg := '📅 Nueva reserva' || E'\n'
      || 'Clienta: ' || coalesce(v_client, 'Sin nombre')
      || tg_contact_line(nullif(v_phone, '')) || E'\n'
      || 'Servicio: ' || coalesce(v_service, '—') || E'\n'
      || 'Fecha: ' || to_char(new.date, 'DD/MM/YYYY') || ' a las ' || to_char(new.time, 'HH24:MI');
  if v_staff is not null then
    msg := msg || E'\n' || 'Empleada: ' || v_staff;
  elsif v_pref is not null then
    msg := msg || E'\n' || 'Prefiere a: ' || v_pref;
  end if;
  perform tg_send(msg);
  return new;
end $$;

drop trigger if exists appointments_tg_notify on appointments;
create trigger appointments_tg_notify
  after insert on appointments
  for each row execute function tg_notify_appointment();

create or replace function tg_notify_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text; v_visits int; v_extra text := '';
begin
  if new.client_id is not null then
    select status, visits into v_status, v_visits from clients where id = new.client_id;
    if found then
      v_extra := E'\n' || 'Clienta registrada'
        || case when v_status = 'vip' then ' 💎 VIP' when v_status = 'new' then ' (nueva)' else '' end
        || coalesce(' · ' || v_visits || ' visitas', '');
    end if;
  end if;
  perform tg_send(
    '⭐ Nueva reseña (' || new.rating || '/5)' || E'\n'
    || 'De: ' || new.name
    || tg_contact_line(nullif(new.phone, ''))
    || v_extra
    || coalesce(E'\n' || '"' || nullif(trim(new.comment), '') || '"', '')
  );
  return new;
end $$;

drop trigger if exists reviews_tg_notify on reviews;
create trigger reviews_tg_notify
  after insert on reviews
  for each row execute function tg_notify_review();

-- Aviso cuando la clienta edita su reseña (mismo teléfono → edita, no duplica).
-- El WHEN evita dispararlo cuando el admin solo oculta/muestra (approved).
create or replace function tg_notify_review_updated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform tg_send(
    '✏️ Reseña editada (' || new.rating || '/5)' || E'\n'
    || 'De: ' || new.name
    || tg_contact_line(nullif(new.phone, ''))
    || coalesce(E'\n' || '"' || nullif(trim(new.comment), '') || '"', '')
  );
  return new;
end $$;

drop trigger if exists reviews_tg_notify_update on reviews;
create trigger reviews_tg_notify_update
  after update on reviews
  for each row
  when (old.rating is distinct from new.rating
     or old.comment is distinct from new.comment
     or old.name is distinct from new.name)
  execute function tg_notify_review_updated();

-- Aviso cuando una cita pasa a cancelada (desde el dashboard o donde sea).
create or replace function tg_notify_appointment_cancelled() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_client text; v_phone text; v_service text; msg text;
begin
  select name, phone into v_client, v_phone from clients where id = new.client_id;
  select string_agg(s.name, ' + ' order by array_position(new.service_ids, s.id))
    into v_service from services s where s.id = any(new.service_ids);
  if v_service is null then
    select name into v_service from services where id = new.service_id;
  end if;
  msg := '❌ Cita cancelada' || E'\n'
      || 'Clienta: ' || coalesce(v_client, 'Sin nombre')
      || tg_contact_line(nullif(v_phone, '')) || E'\n'
      || 'Servicio: ' || coalesce(v_service, '—') || E'\n'
      || 'Era: ' || to_char(new.date, 'DD/MM/YYYY') || ' a las ' || to_char(new.time, 'HH24:MI');
  perform tg_send(msg);
  return new;
end $$;

drop trigger if exists appointments_tg_notify_cancel on appointments;
create trigger appointments_tg_notify_cancel
  after update on appointments
  for each row
  when (old.status is distinct from new.status and new.status = 'cancelled')
  execute function tg_notify_appointment_cancelled();

-- Aviso cuando un producto se agota (stock llega a 0).
create or replace function tg_notify_product_out() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform tg_send(
    '⚠️ Producto agotado' || E'\n'
    || new.name || ' (' || new.cat || ')' || E'\n'
    || 'En la página ya aparece como "Agotado". Repón stock cuando puedas.'
  );
  return new;
end $$;

drop trigger if exists products_tg_notify_out on products;
create trigger products_tg_notify_out
  after update on products
  for each row
  when (old.stock > 0 and new.stock = 0)
  execute function tg_notify_product_out();

-- ───── Resumen mañanero: agenda del día por Telegram (pg_cron) ──────
create extension if not exists pg_cron;

create or replace function tg_daily_summary() returns void
language plpgsql security definer set search_path = public as $$
declare
  hoy date := (now() at time zone 'America/Havana')::date;
  n int; lineas text;
begin
  select count(*),
         string_agg(
           to_char(a.time, 'HH24:MI') || ' · ' || coalesce(c.name, 'Clienta')
           || ' — ' || coalesce(s.name, 'Servicio')
           || coalesce(' (' || st.name || ')', '')
           || case when a.status = 'pending' then ' ⏳' else '' end,
           E'\n' order by a.time)
    into n, lineas
  from appointments a
  left join clients  c  on c.id  = a.client_id
  left join services s  on s.id  = a.service_id
  left join staff    st on st.id = a.staff_id
  where a.date = hoy and a.status in ('pending', 'confirmed');

  if n = 0 then
    perform tg_send('🌸 ¡Buenos días! Hoy ' || to_char(hoy, 'DD/MM') || ' no hay citas en la agenda.');
  else
    perform tg_send('📋 ¡Buenos días! Citas de hoy ' || to_char(hoy, 'DD/MM') || ' (' || n || '):'
      || E'\n' || lineas || E'\n' || '(⏳ = pendiente de confirmar)');
  end if;
end $$;

revoke execute on function tg_daily_summary() from anon, authenticated;

-- 11:00 UTC ≈ 7:00 AM en Cuba (horario de verano; en invierno serían las 6:00).
-- cron.schedule es idempotente por nombre: re-correr esto solo actualiza el job.
select cron.schedule('mj_resumen_manana', '0 11 * * *', $$select tg_daily_summary()$$);

-- ───── Seed: un admin inicial ───────────────────────────────────────
-- IMPORTANTE: cambia este PIN después de crear todo
-- Solo inserta si todavía no existe ningún admin (el PIN ya no es UNIQUE).
insert into staff (pin, name, role, color, initials, schedule, active)
select '1234', 'Administradora', 'admin', '#c9a96e', 'AD', '24/7', true
where not exists (select 1 from staff where role = 'admin');
