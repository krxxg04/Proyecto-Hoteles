-- =============================================================================
-- 12 · Una sola caja, gastos fijos y justificables, y las alertas conectadas
-- =============================================================================
--
-- Tres cosas que no existían:
--
--   1. Comprar no tocaba el dinero. `movimientos_inventario` no tiene monto, así que una
--      compra movía stock y nada más: el gasto no existía en el modelo.
--   2. Había dos cajas — `sencillo` (lo que un turno deja al siguiente) y `caja_chica`
--      (el acumulado). El hostal pidió una.
--   3. La tabla `alertas` la escribía `cerrar_turno` y NADIE la leía. Aquí empieza a usarse.


-- 1 · Una sola caja -----------------------------------------------------------

alter table public.caja_estado
  add column if not exists saldo numeric(10,2) not null default 0;

-- El saldo único es todo lo que había repartido entre las dos cajas.
--
-- Con guarda y en dinámico porque esta migración borra las dos columnas más abajo: sin
-- esto, volver a correrla falla al leer una columna que ella misma quitó.
do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'caja_estado' and column_name = 'sencillo'
  ) then
    execute 'update public.caja_estado set saldo = sencillo + caja_chica where saldo = 0';
  end if;
end $$;

-- Se van: dejarlas sería mantener dos números que ya no manda nadie. El detalle
-- histórico de cada cierre sigue en `cierres_caja`, que tiene sus propias columnas.
alter table public.caja_estado drop column if exists sencillo;
alter table public.caja_estado drop column if exists caja_chica;

comment on column public.caja_estado.saldo is
  'Efectivo que hay en la caja. Lo fija el conteo de cierre de cada turno.';


-- 2 · Cuánto suele costar comprar cada producto -------------------------------

alter table public.productos
  add column if not exists costo_referencia numeric(10,2) not null default 0
    check (costo_referencia >= 0);

comment on column public.productos.costo_referencia is
  'Lo que suele costar comprar UNA unidad. 0 = sin referencia, no dispara alarma por monto.';


-- 3 · Los gastos --------------------------------------------------------------

do $$ begin
  create type public.categoria_gasto as enum ('fijo', 'justificable');
exception when duplicate_object then null; end $$;

create table if not exists public.gastos (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  turno_id       uuid not null references public.turnos(id) on delete restrict,
  categoria      public.categoria_gasto not null,
  -- Solo en los fijos: es la compra de un producto del catálogo.
  producto_id    uuid references public.productos(id) on delete restrict,
  cantidad       numeric(12,2),
  concepto       text not null,
  monto          numeric(10,2) not null check (monto > 0),
  medio          public.medio_pago not null default 'efectivo',
  justificacion  text,
  actor_id       uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),

  -- Un gasto fijo ES una compra: sin producto ni cantidad no llena inventario.
  constraint gastos_fijo_con_producto check (
    categoria <> 'fijo' or (producto_id is not null and cantidad is not null and cantidad > 0)
  ),
  -- Lo que no es una compra del catálogo se explica. Siempre.
  constraint gastos_justificable_con_razon check (
    categoria <> 'justificable'
      or (producto_id is null and length(btrim(coalesce(justificacion, ''))) >= 3)
  )
);

create index if not exists gastos_tenant_idx on public.gastos (tenant_id, created_at desc);
create index if not exists gastos_turno_idx  on public.gastos (turno_id);

select public.aplicar_rls('gastos', public.r_caja(), public.r_caja());


-- 4 · Registrar un gasto ------------------------------------------------------
--
-- El gasto NO descuenta el saldo aquí. Igual que las ventas: el saldo lo fija el conteo
-- de cierre. Tener dos sitios que lo muevan es tener dos verdades.

-- Cuánto por encima de la referencia se considera raro. 1.3 deja un 30 % de margen: el
-- precio de mayorista sube, y avisar por cada sol convierte la alarma en ruido.
create or replace function public.margen_gasto() returns numeric
  language sql immutable as $fn$ select 1.3::numeric $fn$;

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

  -- No se paga en efectivo lo que no hay en el cajón. Además ataja el dedo gordo:
  -- S/ 4000 en vez de S/ 40 se rechaza en el momento, no al cerrar el turno.
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
    -- Lo que no es una compra del catálogo se explica, y la base no acepta lo contrario.
    if v_just is null or length(v_just) < 3 then
      raise exception 'Un gasto que no es de los habituales necesita justificación';
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

  -- Todo gasto que no encaja con las compras habituales se revisa. Sin excepción.
  if p_categoria = 'justificable' then
    insert into public.alertas (
      tenant_id, severidad, titulo, detalle, origen, turno_id, requiere_validacion
    ) values (
      v_tenant, 'warning',
      'Gasto fuera de lo habitual: ' || v_concepto ||
        ' · S/ ' || to_char(p_monto, 'FM999999990.00'),
      'Justificación: ' || v_just,
      'caja', v_turno, true
    );
  end if;

  -- Y un gasto fijo que se sale del precio de referencia también.
  --
  -- Anidado y no con un `and`: el AND de SQL no garantiza short-circuit, así que
  -- `v_producto.costo_referencia` se evaluaba también en los gastos justificables, donde
  -- el record nunca se asignó — «record v_producto is not assigned yet».
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


-- 5 · Lo que la caja del turno debería tener ----------------------------------

create or replace function public.efectivo_esperado(p_turno_id uuid)
returns numeric
language sql stable security definer set search_path = public as $fn$
  select round(
    t.sencillo_apertura
    + coalesce((select sum(v.monto) from public.ventas v
                 where v.turno_id = t.id and v.medio = 'efectivo'), 0)
    - coalesce((select sum(g.monto) from public.gastos g
                 where g.turno_id = t.id and g.medio = 'efectivo'), 0)
  , 2)
  from public.turnos t
 where t.id = p_turno_id and t.tenant_id = public.current_tenant_id()
$fn$;


-- 6 · Alertas: dejar de escribir en un pozo -----------------------------------

create or replace function public.atender_alerta(p_alerta_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.rol_en(public.r_caja()) then
    raise exception 'No tienes permiso para atender alertas';
  end if;

  update public.alertas
     set atendida = true, atendida_por = auth.uid(), atendida_at = now()
   where id = p_alerta_id and tenant_id = public.current_tenant_id();

  if not found then
    raise exception 'Esa alerta no existe en este hostal';
  end if;
end $fn$;


-- 7 · Ejecución ---------------------------------------------------------------

revoke execute on function public.registrar_gasto(
  public.categoria_gasto, text, numeric, public.medio_pago, uuid, numeric, text) from public;
revoke execute on function public.efectivo_esperado(uuid) from public;
revoke execute on function public.atender_alerta(uuid)    from public;
revoke execute on function public.margen_gasto()          from public;

grant execute on function public.registrar_gasto(
  public.categoria_gasto, text, numeric, public.medio_pago, uuid, numeric, text)
  to authenticated, service_role;
grant execute on function public.efectivo_esperado(uuid) to authenticated, service_role;
grant execute on function public.atender_alerta(uuid)    to authenticated, service_role;
grant execute on function public.margen_gasto()          to authenticated, service_role;
