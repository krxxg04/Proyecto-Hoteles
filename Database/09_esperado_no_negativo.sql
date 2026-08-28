-- #############################################################################
-- 09_esperado_no_negativo.sql · Hostal Inteligente (Atlas)
--
-- El conteo de cierre pedía «Debería haber -2 unid.» y el campo no aceptaba
-- negativos, así que el turno no se podía cerrar bien.
--
-- POR QUÉ SALÍA NEGATIVO
-- `esperado = apertura + movimientos del turno`. La apertura sale del snapshot
-- `turnos.apertura_inventario`, que va indexado por el id del producto. Si los
-- productos se recrean con el turno abierto —lo que hace `seed.mjs --limpiar`—
-- el snapshot queda huérfano: apertura 0, pero las ventas del turno siguen
-- restando. Resultado: un esperado negativo.
--
-- Un almacén no puede tener menos de cero unidades: eso no es un dato, es un
-- síntoma. Se recorta en 0 para que el conteo siga siendo posible, y el
-- descuadre que salga es real y queda registrado como incidencia, que es
-- exactamente lo que tiene que pasar cuando los números no cuadran.
--
-- Idempotente. Se aplica con: node --env-file=.env.local scripts/migrar.mjs
-- #############################################################################

create or replace function public.esperado_cierre(p_turno_id uuid)
returns table (producto_id uuid, nombre text, unidad text, apertura numeric, esperado numeric)
language sql stable security definer set search_path = public as $fn$
  select p.id,
         p.nombre,
         p.unidad,
         coalesce((t.apertura_inventario ->> p.id::text)::numeric, 0) as apertura,
         greatest(
           0,
           coalesce((t.apertura_inventario ->> p.id::text)::numeric, 0)
             + coalesce((
                 select sum(m.cantidad) from public.movimientos_inventario m
                  where m.turno_id = t.id and m.producto_id = p.id
                    and m.tipo <> 'conteo_cierre'
               ), 0)
         ) as esperado
    from public.turnos t
    join public.productos p on p.tenant_id = t.tenant_id and p.activo
   where t.id = p_turno_id and t.tenant_id = public.current_tenant_id()
   order by p.nombre
$fn$;


do $$ begin
  raise notice 'OK · 09_esperado_no_negativo.sql aplicado';
end $$;
