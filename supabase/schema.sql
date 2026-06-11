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

-- ───── Seed: un admin inicial ───────────────────────────────────────
-- IMPORTANTE: cambia este PIN después de crear todo
-- Solo inserta si todavía no existe ningún admin (el PIN ya no es UNIQUE).
insert into staff (pin, name, role, color, initials, schedule, active)
select '1234', 'Administradora', 'admin', '#c9a96e', 'AD', '24/7', true
where not exists (select 1 from staff where role = 'admin');
