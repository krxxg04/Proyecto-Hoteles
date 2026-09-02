-- =============================================================================
-- 14 · El login deja de ser público, y deja de ser ambiguo entre hostales
-- =============================================================================
--
-- Dos problemas del login, los dos probados antes de tocar nada:
--
--   1. `resolver_login(dni)` hacía `limit 1` SIN `order by`. Con el mismo DNI en dos
--      hostales —alguien que trabaja en los dos, o un perfil viejo que quedó activo—
--      devolvía uno arbitrario, así que la persona del otro hostal no podía entrar nunca.
--      Y al no ser determinista, un cambio de plan de Postgres le da la vuelta.
--
--   2. Estaba concedida a `anon`, y devolvía el slug. Cualquiera sin sesión podía preguntar
--      «¿existe este DNI?» y le contestaba «sí, trabaja en el hostal X». Eso es dato
--      personal servido a un desconocido (Ley 29733, gate #4 de CLAUDE.md) y superficie
--      para enumerar DNIs.
--
-- El arreglo de fondo es el mismo para los dos: **el login lo resuelve el servidor**.
-- La función pasa a ser de `service_role`, devuelve TODAS las coincidencias (sin `limit`)
-- y acepta el hostal para desambiguar. El navegador ya no la puede llamar.


-- 1 · Fuera el oráculo público ------------------------------------------------

drop function if exists public.resolver_login(text);

-- `email_de_dni` no filtra nada por sí sola (es pura, y hay que saber el slug), pero el
-- navegador no la usa: menos superficie por nada.
revoke execute on function public.email_de_dni(text, text) from anon;


-- 2 · La nueva, para el servidor ----------------------------------------------

create or replace function public.resolver_login(
  p_dni  text,
  p_slug text default null
) returns table (slug text, email text, hostal text)
language sql stable security definer set search_path = public, auth as $fn$
  select t.slug, public.email_de_dni(p.dni, t.slug), t.nombre
    from public.profiles p
    join public.tenants t on t.id = p.tenant_id
   where p.dni = regexp_replace(p_dni, '\s', '', 'g')
     and p.activo
     and t.activo
     and (p_slug is null or t.slug = lower(btrim(p_slug)))
   -- Sin `limit`: quien llama decide qué hacer con varias coincidencias. Ordenado para
   -- que dos llamadas iguales devuelvan lo mismo, que es lo que antes no pasaba.
   order by t.slug
$fn$;

revoke execute on function public.resolver_login(text, text) from public;
revoke execute on function public.resolver_login(text, text) from anon;
revoke execute on function public.resolver_login(text, text) from authenticated;
grant  execute on function public.resolver_login(text, text) to service_role;


-- 3 · El PIN que entrega el proveedor es temporal por diseño ------------------
--
-- Hoy el PIN que se le da al administrador de un hostal al darlo de alta es el que usa
-- para siempre, y quien lo dio de alta lo conoce. En un sistema que guarda la caja del
-- negocio eso es una responsabilidad del proveedor, no del cliente.

alter table public.profiles
  add column if not exists pin_temporal boolean not null default false;

comment on column public.profiles.pin_temporal is
  'El PIN lo puso otra persona (alta o reinicio). La app obliga a cambiarlo antes de seguir.';

-- Los que ya existen se quedan en false: su PIN es el que eligieron, y forzar un cambio
-- retroactivo sacaría a la gente de una app que ya estaba usando.


-- 4 · Cambiar el PIN propio --------------------------------------------------
--
-- La contraseña la cambia la API de Supabase Auth, no SQL; esto solo baja la bandera
-- después. No van en la misma transacción, así que el orden importa: primero la
-- contraseña, y solo si funcionó, esto.

create or replace function public.marcar_pin_propio()
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null then
    raise exception 'Sin sesión';
  end if;

  update public.profiles
     set pin_temporal = false
   where id = auth.uid();
end $fn$;

revoke execute on function public.marcar_pin_propio() from public;
revoke execute on function public.marcar_pin_propio() from anon;
grant  execute on function public.marcar_pin_propio() to authenticated, service_role;
