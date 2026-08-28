-- #############################################################################
-- 05_origen_y_realtime.sql · Hostal Inteligente (Atlas)
--
-- 1. `audit_log.origen`: distingue lo que escribió una persona de lo que escribió
--    el asistente. Lo pedía `ai-media.md` ("registrar en auditoría") y hasta ahora
--    el log guardaba la escritura sin decir de dónde venía.
-- 2. Realtime del estado de cuartos, que pedía `frontend.md`.
--
-- Idempotente. Se aplica con: node --env-file=.env.local scripts/migrar.mjs
-- #############################################################################


-- #############################################################################
-- 1. ORIGEN DE CADA ESCRITURA
--
-- El origen viaja en la cabecera HTTP `x-origen`, que PostgREST expone en el GUC
-- `request.headers`. Así no hay que cambiar la firma de ninguna función de negocio
-- ni pasar un parámetro extra por toda la cadena de repositorios.
--
-- Se filtra contra una lista blanca a propósito: la cabecera la puede poner
-- cualquiera con un token válido, así que no se guarda texto libre.
-- #############################################################################

alter table public.audit_log
  add column if not exists origen text not null default 'app';

do $$ begin
  alter table public.audit_log
    add constraint audit_log_origen_valido check (origen in ('app', 'asistente', 'sistema'));
exception when duplicate_object then null;
end $$;

create index if not exists audit_log_origen_idx
  on public.audit_log (tenant_id, origen, created_at desc);

create or replace function public.origen_peticion()
returns text language sql stable as $fn$
  select case coalesce(
           nullif(coalesce(current_setting('request.headers', true), '{}')::jsonb ->> 'x-origen', ''),
           'app')
         when 'asistente' then 'asistente'
         when 'sistema'   then 'sistema'
         else 'app'
         end
$fn$;

comment on function public.origen_peticion() is
  'Quién escribió: app (una persona en la interfaz), asistente (IA confirmada) o sistema (scripts).';

-- Misma función que en 02, ahora guardando el origen.
create or replace function public.fn_audit()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  v_tenant uuid;
  v_id     text;
begin
  v_tenant := coalesce(
    (to_jsonb(new) ->> 'tenant_id')::uuid,
    (to_jsonb(old) ->> 'tenant_id')::uuid
  );
  if v_tenant is null then return coalesce(new, old); end if;

  v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id');

  insert into public.audit_log (
    tenant_id, tabla, operacion, registro_id, actor_id, origen, datos_antes, datos_despues
  )
  values (
    v_tenant, tg_table_name, tg_op, v_id, auth.uid(), public.origen_peticion(),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );

  return coalesce(new, old);
end $fn$;

-- Igual para el historial de estado de cuartos: es el log que mira limpieza.
alter table public.cuarto_estado_log
  add column if not exists origen text not null default 'app';

create or replace function public.fn_log_estado_cuarto()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    insert into public.cuarto_estado_log (tenant_id, cuarto_id, estado_ant, estado_new, actor_id, origen)
    values (new.tenant_id, new.id, old.estado, new.estado, auth.uid(), public.origen_peticion());
  end if;
  return new;
end $fn$;


-- #############################################################################
-- 2. REALTIME DEL ESTADO DE CUARTOS
--
-- Recepción y limpieza miran la misma pizarra: si una pone la 203 en limpieza,
-- la otra tiene que verlo sin recargar.
--
-- `replica identity full` es necesario para que Realtime pueda evaluar el RLS
-- sobre la fila anterior (si no, un UPDATE solo trae la PK y el filtro por
-- tenant no se puede aplicar). La tabla es pequeña: el coste es despreciable.
-- #############################################################################

alter table public.cuartos replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.cuartos;
exception when duplicate_object then
  raise notice '  cuartos ya estaba en la publicación supabase_realtime';
end $$;


do $$ begin
  raise notice 'OK · 05_origen_y_realtime.sql aplicado';
end $$;
