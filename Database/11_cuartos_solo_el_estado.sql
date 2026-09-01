-- =============================================================================
-- 11 · Quien no es administración solo mueve el estado de un cuarto
-- =============================================================================
--
-- `cuartos_upd` (migración 08) vigila a qué ESTADO se puede mover un cuarto, pero no qué
-- columnas se tocan en ese UPDATE. Con un cuarto ya en un estado de piso, limpieza podía
-- mandar cualquier otra columna en la misma sentencia: `activo`, `numero`, `tipo_id`,
-- `aforo` y —lo más caro— `tarifa_costo` y `tarifa_amanecida`.
--
-- El RLS de Postgres no filtra por columna y los GRANT por columna tampoco sirven aquí:
-- todas las sesiones de la app son el mismo rol `authenticated`. Así que va en un trigger.
--
-- Lo encontró el bloque 6 del gate, comprobando el estado real de la fila después del
-- UPDATE: mirar solo si hubo error habría dado un falso verde, porque el RLS que no deja
-- pasar una fila no lanza error, simplemente no afecta ninguna.

create or replace function public.fn_cuartos_solo_estado()
returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  -- `current_rol()` es null en los scripts de servidor (service_role) y en las migraciones.
  if public.current_rol() is null or public.rol_en(public.r_admin()) then
    return new;
  end if;

  -- Lo único que mueve el personal de piso. `cambiar_estado_cuarto()` toca justo esto.
  if new.tenant_id        is distinct from old.tenant_id
  or new.numero           is distinct from old.numero
  or new.tipo_id          is distinct from old.tipo_id
  or new.aforo            is distinct from old.aforo
  or new.caracteristicas  is distinct from old.caracteristicas
  or new.tarifa_costo     is distinct from old.tarifa_costo
  or new.tarifa_amanecida is distinct from old.tarifa_amanecida
  or new.activo           is distinct from old.activo
  then
    raise exception 'Solo administración puede cambiar los datos de un cuarto. Tú puedes mover su estado.';
  end if;

  return new;
end $fn$;

drop trigger if exists cuartos_solo_estado on public.cuartos;
create trigger cuartos_solo_estado
  before update on public.cuartos
  for each row execute function public.fn_cuartos_solo_estado();
