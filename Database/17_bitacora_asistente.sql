-- #############################################################################
-- 17_bitacora_asistente.sql · Hostal Inteligente (Atlas)
--
-- Hasta ahora un mensaje al asistente que no llegaba a confirmarse no dejaba
-- ningún rastro: ni la frase que no se entendió, ni qué acción propuso, ni si
-- vino de las reglas o del LLM. Esta migración agrega esa bitácora.
--
-- El texto libre a veces trae nombre y documento de un huésped (un check-in
-- dictado los dice en la misma frase), así que entra en el mismo terreno que
-- `medios`/`consentimientos`: RLS por tenant desde el día uno. Lo que NO trae
-- todavía es retención ni borrado — esta migración agrega la tabla, no un
-- purgado automático. Hasta que exista ese script (paralelo a
-- `purgar-medios.mjs`), es dato que crece sin borrarse: dejarlo dicho aquí en
-- vez de darlo por resuelto.
--
-- Idempotente. Se aplica con: node --env-file=.env.local scripts/migrar.mjs
-- #############################################################################

create table if not exists public.asistente_mensajes (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id),
  usuario_id  uuid not null references public.profiles(id),
  rol         public.rol_usuario not null,
  -- El mensaje tal cual lo escribió la persona. Es el dato sensible de esta
  -- tabla: puede traer nombre y documento sueltos en el texto libre.
  texto       text not null,
  -- Nulo cuando no se reconoció ninguna acción (`resultado = 'sin_entender'`).
  -- Texto libre y no una referencia a un enum: nuevas acciones no deben pedir
  -- tocar esta tabla.
  accion      text,
  origen      text check (origen in ('reglas', 'ia')),
  resultado   text not null check (resultado in ('tarjeta', 'pregunta', 'sin_entender')),
  -- Solo tiene sentido cuando `resultado = 'tarjeta'`: si la persona confirmó
  -- y la acción se ejecutó de verdad, no solo se propuso.
  confirmada  boolean not null default false,
  error       text,
  creado_at   timestamptz not null default now()
);

create index if not exists asistente_mensajes_tenant_fecha_idx
  on public.asistente_mensajes (tenant_id, creado_at desc);

alter table public.asistente_mensajes enable row level security;

-- Solo el administrador la lee — mismo criterio que `audit_log`: es un
-- registro de quién pidió qué, no una pantalla operativa que necesite
-- recepción o limpieza.
drop policy if exists asistente_mensajes_sel on public.asistente_mensajes;
create policy asistente_mensajes_sel on public.asistente_mensajes
  for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

revoke all on public.asistente_mensajes from anon;
grant select on public.asistente_mensajes to authenticated;
grant all privileges on public.asistente_mensajes to service_role;

-- #############################################################################
-- Nadie inserta ni actualiza esta tabla directo por PostgREST (no hay policy
-- de insert/update para `authenticated`): solo estas dos funciones, que fijan
-- tenant_id/usuario_id ellas mismas con `current_tenant_id()`/`auth.uid()` y
-- no confían en lo que mande el cliente — el mismo motivo por el que
-- `registrar_checkin()` o `registrar_venta()` no reciben el tenant como
-- parámetro.
-- #############################################################################

create or replace function public.registrar_mensaje_asistente(
  p_texto     text,
  p_resultado text,
  p_accion    text default null,
  p_origen    text default null
) returns uuid
language plpgsql security definer set search_path = public as $fn$
declare
  v_id uuid;
begin
  insert into public.asistente_mensajes (tenant_id, usuario_id, rol, texto, accion, origen, resultado)
  values (
    public.current_tenant_id(), auth.uid(), public.current_rol(),
    p_texto, p_accion, p_origen, p_resultado
  )
  returning id into v_id;

  return v_id;
end $fn$;

-- Solo marca su PROPIO mensaje: quien interpretó es quien confirma o descarta,
-- nunca otra sesión.
create or replace function public.marcar_mensaje_asistente(
  p_id         uuid,
  p_confirmada boolean,
  p_error      text default null
) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  update public.asistente_mensajes
     set confirmada = p_confirmada,
         error      = p_error
   where id = p_id
     and tenant_id = public.current_tenant_id()
     and usuario_id = auth.uid();
end $fn$;

-- La 06 revoca EXECUTE a `public` para lo que se cree de ahí en adelante, pero eso
-- corre `alter default privileges` para el rol que ejecutó esa migración -- no para
-- el rol con el que corra ésta. Sin este revoke explícito, la función se queda con
-- el privilegio por defecto de Postgres (EXECUTE a PUBLIC), y `anon` lo hereda.
revoke execute on function public.registrar_mensaje_asistente(text, text, text, text) from public;
revoke execute on function public.marcar_mensaje_asistente(uuid, boolean, text) from public;

grant execute on function public.registrar_mensaje_asistente(text, text, text, text) to authenticated;
grant execute on function public.marcar_mensaje_asistente(uuid, boolean, text) to authenticated;

-- #############################################################################
-- Verificación
-- #############################################################################

do $$
begin
  if has_function_privilege('anon', 'public.registrar_mensaje_asistente(text, text, text, text)', 'execute') then
    raise exception 'anon puede escribir en la bitácora del asistente sin sesión';
  end if;

  raise notice 'OK · 17_bitacora_asistente.sql aplicado';
end $$;
