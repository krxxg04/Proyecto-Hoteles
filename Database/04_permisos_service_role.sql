-- =============================================================================
-- 04_permisos_service_role.sql · Hostal Inteligente (Atlas)
--
-- Otorga a `service_role` los permisos de tabla que 01_schema.sql daba por
-- supuestos pero nunca escribió. Ejecutar DESPUÉS de 03. Idempotente.
--
-- POR QUÉ HACE FALTA:
-- El proyecto se creó con "Automatically expose new tables" DESACTIVADO
-- (01_schema.sql §13), así que una tabla sin GRANT explícito es inaccesible
-- aunque el rol tenga BYPASSRLS. El esquema solo otorga a `authenticated`, de
-- modo que `service_role` — el que 01_schema.sql:773 designa para el alta de
-- tenants — no podía ni leer `tenants`. Los scripts de servidor
-- (bootstrap.mjs, seed.mjs) fallaban con "permission denied for table tenants".
--
-- ESTO NO RELAJA LA SEGURIDAD:
-- `service_role` ya tiene BYPASSRLS por diseño de Supabase; el gate de
-- CLAUDE.md es que su clave viva solo en el servidor, no que el rol esté
-- capado. Lo que aquí se corrige es que la intención del ADR («alta de tenants
-- solo desde el servidor») fuera irrealizable.
-- =============================================================================

grant usage on schema public to service_role;

grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- Para las tablas que se creen más adelante, sin tener que volver aquí.
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- Verificación: service_role tiene que poder leer `tenants`.
do $$
begin
  if not has_table_privilege('service_role', 'public.tenants', 'select') then
    raise exception 'service_role sigue sin acceso a tenants';
  end if;

  raise notice 'OK · 04_permisos_service_role.sql aplicado · los scripts de servidor ya pueden correr';
end $$;
