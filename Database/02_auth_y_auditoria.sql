-- =============================================================================
-- 02_auth_y_auditoria.sql · Hostal Inteligente (Atlas)
--
-- Login con DNI + PIN, y auditoría automática.
-- Ejecutar DESPUÉS de 01_schema.sql. Idempotente.
--
-- POR QUÉ EL EMAIL SINTÉTICO:
-- El personal escribe DNI y PIN, igual que en el prototipo. Supabase Auth solo
-- sabe autenticar con email o teléfono, así que por detrás se traduce a
-- <dni>@<slug>.hostal.local con el PIN como contraseña. Así aprovechamos
-- sesiones, refresh tokens, MFA y recuperación sin construir nada de eso.
-- El usuario nunca ve ese email.
-- =============================================================================


-- #############################################################################
-- 1. EMAIL SINTÉTICO
-- #############################################################################

create or replace function public.email_de_dni(p_dni text, p_slug text)
returns text language sql immutable as $fn$
  select lower(regexp_replace(p_dni, '\s', '', 'g')) || '@' || lower(p_slug) || '.hostal.local'
$fn$;

grant execute on function public.email_de_dni(text, text) to authenticated, anon;


-- #############################################################################
-- 2. TRIGGERS SOBRE auth.users
--
-- Al dar de alta a alguien, el servidor manda en user_metadata:
--   { tenant_id, dni, nombre, rol, telefono }
-- y estos dos triggers hacen el resto.
-- #############################################################################

-- Copia tenant_id y rol al app_metadata, que Supabase incluye DENTRO del JWT.
-- Con eso current_tenant_id() resuelve leyendo el token, sin consultar la base
-- en cada query. Es la diferencia entre una consulta extra por request y ninguna.
create or replace function public.auth_set_app_metadata()
returns trigger language plpgsql security definer set search_path = public, auth as $fn$
begin
  if new.raw_user_meta_data ? 'tenant_id' then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
           'tenant_id', new.raw_user_meta_data ->> 'tenant_id',
           'rol',       coalesce(new.raw_user_meta_data ->> 'rol', 'recepcion')
         );
  end if;
  return new;
end $fn$;

drop trigger if exists trg_auth_app_metadata on auth.users;
create trigger trg_auth_app_metadata
  before insert on auth.users
  for each row execute function public.auth_set_app_metadata();

-- Mantiene el app_metadata sincronizado si cambia el rol del perfil.
create or replace function public.auth_sync_app_metadata()
returns trigger language plpgsql security definer set search_path = public, auth as $fn$
begin
  if tg_op = 'UPDATE' and new.rol is distinct from old.rol then
    update auth.users
       set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
             || jsonb_build_object('rol', new.rol::text)
     where id = new.id;
  end if;
  return new;
end $fn$;

drop trigger if exists trg_profiles_sync_rol on public.profiles;
create trigger trg_profiles_sync_rol
  after update on public.profiles
  for each row execute function public.auth_sync_app_metadata();

-- Crea el profile automáticamente cuando nace el usuario de Auth.
create or replace function public.auth_crear_profile()
returns trigger language plpgsql security definer set search_path = public, auth as $fn$
begin
  if new.raw_user_meta_data ? 'tenant_id' then
    insert into public.profiles (id, tenant_id, dni, nombre, rol, telefono)
    values (
      new.id,
      (new.raw_user_meta_data ->> 'tenant_id')::uuid,
      coalesce(new.raw_user_meta_data ->> 'dni', split_part(new.email, '@', 1)),
      coalesce(new.raw_user_meta_data ->> 'nombre', 'Sin nombre'),
      coalesce((new.raw_user_meta_data ->> 'rol')::public.rol_usuario, 'recepcion'),
      new.raw_user_meta_data ->> 'telefono'
    )
    on conflict (id) do nothing;
  end if;
  return new;
end $fn$;

drop trigger if exists trg_auth_crear_profile on auth.users;
create trigger trg_auth_crear_profile
  after insert on auth.users
  for each row execute function public.auth_crear_profile();


-- #############################################################################
-- 3. RESOLVER EL LOGIN
--
-- El frontend solo conoce el DNI. Necesita saber a qué hostal pertenece para
-- armar el email sintético. Esta función es SECURITY DEFINER y accesible al
-- rol anónimo a propósito: se llama ANTES de iniciar sesión.
--
-- Solo devuelve el slug, jamás nombre, rol ni teléfono: con un DNI ajeno no se
-- puede sacar información de nadie.
-- #############################################################################

create or replace function public.resolver_login(p_dni text)
returns table (slug text, email text)
language sql stable security definer set search_path = public, auth as $fn$
  select t.slug, public.email_de_dni(p.dni, t.slug)
    from public.profiles p
    join public.tenants t on t.id = p.tenant_id
   where p.dni = regexp_replace(p_dni, '\s', '', 'g')
     and p.activo
     and t.activo
   limit 1
$fn$;

grant execute on function public.resolver_login(text) to anon, authenticated;


-- #############################################################################
-- 4. AUDITORÍA AUTOMÁTICA
--
-- Nadie puede escribir en audit_log desde el cliente (no hay policy de INSERT).
-- Solo estos triggers, que corren como definer.
-- #############################################################################

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

  insert into public.audit_log (tenant_id, tabla, operacion, registro_id, actor_id, datos_antes, datos_despues)
  values (
    v_tenant, tg_table_name, tg_op, v_id, auth.uid(),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );

  return coalesce(new, old);
end $fn$;

do $$
declare t text;
begin
  foreach t in array array[
    'cuartos','productos','huespedes','estadias','ventas','turnos',
    'cierres_caja','incidencias','tipos_cuarto','profiles','caja_estado'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'audit_' || t, t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.fn_audit()',
      'audit_' || t, t);
  end loop;
end $$;


-- #############################################################################
-- 5. HISTORIAL DE ESTADO DE CUARTOS
-- setRoomState() del prototipo, pero dejando rastro de quién y cuándo.
-- #############################################################################

create or replace function public.fn_log_estado_cuarto()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    insert into public.cuarto_estado_log (tenant_id, cuarto_id, estado_ant, estado_new, actor_id)
    values (new.tenant_id, new.id, old.estado, new.estado, auth.uid());
  end if;
  return new;
end $fn$;

drop trigger if exists trg_log_estado_cuarto on public.cuartos;
create trigger trg_log_estado_cuarto
  after update on public.cuartos
  for each row execute function public.fn_log_estado_cuarto();


do $$ begin
  raise notice 'OK · 02_auth_y_auditoria.sql aplicado';
end $$;
