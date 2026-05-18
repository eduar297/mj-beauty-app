-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║  MJ Beauty — Supabase schema                                      ║
-- ║  Pega este archivo entero en: Supabase → SQL Editor → Run         ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- ───── Extensiones ──────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ───── Tabla: staff (empleadas + admin) ─────────────────────────────
create table if not exists staff (
  id uuid primary key default uuid_generate_v4(),
  pin text not null unique,                 -- 4-6 dígitos para login
  name text not null,
  role text not null check (role in ('admin', 'empleada')),
  email text,
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

-- ───── Tabla: clients ───────────────────────────────────────────────
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  email text,
  status text default 'regular' check (status in ('regular','vip','new')),
  notes text,
  fav text,
  visits int default 0,
  spent numeric(12,0) default 0,
  last_visit date,
  created_at timestamptz default now()
);

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
alter publication supabase_realtime add table appointments;
alter publication supabase_realtime add table transactions;

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

-- Lectura pública de servicios (para la landing)
create policy "services_public_read" on services for select using (true);

-- Por simplicidad: permitir todo lo demás con anon key
-- (cambia a políticas reales cuando uses Supabase Auth)
create policy "staff_anon_all"        on staff        for all using (true);
create policy "clients_anon_all"      on clients      for all using (true);
create policy "services_anon_all"     on services     for all using (true);
create policy "appointments_anon_all" on appointments for all using (true);
create policy "transactions_anon_all" on transactions for all using (true);

-- Storage: lectura pública del bucket services
create policy "services_storage_public" on storage.objects for select
using (bucket_id = 'services');

create policy "services_storage_upload" on storage.objects for insert
with check (bucket_id = 'services');

-- ───── Seed: un admin inicial ───────────────────────────────────────
-- IMPORTANTE: cambia este PIN después de crear todo
insert into staff (pin, name, role, color, initials, schedule, active)
values ('1234', 'Administradora', 'admin', '#c9a96e', 'AD', '24/7', true)
on conflict (pin) do nothing;
