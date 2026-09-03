-- #############################################################################
-- 15 · Fuera el estado `checkout`: la inspección pasa a ser la revisión de salida
-- #############################################################################
--
-- Había dos cosas llamadas "inspección" y significaban lo contrario:
--
--   · el ESTADO `inspeccion` era el control de calidad DESPUÉS de limpiar;
--   · el CAJÓN "Iniciar inspección" era el conteo de toallas y sábanas al salir el
--     huésped, y se abría sobre un cuarto en `checkout`.
--
-- Lo pidió el hostal al revés de como estaba, y tiene más sentido: lo que importa al
-- salir alguien es comprobar que no falta nada. Así que `checkout` desaparece y la
-- inspección se mueve al principio del ciclo, que es donde ya estaba el cajón.
--
--   antes:  ocupada -> checkout -> limpieza -> inspeccion -> lista
--   ahora:  ocupada -> inspeccion -> limpieza -> lista
--
-- El valor `checkout` SE QUEDA en el tipo `estado_cuarto`. Postgres no permite quitar
-- un valor de un enum sin recrear el tipo, y recrearlo obliga a reescribir la columna
-- de `cuartos`, la de `cuarto_estado_log` y la firma de dos funciones — todo para
-- borrar una palabra. En su lugar se prohíbe usarlo, y el historial que ya lo tiene
-- sigue siendo legible: si se borrara el valor, el log pasado dejaría de leerse.
--
-- Sin `begin`/`commit`: el runner ya envuelve cada archivo en su propia transacción, y
-- un commit aquí cerraría la suya antes de tiempo y le quitaría el rollback.

-- 1 · Los cuartos que estaban esperando revisión, a `inspeccion` ------------------
--
-- La nota se reescribe solo si es la que ponía el check-out: si alguien había escrito
-- otra cosa a mano, esa nota es información y no se pisa.

update public.cuartos
   set estado = 'inspeccion',
       nota = case
                when nota = 'Check-out sin verificar' then 'Salió el huésped · sin revisar'
                else nota
              end
 where estado = 'checkout';


-- 2 · El check-out deja el cuarto en `inspeccion` ---------------------------------

create or replace function public.registrar_checkout(p_estadia_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare e public.estadias%rowtype;
begin
  select * into e from public.estadias
   where id = p_estadia_id and tenant_id = public.current_tenant_id() and estado = 'activa';
  if not found then raise exception 'Estadía no encontrada o ya cerrada'; end if;

  update public.estadias
     set estado = 'cerrada', hora_salida = now()
   where id = p_estadia_id;

  update public.cuartos
     set estado = 'inspeccion', nota = 'Salió el huésped · sin revisar'
   where id = e.cuarto_id;
end $fn$;


-- 3 · `inspeccion` hereda el permiso que tenía `checkout` -------------------------
--
-- Esto es lo que hace que el cambio no abra un agujero. `guardarInspeccion` ya exigía
-- administración o recepción, así que quien limpia no puede registrar una inspección.
-- Si `inspeccion` se quedara como estado de piso, limpieza podría sacar el cuarto de
-- ahí pulsando "terminé" y saltarse la comprobación de que no falta nada — que es
-- justo lo que el hostal quiere revisar.
--
-- Reparto final:
--   recepción y administración -> libre, ocupada, inspeccion
--   quien está en el piso      -> limpieza, lista, mantenimiento
--
-- `checkout` entra en la lista prohibida a propósito: el valor sigue existiendo en el
-- enum, y sin esto un cliente que hablara directo con PostgREST podría revivirlo.

create or replace function public.cambiar_estado_cuarto(
  p_cuarto_id uuid,
  p_estado    public.estado_cuarto,
  p_nota      text default null
) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if p_estado = 'checkout' then
    raise exception 'El estado "checkout" ya no se usa: al salir el huésped el cuarto va a inspección';
  end if;

  if not public.rol_en(public.r_caja())
     and p_estado in ('libre', 'ocupada', 'inspeccion')
  then
    raise exception 'El estado "%" lo cambia recepción: va con el check-in y la revisión de salida', p_estado;
  end if;

  update public.cuartos
     set estado = p_estado,
         nota   = coalesce(p_nota, nota)
   where id = p_cuarto_id and tenant_id = public.current_tenant_id();

  -- El historial lo escribe el trigger de `cuartos`, no esta función: duplicarlo aquí
  -- dejaría dos filas por cada cambio.
  if not found then raise exception 'Cuarto no encontrado en este hostal'; end if;
end $fn$;


-- 4 · Y el UPDATE directo tampoco pasa -------------------------------------------
--
-- La función es SECURITY DEFINER, así que sin rehacer la policy quedaría la puerta de
-- atrás: un UPDATE por PostgREST poniendo `inspeccion` sin ser recepción.

drop policy if exists cuartos_upd on public.cuartos;
create policy cuartos_upd on public.cuartos
  for update to authenticated
  using      (tenant_id = public.current_tenant_id())
  with check (
    tenant_id = public.current_tenant_id()
    and estado <> 'checkout'
    and (
      public.rol_en(public.r_caja())
      or estado not in ('libre', 'ocupada', 'inspeccion')
    )
  );
