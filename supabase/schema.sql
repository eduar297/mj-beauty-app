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

-- ───── Tabla: services ──────────────────────────────────────────────
create table if not exists services (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  cat text not null check (cat in ('Uñas','Pelo','Faciales','Cejas','Pestañas')),
  duration int not null default 60,
  price numeric(12,0) not null default 0,
  description text,
  photo_url text,
  popular boolean default false,
  active boolean default true,
  created_at timestamptz default now()
);

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

-- ───── Realtime: activar para appointments y transactions ───────────
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

-- ───── Storage: bucket para fotos de servicios ──────────────────────
insert into storage.buckets (id, name, public)
values ('services', 'services', true)
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

-- Storage: lectura pública del bucket services
drop policy if exists "services_storage_public" on storage.objects;
create policy "services_storage_public" on storage.objects for select
using (bucket_id = 'services');

drop policy if exists "services_storage_upload" on storage.objects;
create policy "services_storage_upload" on storage.objects for insert
with check (bucket_id = 'services');

-- ───── Seed: un admin inicial ───────────────────────────────────────
-- IMPORTANTE: cambia este PIN después de crear todo
-- Solo inserta si todavía no existe ningún admin (el PIN ya no es UNIQUE).
insert into staff (pin, name, role, color, initials, schedule, active)
select '1234', 'Administradora', 'admin', '#c9a96e', 'AD', '24/7', true
where not exists (select 1 from staff where role = 'admin');
