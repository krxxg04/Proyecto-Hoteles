-- #############################################################################
-- 21_auditoria_gastos_y_movimientos.sql · Hostal Inteligente (Atlas)
--
-- `fn_audit()` existe desde la 02, pero su lista de tablas se armó antes de que
-- `gastos` (migración 12) y de que se revisara `movimientos_inventario` existieran
-- como parte del registro general. El resultado: cada compra, venta o check-in
-- queda en `audit_log`, pero un gasto de caja o un movimiento de inventario
-- (vender, entregar, ajustar, comprar) no dejaba ningún rastro genérico — solo lo
-- que cada función ya escribía por su cuenta (la alerta de un gasto raro, por
-- ejemplo, pero no el registro de auditoría en sí).
--
-- Esto no es una pantalla nueva: es completar el registro que ya existe, para que
-- quede grabado TODO lo importante — caja, inventario, habitaciones y check-in —
-- no solo una parte.
--
-- Idempotente. Se aplica con: node --env-file=.env.local scripts/migrar.mjs
-- #############################################################################

do $$
declare t text;
begin
  foreach t in array array['gastos', 'movimientos_inventario']
  loop
    execute format('drop trigger if exists %I on public.%I', 'audit_' || t, t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.fn_audit()',
      'audit_' || t, t);
  end loop;
end $$;
