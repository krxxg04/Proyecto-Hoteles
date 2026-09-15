-- #############################################################################
-- 23_gastos_recurrentes_detectados.sql · Hostal Inteligente (Atlas)
--
-- "Otro gasto" es el cajón de lo que no se espera. Pero si el mismo concepto se
-- repite, ya no es un imprevisto: es un gasto recurrente que nadie clasificó bien.
-- A la QUINTA vez que se registra el mismo texto como `otro`, se deja una alerta
-- sugiriendo pasarlo a `recurrente` — el administrador decide, nunca se mueve solo.
--
-- La comparación es por texto normalizado (minúsculas, sin tildes), igual que hace
-- el asistente para reconocer productos y cuartos: barato y determinista, sin
-- gastar en el LLM para esto.
--
-- Idempotente. Se aplica con: node --env-file=.env.local scripts/migrar.mjs
-- #############################################################################

-- 1 · Normalizar texto, la versión SQL de lo que ya hace el asistente en TS ------

create or replace function public.normalizar_texto(t text) returns text
language sql immutable as $fn$
  select lower(btrim(translate(coalesce(t, ''), 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')))
$fn$;

revoke execute on function public.normalizar_texto(text) from public;
grant execute on function public.normalizar_texto(text) to authenticated, service_role;


-- 2 · El conteo por concepto -----------------------------------------------------

create table if not exists public.gastos_patrones (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  concepto_normalizado  text not null,
  -- El texto tal cual la última vez, para mostrarlo — el normalizado es solo para comparar.
  concepto              text not null,
  veces                 int not null default 1,
  estado                text not null default 'pendiente'
                          check (estado in ('pendiente', 'aprobado', 'descartado')),
  alerta_id             uuid references public.alertas(id) on delete set null,
  decidido_por          uuid references public.profiles(id) on delete set null,
  decidido_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (tenant_id, concepto_normalizado)
);

create index if not exists gastos_patrones_tenant_idx on public.gastos_patrones (tenant_id);

-- Nadie escribe esta tabla directo: solo `registrar_gasto()` (cuenta) y
-- `aprobar_gasto_recurrente()`/`descartar_gasto_recurrente()` (deciden). La lectura
-- es de caja porque quien registra gastos también puede querer ver el conteo.
select public.aplicar_rls('gastos_patrones', public.r_caja(), public.r_admin());


-- 3 · `registrar_gasto()` ahora también cuenta -----------------------------------

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
  v_norm      text;
  v_patron_id uuid;
  v_veces     int;
  v_estado    text;
  v_alerta_p  uuid;
begin
  if not public.rol_en(public.r_caja()) then
    raise exception 'Solo administración o recepción pueden registrar gastos';
  end if;

  if v_turno is null then
    raise exception 'Abre un turno para registrar gastos';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto del gasto tiene que ser mayor que cero';
  end if;

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

  -- Un "otro" que se repite deja de ser un imprevisto. A la quinta vez con el
  -- mismo texto, se sugiere pasarlo a recurrente — no se mueve solo.
  if p_categoria = 'otro' then
    v_norm := public.normalizar_texto(v_concepto);

    insert into public.gastos_patrones (tenant_id, concepto_normalizado, concepto, veces)
    values (v_tenant, v_norm, v_concepto, 1)
    on conflict (tenant_id, concepto_normalizado) do update
      set veces      = public.gastos_patrones.veces + 1,
          concepto   = excluded.concepto,
          updated_at = now()
    returning id, veces, estado into v_patron_id, v_veces, v_estado;

    if v_veces = 5 and v_estado = 'pendiente' then
      insert into public.alertas (
        tenant_id, severidad, titulo, detalle, origen, turno_id, requiere_validacion
      ) values (
        v_tenant, 'info',
        'Gasto repetido 5 veces: ' || v_concepto,
        'Se registró 5 veces como "Otro gasto". ¿Lo pasamos a Gastos recurrentes?',
        'gasto_patron', v_turno, true
      ) returning id into v_alerta_p;

      update public.gastos_patrones set alerta_id = v_alerta_p where id = v_patron_id;
    end if;
  end if;

  return v_gasto;
end $fn$;


-- 4 · Lo que decide el administrador ---------------------------------------------

create or replace function public.aprobar_gasto_recurrente(p_patron_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_tenant uuid := public.current_tenant_id();
  v_patron record;
begin
  if not public.rol_en(public.r_admin()) then
    raise exception 'Solo el administrador decide si un gasto pasa a recurrente';
  end if;

  select * into v_patron from public.gastos_patrones
   where id = p_patron_id and tenant_id = v_tenant;
  if not found then raise exception 'Ese patrón de gasto no existe en este hostal'; end if;

  update public.gastos_patrones
     set estado = 'aprobado', decidido_por = auth.uid(), decidido_at = now()
   where id = p_patron_id;

  -- Reclasifica lo ya registrado: si "pasa a recurrente", el histórico tiene que
  -- verse así también, no solo lo que se registre de aquí en adelante.
  update public.gastos
     set categoria = 'recurrente'
   where tenant_id = v_tenant
     and categoria = 'otro'
     and public.normalizar_texto(concepto) = v_patron.concepto_normalizado;

  if v_patron.alerta_id is not null then
    update public.alertas
       set atendida = true, atendida_por = auth.uid(), atendida_at = now()
     where id = v_patron.alerta_id;
  end if;
end $fn$;

create or replace function public.descartar_gasto_recurrente(p_patron_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_tenant uuid := public.current_tenant_id();
  v_alerta uuid;
begin
  if not public.rol_en(public.r_admin()) then
    raise exception 'Solo el administrador decide si un gasto pasa a recurrente';
  end if;

  update public.gastos_patrones
     set estado = 'descartado', decidido_por = auth.uid(), decidido_at = now()
   where id = p_patron_id and tenant_id = v_tenant
  returning alerta_id into v_alerta;

  if not found then raise exception 'Ese patrón de gasto no existe en este hostal'; end if;

  if v_alerta is not null then
    update public.alertas
       set atendida = true, atendida_por = auth.uid(), atendida_at = now()
     where id = v_alerta;
  end if;
end $fn$;

revoke execute on function public.aprobar_gasto_recurrente(uuid)   from public;
revoke execute on function public.descartar_gasto_recurrente(uuid) from public;
grant execute on function public.aprobar_gasto_recurrente(uuid)   to authenticated, service_role;
grant execute on function public.descartar_gasto_recurrente(uuid) to authenticated, service_role;
