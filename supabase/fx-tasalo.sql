-- Cambia la fuente de la tasa USD->CUP a tasalo (mercado informal).
-- Pegar completo en Supabase -> SQL Editor -> Run.
-- Reemplaza las dos funciones; el cron de cada hora sigue igual.

-- Paso 1: dispara la petición GET a tasalo.
create or replace function fx_rate_fetch() returns void
language plpgsql security definer set search_path = public as $$
declare rid bigint;
begin
  select net.http_get(url := 'http://tasalo.duckdns.org:8040/api/v1/tasas/latest') into rid;
  update fx_config set last_request_id = rid where id;
exception when others then null;
end $$;

-- Paso 2: lee la respuesta de la última petición y aplica la tasa.
create or replace function fx_rate_apply() returns void
language plpgsql security definer set search_path = public as $$
declare rid bigint; v_status int; v_content text; j jsonb; usd numeric;
begin
  select last_request_id into rid from fx_config where id;
  if rid is null then return; end if;

  -- Respeta la tasa puesta a mano: no la pisamos.
  if exists (select 1 from site_settings where id = 1 and fx_source = 'manual') then
    return;
  end if;

  select status_code, content into v_status, v_content
    from net._http_response where id = rid;
  if v_status is distinct from 200 or v_content is null then return; end if;

  j := v_content::jsonb;
  -- tasalo agrupa por fuente: eltoque es el mercado informal, el que se usa
  -- de verdad en la calle. cadeca y bcc son las oficiales y van muy por debajo.
  usd := nullif(j -> 'data' -> 'eltoque' -> 'USD' ->> 'rate', '')::numeric;
  if usd is null or usd <= 0 then
    usd := nullif(j -> 'data' -> 'eltoque' -> 'USD' ->> 'prev_rate', '')::numeric;
  end if;

  -- La tasa reescala toda la caja, así que una cifra imposible no se aplica:
  -- mejor quedarse con la de ayer que recalcularlo todo mal.
  if usd is null or usd < 50 or usd > 5000 then return; end if;

  update site_settings
    set usd_to_cup = round(usd, 2), fx_updated_at = now(), fx_source = 'auto'
    where id = 1;
  -- Historial: deja registrada la tasa de hoy para poder revisar la caja
  -- de días pasados con el cambio que regía entonces.
  insert into fx_rates (date, usd_to_cup, source, updated_at)
  values ((now() at time zone 'America/Havana')::date, round(usd, 2), 'auto', now())
  on conflict (date) do update
    set usd_to_cup = excluded.usd_to_cup, source = 'auto', updated_at = now()
    where fx_rates.source <> 'manual';   -- lo puesto a mano manda
exception when others then null;
end $$;

-- Comprobar en el momento (sin esperar a la hora en punto):
--   select fx_rate_fetch();  -- espera ~10 segundos
--   select fx_rate_apply();
--   select usd_to_cup, fx_source, fx_updated_at from site_settings where id = 1;
