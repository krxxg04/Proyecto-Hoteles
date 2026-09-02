-- =============================================================================
-- 13 · Abrir y cerrar turno con una sola caja
-- =============================================================================
--
-- Va aparte de la 12 para que se lea qué cambió del turno y qué cambió de la caja.
-- Ambas son obligatorias juntas: la 12 tumba `caja_estado.sencillo` y estas dos funciones
-- lo usaban, así que sin esto quedan rotas.
--
-- Lo que cambia de verdad, más allá del nombre de la columna:
--
--   El cierre ya no pregunta «cuánto sencillo dejas» y reparte el resto a caja chica.
--   Ahora pregunta «cuánto efectivo hay», lo compara contra lo que debería haber
--   —apertura + ventas en efectivo − gastos en efectivo— y ese conteo ES el nuevo saldo.
--   Cualquier diferencia exige justificación y deja incidencia y alerta.


-- 1 · Abrir ------------------------------------------------------------------

create or replace function public.abrir_turno(
  p_efectivo_contado numeric,
  p_justificacion    text default null
) returns uuid
language plpgsql security definer set search_path = public as $fn$
declare
  v_tenant   uuid := public.current_tenant_id();
  v_actor    uuid := auth.uid();
  v_esperado numeric(10,2);
  v_diff     numeric(10,2);
  v_snapshot jsonb;
  v_turno    uuid;
begin
  if v_tenant is null then raise exception 'Sesión sin hostal asignado'; end if;
  if not public.rol_en(public.r_caja()) then
    raise exception 'Solo administración o recepción pueden abrir turno';
  end if;
  if public.turno_abierto() is not null then
    raise exception 'Ya hay un turno abierto en este hostal';
  end if;

  insert into public.caja_estado (tenant_id) values (v_tenant)
    on conflict (tenant_id) do nothing;

  select saldo into v_esperado from public.caja_estado where tenant_id = v_tenant;
  v_diff := round(v_esperado - p_efectivo_contado, 2);

  if abs(v_diff) > 0.001 and coalesce(btrim(p_justificacion), '') = '' then
    raise exception 'Justifica el descuadre de apertura (diferencia S/ %)', v_diff;
  end if;

  -- Snapshot del inventario: la base del "esperado" del cierre.
  select coalesce(jsonb_object_agg(id::text, stock), '{}'::jsonb)
    into v_snapshot
    from public.productos
   where tenant_id = v_tenant and activo;

  insert into public.turnos (
    tenant_id, usuario_id, sencillo_esperado, sencillo_apertura, apertura_inventario
  ) values (
    v_tenant, v_actor, v_esperado, p_efectivo_contado, v_snapshot
  ) returning id into v_turno;

  if abs(v_diff) > 0.001 then
    insert into public.incidencias (
      tenant_id, turno_id, concepto, unidad, esperado, contado, diferencia,
      justificacion, registrado_por
    ) values (
      v_tenant, v_turno, 'Caja · apertura de turno', 'S/',
      v_esperado, p_efectivo_contado, v_diff, btrim(p_justificacion), v_actor
    );

    insert into public.alertas (
      tenant_id, severidad, titulo, detalle, origen, turno_id, requiere_validacion
    ) values (
      v_tenant, 'warning',
      'La caja no cuadraba al abrir turno',
      'Debería haber S/ ' || to_char(v_esperado, 'FM999999990.00') ||
        ' y se contaron S/ ' || to_char(p_efectivo_contado, 'FM999999990.00') ||
        '. Justificación: ' || btrim(p_justificacion),
      'caja', v_turno, true
    );
  end if;

  return v_turno;
end $fn$;


-- 2 · Cerrar -----------------------------------------------------------------
-- La firma cambia: `p_sencillo_dejar` era «cuánto dejo para el siguiente turno», y con
-- una sola caja eso ya no se decide. Se cuenta lo que hay. Se borra la versión vieja
-- para no quedarnos con dos sobrecargas conviviendo.

drop function if exists public.cerrar_turno(jsonb, numeric, numeric, text);

