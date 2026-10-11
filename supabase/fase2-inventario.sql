-- MÓDULO FINANCIERO · Fase 2: inventario
-- Pegar completo en Supabase → SQL Editor → Run.
-- Se puede correr varias veces sin romper nada.


-- Insumos: lo que se compra para trabajar (acrílico, henna, cera…).
-- Distinto de `products`, que son los productos que se le venden a la clienta.
-- unit_cost es el costo PROMEDIO PONDERADO por unidad, en USD: cada compra lo
-- recalcula mezclando lo que quedaba con lo que entra.
create table if not exists supplies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  unit text not null default 'unidad',        -- ml, g, unidad, par…
  stock numeric(12,3) not null default 0,
  unit_cost numeric(12,4) not null default 0, -- USD por unidad
  min_stock numeric(12,3) not null default 0, -- avisa cuando el stock baja de aquí
  note text,
  active boolean default true,
  created_at timestamptz default now()
);
alter table supplies enable row level security;
drop policy if exists "supplies_anon_all" on supplies;
create policy "supplies_anon_all" on supplies for all using (true);

-- Compras: cada entrada de insumo, con lo que costó.
create table if not exists purchases (
  id uuid primary key default uuid_generate_v4(),
  supply_id uuid references supplies(id) on delete set null,
  supply_name text,                            -- copia, por si se borra el insumo
  qty numeric(12,3) not null default 0,
  total_cost numeric(12,2) not null default 0, -- USD por toda la compra
  fx_rate numeric(12,2),                       -- tasa del día, como en transactions
  date date default ((now() at time zone 'America/Havana')::date),
  note text,
  created_at timestamptz default now()
);
alter table purchases enable row level security;
drop policy if exists "purchases_anon_all" on purchases;
create policy "purchases_anon_all" on purchases for all using (true);
create index if not exists purchases_date_idx on purchases (date desc);

-- Receta: cuánto insumo consume cada servicio. Es lo que permite saber el
-- costo REAL de materiales de un servicio, en vez de solo el porcentaje.
create table if not exists service_supplies (
  service_id uuid references services(id) on delete cascade,
  supply_id uuid references supplies(id) on delete cascade,
  qty numeric(12,3) not null default 0,
  primary key (service_id, supply_id)
);
alter table service_supplies enable row level security;
drop policy if exists "service_supplies_anon_all" on service_supplies;
create policy "service_supplies_anon_all" on service_supplies for all using (true);
