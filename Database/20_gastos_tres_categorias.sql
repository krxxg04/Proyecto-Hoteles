-- #############################################################################
-- 20_gastos_tres_categorias.sql · Hostal Inteligente (Atlas)
--
-- Usa los dos valores que agregó la 19. `registrar_gasto()` ya trataba "lo que no
-- es fijo" como un solo camino (exige concepto y justificación, sin producto): eso
-- no cambia, y sigue sirviendo igual para `recurrente` y para `otro` sin tocar esa
-- lógica. Lo que sí cambia:
--
--   1. El CHECK de la tabla ya no nombra `justificable` a secas: pasa a ser
--      "cualquiera que no sea fijo", así las filas viejas (`justificable`) se
--      quedan válidas sin necesidad de reescribirlas.
--   2. La alarma dispara para CUALQUIER gasto que no sea fijo (antes solo miraba
--      `justificable`), y el título dice cuál de los dos fue.
--
-- Idempotente. Se aplica con: node --env-file=.env.local scripts/migrar.mjs
-- #############################################################################

alter table public.gastos drop constraint if exists gastos_justificable_con_razon;
alter table public.gastos add constraint gastos_no_fijo_con_razon check (
  categoria = 'fijo' or (producto_id is null and length(btrim(coalesce(justificacion, ''))) >= 3)
);

create or replace function public.registrar_gasto(
  p_categoria     public.categoria_gasto,
  p_concepto      text,
  p_monto         numeric,
  p_medio         public.medio_pago default 'efectivo',
  p_producto_id   uuid    default null,
  p_cantidad      numeric default null,
  p_justificacion text    default null
) returns uuid
language plpgsql security definer set search_path = public as $fn$
declare
  v_tenant    uuid := public.current_tenant_id();
  v_actor     uuid := auth.uid();
  v_turno     uuid := public.turno_abierto();
  v_concepto  text := btrim(coalesce(p_concepto, ''));
  v_just      text := nullif(btrim(coalesce(p_justificacion, '')), '');
  v_producto  record;
  v_esperado  numeric(10,2);
  v_en_caja   numeric(10,2);
  v_gasto     uuid;
  v_etiqueta  text;
begin
  if not public.rol_en(public.r_caja()) then
    raise exception 'Solo administración o recepción pueden registrar gastos';
  end if;

  -- Sin turno no hay caja de la que salga el dinero.
  if v_turno is null then
    raise exception 'Abre un turno para registrar gastos';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto del gasto tiene que ser mayor que cero';
  end if;

  -- No se paga en efectivo lo que no hay en el cajón.
  if p_medio = 'efectivo' then
    v_en_caja := public.efectivo_esperado(v_turno);
    if p_monto > v_en_caja + 0.001 then
      raise exception 'La caja tiene S/ % en efectivo. Ese gasto no cabe: págalo por otro medio o registra menos.',
        to_char(v_en_caja, 'FM999999990.00');
    end if;
  end if;

  if p_categoria = 'fijo' then
    if p_producto_id is null or coalesce(p_cantidad, 0) <= 0 then
      raise exception 'Un gasto fijo es la compra de un producto: indica cuál y cuánto';
    end if;

    select id, nombre, unidad, costo_referencia into v_producto
      from public.productos
     where id = p_producto_id and tenant_id = v_tenant and activo;
    if not found then raise exception 'Ese producto no existe en este hostal'; end if;

    v_concepto := coalesce(nullif(v_concepto, ''), v_producto.nombre);
  else
    -- Recurrente u otro: no es una compra del catálogo, así que se explica.
    -- La base no acepta lo contrario.
    if v_just is null or length(v_just) < 3 then
      raise exception 'Un gasto recurrente o de otro tipo necesita justificación';
    end if;
    if v_concepto = '' then
      raise exception 'Dile un nombre al gasto';
    end if;
    if p_producto_id is not null then
      raise exception 'Si es la compra de un producto del catálogo, regístralo como gasto fijo';
    end if;
  end if;

  insert into public.gastos (
    tenant_id, turno_id, categoria, producto_id, cantidad,
    concepto, monto, medio, justificacion, actor_id
  ) values (
    v_tenant, v_turno, p_categoria, p_producto_id, p_cantidad,
    v_concepto, p_monto, p_medio, v_just, v_actor
  ) returning id into v_gasto;

  -- Un gasto fijo llena el inventario: es la misma acción, no dos.
  if p_categoria = 'fijo' then
    insert into public.movimientos_inventario (
      tenant_id, producto_id, tipo, cantidad, turno_id, motivo, actor_id
    ) values (
      v_tenant, p_producto_id, 'compra', p_cantidad, v_turno,
      'Compra · ' || v_concepto, v_actor
    );

    update public.productos
       set stock = stock + p_cantidad
     where id = p_producto_id;
  end if;

  -------------------------------------------------------------------------
  -- Las alarmas
  -------------------------------------------------------------------------

  -- Todo gasto que no sea la compra de un producto del catálogo se revisa, sin
  -- excepción — recurrente, otro, o `justificable` en una fila vieja.
  if p_categoria <> 'fijo' then
    v_etiqueta := case p_categoria
      when 'recurrente' then 'Gasto recurrente'
      when 'otro'       then 'Otro gasto'
      else                   'Gasto fuera de lo habitual'
    end;

    insert into public.alertas (
      tenant_id, severidad, titulo, detalle, origen, turno_id, requiere_validacion
    ) values (
      v_tenant, 'warning',
      v_etiqueta || ': ' || v_concepto || ' · S/ ' || to_char(p_monto, 'FM999999990.00'),
      'Justificación: ' || v_just,
      'caja', v_turno, true
    );
  end if;

  -- Y un gasto fijo que se sale del precio de referencia también.
  if p_categoria = 'fijo' then
    if coalesce(v_producto.costo_referencia, 0) > 0 then
      v_esperado := round(v_producto.costo_referencia * p_cantidad, 2);

      if p_monto > v_esperado * public.margen_gasto() then
        insert into public.alertas (
          tenant_id, severidad, titulo, detalle, origen, turno_id, requiere_validacion
        ) values (
          v_tenant, 'danger',
          'Sobreprecio en ' || v_producto.nombre,
          'Se pagó S/ ' || to_char(p_monto, 'FM999999990.00') ||
            ' por ' || to_char(p_cantidad, 'FM999999990.##') || ' ' || v_producto.unidad ||
            '. Al precio de referencia serían S/ ' || to_char(v_esperado, 'FM999999990.00') || '.',
          'caja', v_turno, true
        );
      end if;
    end if;
  end if;

  return v_gasto;
end $fn$;
