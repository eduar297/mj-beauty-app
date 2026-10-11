-- MÓDULO FINANCIERO · Fase 1
-- Pegar completo en Supabase → SQL Editor → Run.
-- Se puede correr varias veces sin romper nada.


-- Cada servicio pertenece a un nivel de costo. El nivel decide qué porcentaje
-- del cobro va a materiales, a la trabajadora y a la dueña.
alter table services add column if not exists cost_tier text default 'medio';
update services set cost_tier = 'medio' where cost_tier is null;
alter table services drop constraint if exists services_cost_tier_check;
alter table services add constraint services_cost_tier_check
  check (cost_tier in ('bajo', 'medio', 'alto'));

-- Porcentajes editables desde Personalización. Cada nivel debe sumar 100: la
-- app lo valida antes de guardar, porque repartir 105% no da ningún error,
-- solo hace que todas las cifras mientan.
alter table site_settings add column if not exists cost_tiers jsonb default '{
  "bajo":  {"materiales": 20, "trabajadora": 40, "duena": 40},
  "medio": {"materiales": 25, "trabajadora": 35, "duena": 40},
  "alto":  {"materiales": 30, "trabajadora": 35, "duena": 35}
}'::jsonb;

-- La fila singleton ya existe, así que si la columna se creó antes sin default
-- se queda en NULL. Esto la deja con los porcentajes de arranque.
update site_settings set cost_tiers = '{
  "bajo":  {"materiales": 20, "trabajadora": 40, "duena": 40},
  "medio": {"materiales": 25, "trabajadora": 35, "duena": 40},
  "alto":  {"materiales": 30, "trabajadora": 35, "duena": 35}
}'::jsonb where cost_tiers is null;
