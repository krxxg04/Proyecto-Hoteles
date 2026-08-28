-- #############################################################################
-- 06_ejecucion_de_funciones.sql · Hostal Inteligente (Atlas)
--
-- Lo encontró la prueba de aislamiento (`scripts/prueba-aislamiento.mjs`):
-- `anon` podía llamar a `current_tenant_id()`.
--
-- 01_schema.sql §12 hacía `revoke execute ... from anon`, pero Postgres otorga
-- EXECUTE al rol `public` por defecto y `anon` hereda de `public`. Revocarle a
-- `anon` algo que tiene por herencia no quita nada: hay que revocárselo a
-- `public` y volver a otorgarlo a quien sí debe tenerlo.
--
-- No era una fuga de datos —sin JWT la función devuelve null— pero la intención
-- declarada del esquema no se estaba cumpliendo, y el resto de las funciones de
-- negocio quedaban igual de expuestas.
--
-- Idempotente. Se aplica con: node --env-file=.env.local scripts/migrar.mjs
-- #############################################################################


-- #############################################################################
-- 1. NADIE SIN SESIÓN EJECUTA NADA DE `public`
--
-- Las únicas excepciones son las del login, que por definición ocurren antes de
-- tener sesión. Se vuelven a otorgar más abajo.
-- #############################################################################

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated, service_role', f.firma);
  end loop;
end $$;

-- Y para lo que se cree de aquí en adelante, sin tener que volver a este archivo.
alter default privileges in schema public revoke execute on functions from public;


-- #############################################################################
-- 2. LAS EXCEPCIONES DEL LOGIN
--
-- `resolver_login` traduce DNI -> hostal y se llama ANTES de iniciar sesión.
-- Solo devuelve el slug: con un DNI ajeno no se saca información de nadie.
-- #############################################################################

grant execute on function public.resolver_login(text) to anon;


-- #############################################################################
-- 3. LO QUE NO DEBE EJECUTAR NI UN USUARIO CON SESIÓN
--
-- `aplicar_rls` genera policies: es herramienta de migración, no de aplicación.
-- #############################################################################

revoke execute on function public.aplicar_rls(text, public.rol_usuario[], public.rol_usuario[])
  from public, anon, authenticated;


-- #############################################################################
-- 4. VERIFICACIÓN
-- #############################################################################

do $$
begin
  if has_function_privilege('anon', 'public.current_tenant_id()', 'execute') then
    raise exception 'anon sigue pudiendo ejecutar current_tenant_id()';
  end if;

  if not has_function_privilege('anon', 'public.resolver_login(text)', 'execute') then
    raise exception 'anon no puede resolver el login: nadie podría entrar';
  end if;

  if not has_function_privilege('authenticated', 'public.current_tenant_id()', 'execute') then
    raise exception 'authenticated no puede ejecutar current_tenant_id(): el RLS dejaría de funcionar';
  end if;

  raise notice 'OK · 06_ejecucion_de_funciones.sql aplicado';
end $$;