create or replace function public.cerrar_turno(
  p_conteos           jsonb,
  p_efectivo_contado  numeric,
  p_justificacion_caja text   default null,
  p_ajuste_monto      numeric default null,
  p_ajuste_razon      text    default null
) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_tenant    uuid := public.current_tenant_id();
  v_actor     uuid := auth.uid();
  t           public.turnos%rowtype;
  r           record;
  v_item      jsonb;
  v_contado   numeric(12,2);
  v_just      text;
  v_diff      numeric(12,2);
  v_incid     int := 0;
  v_bruto     numeric(10,2) := 0;
  v_por_medio jsonb;
  v_por_banco jsonb;
  v_gastos    numeric(10,2) := 0;
  v_gastos_ef numeric(10,2) := 0;
  v_esperado  numeric(10,2);
  v_diff_caja numeric(10,2);
  v_just_caja text;
  v_recaudado numeric(10,2);
  v_cierre    uuid;
begin
  if not public.rol_en(public.r_caja()) then
    raise exception 'Solo administración o recepción pueden cerrar turno';
  end if;

  select * into t from public.turnos
   where tenant_id = v_tenant and estado = 'abierto' for update;
  if not found then raise exception 'No hay turno abierto'; end if;

  if t.usuario_id <> v_actor and not public.is_admin() then
    raise exception 'Este turno lo abrió otra persona. Solo un administrador puede cerrarlo.';
  end if;

  -------------------------------------------------------------------------
  -- A. Conteo de inventario: esperado real vs contado
  -------------------------------------------------------------------------
  for r in select * from public.esperado_cierre(t.id) loop
    select value into v_item
      from jsonb_array_elements(coalesce(p_conteos, '[]'::jsonb)) as value
     where value ->> 'producto_id' = r.producto_id::text
     limit 1;

    if v_item is null then
      raise exception 'Falta el conteo de %', r.nombre;
    end if;

    v_contado := (v_item ->> 'contado')::numeric;
    v_just    := btrim(coalesce(v_item ->> 'justificacion', ''));
    v_diff    := round(r.esperado - v_contado, 2);

    if abs(v_diff) > 0.001 and v_just = '' then
      raise exception 'Falta justificar el descuadre de % (esperado %, contado %)',
        r.nombre, r.esperado, v_contado;
    end if;

    insert into public.turno_conteos (
      tenant_id, turno_id, producto_id, apertura, esperado, contado, justificacion
    ) values (v_tenant, t.id, r.producto_id, r.apertura, r.esperado, v_contado, nullif(v_just, ''))
    on conflict (turno_id, producto_id) do update
      set contado = excluded.contado, justificacion = excluded.justificacion;

    if abs(v_diff) > 0.001 then
      insert into public.incidencias (
        tenant_id, turno_id, producto_id, concepto, unidad,
        esperado, contado, diferencia, justificacion, registrado_por
      ) values (
        v_tenant, t.id, r.producto_id, r.nombre, r.unidad,
        r.esperado, v_contado, v_diff, v_just, v_actor
      );
      v_incid := v_incid + 1;

      insert into public.movimientos_inventario (
        tenant_id, producto_id, tipo, cantidad, turno_id, motivo, actor_id
      ) values (
        v_tenant, r.producto_id, 'conteo_cierre', -v_diff, t.id,
        'Ajuste por conteo de cierre', v_actor
      );
    end if;

    update public.productos set stock = v_contado where id = r.producto_id;
  end loop;

  -------------------------------------------------------------------------
  -- B. Caja: una sola, y el conteo manda
  -------------------------------------------------------------------------
  select coalesce(sum(monto), 0) into v_bruto
    from public.ventas where turno_id = t.id;

  select coalesce(jsonb_object_agg(medio, total), '{}'::jsonb) into v_por_medio
    from (select medio, sum(monto) as total from public.ventas
           where turno_id = t.id group by medio) s;

  select coalesce(jsonb_object_agg(coalesce(banco, 'sin banco'), total), '{}'::jsonb) into v_por_banco
    from (select banco, sum(monto) as total from public.ventas
           where turno_id = t.id and medio = 'tarjeta' group by banco) s;

  select coalesce(sum(monto), 0),
         coalesce(sum(monto) filter (where medio = 'efectivo'), 0)
    into v_gastos, v_gastos_ef
    from public.gastos where turno_id = t.id;

  v_esperado  := public.efectivo_esperado(t.id);
  v_diff_caja := round(v_esperado - p_efectivo_contado, 2);
  v_just_caja := nullif(btrim(coalesce(p_justificacion_caja, '')), '');
  v_recaudado := v_bruto - coalesce(p_ajuste_monto, 0);

  if p_ajuste_monto is not null and coalesce(btrim(p_ajuste_razon), '') = '' then
    raise exception 'Indica la razón del ajuste de caja';
  end if;

  if p_efectivo_contado is null or p_efectivo_contado < 0 then
    raise exception 'Cuenta el efectivo que hay en la caja';
  end if;

  -- El dinero se trata igual que el inventario: si no cuadra, alguien lo explica.
  if abs(v_diff_caja) > 0.001 and v_just_caja is null then
    raise exception 'La caja no cuadra: debería haber S/ % y contaste S/ %. Justifícalo.',
      v_esperado, p_efectivo_contado;
  end if;

  insert into public.cierres_caja (
    tenant_id, turno_id, usuario_id, recaudado, por_medio, por_banco,
    efectivo_en_caja, sencillo_dejado, a_caja_chica,
    ajuste_monto, ajuste_razon, incidencias_count
  ) values (
    v_tenant, t.id, t.usuario_id, v_recaudado, v_por_medio, v_por_banco,
    v_esperado, p_efectivo_contado, 0,
    p_ajuste_monto, nullif(btrim(p_ajuste_razon), ''), v_incid
  ) returning id into v_cierre;

  if abs(v_diff_caja) > 0.001 then
    insert into public.incidencias (
      tenant_id, turno_id, concepto, unidad, esperado, contado, diferencia,
      justificacion, registrado_por
    ) values (
      v_tenant, t.id, 'Caja · cierre de turno', 'S/',
      v_esperado, p_efectivo_contado, v_diff_caja, v_just_caja, v_actor
    );
    v_incid := v_incid + 1;

    insert into public.alertas (
      tenant_id, severidad, titulo, detalle, origen, turno_id, requiere_validacion
    ) values (
      v_tenant, 'danger',
      case when v_diff_caja > 0
           then 'Faltan S/ ' || to_char(v_diff_caja, 'FM999999990.00') || ' en la caja'
           else 'Sobran S/ ' || to_char(-v_diff_caja, 'FM999999990.00') || ' en la caja' end,
      'Debería haber S/ ' || to_char(v_esperado, 'FM999999990.00') ||
        ' y se contaron S/ ' || to_char(p_efectivo_contado, 'FM999999990.00') ||
        '. Justificación: ' || v_just_caja,
      'caja', t.id, true
    );
  end if;

  -- El conteo ES el nuevo saldo. No hay reparto que decidir.
  update public.caja_estado
     set saldo = p_efectivo_contado, updated_at = now()
   where tenant_id = v_tenant;

  update public.turnos
     set estado = 'cerrado', cerrado_at = now(),
         sencillo_dejado = p_efectivo_contado, cerrado_por = v_actor
   where id = t.id;

  if v_incid > 0 then
    insert into public.alertas (
      tenant_id, severidad, titulo, detalle, origen, turno_id, requiere_validacion
    ) values (
      v_tenant, 'warning',
      v_incid || ' descuadre(s) al cerrar turno',
      'Requieren que una persona los revise.',
      'turno', t.id, true
    );
  end if;

  return jsonb_build_object(
    'cierre_id',        v_cierre,
    'recaudado',        v_recaudado,
    'por_medio',        v_por_medio,
    'por_banco',        v_por_banco,
    'gastos',           v_gastos,
    'gastos_efectivo',  v_gastos_ef,
    'efectivo_esperado', v_esperado,
    'efectivo_contado', p_efectivo_contado,
    'diferencia_caja',  v_diff_caja,
    'saldo_nuevo',      p_efectivo_contado,
    'incidencias',      v_incid
  );
end $fn$;

revoke execute on function public.cerrar_turno(jsonb, numeric, text, numeric, text) from public;
grant execute on function public.cerrar_turno(jsonb, numeric, text, numeric, text)
  to authenticated, service_role;
