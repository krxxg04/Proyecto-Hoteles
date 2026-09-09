-- #############################################################################
-- 18_realtime_inventario_y_caja.sql · Hostal Inteligente (Atlas)
--
-- `05_origen_y_realtime.sql` solo agregó `cuartos` a la publicación de Realtime.
-- El hook `useEnVivo()` del frontend ya sabía escuchar varias tablas a la vez, pero
-- suscribirse a una tabla que no está en `supabase_realtime` no falla: simplemente
-- no llega nunca nada, y la pantalla se queda en "Conectando…" o "En vivo" sin que
-- ningún cambio real la despierte. Esta migración es la otra mitad.
--
-- Inventario necesita `productos` (vender, entregar, comprar y ajustar tocan
-- `stock` ahí). Caja necesita `ventas`, `gastos`, `turnos` y `caja_estado`: una
-- venta, un gasto o un cierre son tablas distintas para la misma pantalla.
--
-- Idempotente. Se aplica con: node --env-file=.env.local scripts/migrar.mjs
-- #############################################################################

do $$
declare
  tabla text;
begin
  foreach tabla in array array['productos', 'ventas', 'gastos', 'turnos', 'caja_estado']
  loop
    -- Igual que en la 05: sin `replica identity full`, un UPDATE solo trae la PK en
    -- el WAL, y Realtime no tiene con qué evaluar el filtro por `tenant_id`.
    execute format('alter table public.%I replica identity full', tabla);

    begin
      execute format('alter publication supabase_realtime add table public.%I', tabla);
    exception when duplicate_object then
      raise notice '  % ya estaba en la publicación supabase_realtime', tabla;
    end;
  end loop;
end $$;

do $$
begin
  raise notice 'OK · 18_realtime_inventario_y_caja.sql aplicado';
end $$;
