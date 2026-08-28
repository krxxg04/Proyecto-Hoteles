-- =============================================================================
-- 03_logica_negocio.sql · Hostal Inteligente (Atlas)
--
-- Tarifario, ventas, check-in y cierre de turno. Ejecutar DESPUÉS de 02.
-- Idempotente.
--
-- PRINCIPIO: lo que mueve dinero o stock NO se escribe con un INSERT desde el
-- cliente. Se llama una función que valida, calcula y escribe en una sola
-- transacción. Al final se revoca la escritura directa sobre esas tablas.
--
-- Esto corrige cuatro problemas que el prototipo tiene a propósito:
--   1. El precio estaba hardcodeado (RATE_HOUR/RATE_NIGHT, marcado [BACKEND]).
--   2. El stock se validaba en el navegador (se saltaba con la consola abierta).
--   3. El "esperado" del cierre era mentira ("[BACKEND] esperado = apertura").
--   4. cajaEnviar() hacía cinco mutaciones sueltas, sin transacción.
-- =============================================================================


-- #############################################################################
-- 1. TARIFARIO — el precio se calcula en el servidor
--
-- Usa la estructura real de TARIFA_DEF: bloque de horas + amanecida, con
-- diferencia lunes-jueves vs viernes-domingo.
-- Fin de semana = viernes, sábado y domingo (dow 5, 6, 0).
-- #############################################################################

create or replace function public.es_fin_de_semana(p_fecha date)
returns boolean language sql immutable as $fn$
  select extract(dow from p_fecha) in (0, 5, 6)
$fn$;

create or replace function public.calcular_tarifa(
  p_cuarto_id     uuid,
  p_modo          public.modo_estadia,
  p_horas         int  default null,
  p_noches        int  default null,
  p_fecha_entrada date default current_date
) returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  c              public.cuartos%rowtype;
  t              public.tipos_cuarto%rowtype;
  v_costo        numeric(10,2);
  v_amanecida    numeric(10,2);
  v_amanecida_vd numeric(10,2);
  v_horas_incl   int;
  v_extra        int := 0;
  v_total        numeric(10,2) := 0;
  v_noches       int;
  v_fecha        date;
  v_detalle      jsonb := '[]'::jsonb;
  i              int;
begin
  select * into c from public.cuartos
   where id = p_cuarto_id and tenant_id = public.current_tenant_id();
  if not found then
    raise exception 'Cuarto no encontrado en este hostal';
  end if;

  select * into t from public.tipos_cuarto where id = c.tipo_id;

  -- Overrides por cuarto, igual que tarifaOf() en el prototipo.
  v_costo        := coalesce(c.tarifa_costo, t.costo);
  v_amanecida    := coalesce(c.tarifa_amanecida, t.amanecida);
  v_amanecida_vd := coalesce(nullif(t.amanecida_vd, 0), v_amanecida);

  if p_modo = 'horas' then
    if p_horas is null or p_horas <= 0 then
      raise exception 'Indica cuántas horas';
    end if;

    v_horas_incl := case when public.es_fin_de_semana(p_fecha_entrada)
                         then t.horas_vd else t.horas_lj end;
    v_extra := greatest(0, p_horas - v_horas_incl);
    v_total := v_costo + (v_extra * t.hora_extra);

    v_detalle := jsonb_build_array(jsonb_build_object(
      'concepto', 'Bloque de ' || v_horas_incl || ' h',
      'monto',    v_costo,
      'fin_de_semana', public.es_fin_de_semana(p_fecha_entrada)
    ));
    if v_extra > 0 then
      v_detalle := v_detalle || jsonb_build_array(jsonb_build_object(
        'concepto', v_extra || ' h adicionales',
        'monto',    v_extra * t.hora_extra
      ));
    end if;

  else
    v_noches := case when p_modo = 'dia' then 1 else coalesce(p_noches, 1) end;
    if v_noches <= 0 then
      raise exception 'Indica cuántas noches';
    end if;

    -- Noche por noche: cada una puede caer en tarifa distinta.
    for i in 0 .. v_noches - 1 loop
      v_fecha := p_fecha_entrada + i;
      if public.es_fin_de_semana(v_fecha) then
        v_total   := v_total + v_amanecida_vd;
        v_detalle := v_detalle || jsonb_build_array(jsonb_build_object(
          'concepto', 'Noche ' || to_char(v_fecha, 'DD/MM') || ' (fin de semana)',
          'monto', v_amanecida_vd));
      else
        v_total   := v_total + v_amanecida;
        v_detalle := v_detalle || jsonb_build_array(jsonb_build_object(
          'concepto', 'Noche ' || to_char(v_fecha, 'DD/MM'),
          'monto', v_amanecida));
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'total',    v_total,
    'deposito', t.deposito,
    'moneda',   'PEN',
    'modo',     p_modo,
    'detalle',  v_detalle
  );
end $fn$;


-- Sugerencia de cuarto por aforo y características. La usa el agente de IA.
create or replace function public.sugerir_cuarto(
  p_personas        int default 1,
  p_caracteristicas text[] default '{}'
) returns table (cuarto_id uuid, numero text, tipo text, aforo int, coincidencias int)
language sql stable security definer set search_path = public as $fn$
  select c.id, c.numero, t.nombre, c.aforo,
         cardinality(array(select unnest(c.caracteristicas) intersect select unnest(p_caracteristicas)))
    from public.cuartos c
    join public.tipos_cuarto t on t.id = c.tipo_id
   where c.tenant_id = public.current_tenant_id()
     and c.activo
     and c.estado in ('lista','libre')
     and c.aforo >= p_personas
   order by cardinality(array(select unnest(c.caracteristicas) intersect select unnest(p_caracteristicas))) desc,
            c.aforo asc,
            c.numero asc
$fn$;


-- #############################################################################
-- 2. TURNO — apertura
-- #############################################################################

create or replace function public.turno_abierto()
returns uuid language sql stable security definer set search_path = public as $fn$
  select id from public.turnos
   where tenant_id = public.current_tenant_id() and estado = 'abierto'
   limit 1
$fn$;

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

  select sencillo into v_esperado from public.caja_estado where tenant_id = v_tenant;
  v_diff := round(v_esperado - p_efectivo_contado, 2);

  -- Justificación obligatoria si no cuadra (regla del prototipo).
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
  end if;

  return v_turno;
end $fn$;


-- #############################################################################
-- 3. INVENTARIO Y VENTAS — stock validado en el servidor
-- #############################################################################

create or replace function public.registrar_movimiento(
  p_producto_id uuid,
  p_tipo        public.tipo_movimiento,
  p_cantidad    numeric,          -- positivo entra, negativo sale
  p_cuarto_id   uuid default null,
  p_motivo      text default null
) returns bigint
language plpgsql security definer set search_path = public as $fn$
declare
  v_tenant uuid := public.current_tenant_id();
  v_stock  numeric(12,2);
  v_mov    bigint;
begin
  select stock into v_stock
    from public.productos
   where id = p_producto_id and tenant_id = v_tenant
   for update;

  if not found then raise exception 'Producto no encontrado en este hostal'; end if;

  if v_stock + p_cantidad < 0 then
    raise exception 'Stock insuficiente: hay % y se intentan sacar %', v_stock, abs(p_cantidad);
  end if;

  update public.productos
     set stock = stock + p_cantidad
   where id = p_producto_id;

  insert into public.movimientos_inventario (
    tenant_id, producto_id, tipo, cantidad, cuarto_id, turno_id, motivo, actor_id
  ) values (
    v_tenant, p_producto_id, p_tipo, p_cantidad, p_cuarto_id,
    public.turno_abierto(), p_motivo, auth.uid()
  ) returning id into v_mov;

  return v_mov;
end $fn$;


create or replace function public.registrar_venta(
  p_producto_id uuid,
  p_cantidad    numeric,
  p_cuarto_id   uuid default null,
  p_medio       public.medio_pago default 'efectivo',
  p_banco       text default null,
  p_moneda_orig char(3) default null,
  p_monto_orig  numeric default null
) returns uuid
language plpgsql security definer set search_path = public as $fn$
declare
  v_tenant uuid := public.current_tenant_id();
  v_turno  uuid := public.turno_abierto();
  p        public.productos%rowtype;
  v_numero text;
  v_monto  numeric(10,2);
  v_tc     numeric(10,4);
  v_venta  uuid;
begin
  if not public.rol_en(public.r_caja()) then
    raise exception 'Solo administración o recepción pueden registrar ventas';
  end if;
  if v_turno is null then
    raise exception 'Abre un turno para registrar ventas';
  end if;
  if p_cantidad <= 0 then
    raise exception 'Cantidad inválida';
  end if;

  select * into p from public.productos
   where id = p_producto_id and tenant_id = v_tenant;
  if not found then raise exception 'Producto no encontrado'; end if;

  if p.categoria <> 'vendible' then
    raise exception '% es un insumo, no se vende', p.nombre;
  end if;

  -- El monto lo pone el servidor desde el precio del catálogo, no el cliente.
  v_monto := round(p.precio * p_cantidad, 2);

  if p_moneda_orig is not null and p_moneda_orig <> 'PEN' then
    select valor into v_tc from public.tipo_cambio
     where tenant_id = v_tenant and moneda = p_moneda_orig
     order by vigente_desde desc limit 1;
    if v_tc is null then
      raise exception 'No hay tipo de cambio configurado para %', p_moneda_orig;
    end if;
  end if;

  select numero into v_numero from public.cuartos where id = p_cuarto_id;

  -- Descuenta stock y deja el movimiento (lanza si no alcanza).
  perform public.registrar_movimiento(
    p_producto_id, 'venta', -p_cantidad, p_cuarto_id, 'Venta a habitación');

  insert into public.ventas (
    tenant_id, turno_id, concepto, producto_id, cantidad, cuarto_id,
    monto, medio, banco, moneda_orig, monto_orig, tipo_cambio, actor_id
  ) values (
    v_tenant, v_turno,
    'Venta · ' || p.nombre || ' x' || p_cantidad || coalesce(' · Hab. ' || v_numero, ''),
    p_producto_id, p_cantidad, p_cuarto_id,
    v_monto, p_medio, p_banco, p_moneda_orig, p_monto_orig, v_tc, auth.uid()
  ) returning id into v_venta;

  return v_venta;
end $fn$;


create or replace function public.entregar_a_cuarto(
  p_producto_id uuid,
  p_cantidad    numeric,
  p_cuarto_id   uuid
) returns bigint
language plpgsql security definer set search_path = public as $fn$
begin
  return public.registrar_movimiento(
    p_producto_id, 'entrega', -p_cantidad, p_cuarto_id, 'Entrega a habitación');
end $fn$;


create or replace function public.registrar_compra(
  p_producto_id uuid,
  p_cantidad    numeric,
  p_motivo      text default null
) returns bigint
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.rol_en(public.r_caja()) then
    raise exception 'Solo administración o recepción pueden registrar compras';
  end if;
  return public.registrar_movimiento(
    p_producto_id, 'compra', abs(p_cantidad), null, coalesce(p_motivo, 'Compra'));
end $fn$;


create or replace function public.enviar_a_aseo(
  p_producto_id uuid,
  p_cantidad    numeric default 1,
  p_cuarto_id   uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $fn$
declare
  v_tenant uuid := public.current_tenant_id();
  p        public.productos%rowtype;
  v_id     uuid;
begin
  select * into p from public.productos where id = p_producto_id and tenant_id = v_tenant;
  if not found then raise exception 'Producto no encontrado'; end if;
  if p.clase <> 'no_descartable' then
    raise exception '% es descartable, no va a lavandería', p.nombre;
  end if;

  perform public.registrar_movimiento(p_producto_id, 'aseo', -p_cantidad, p_cuarto_id, 'Enviado a lavandería');

  insert into public.aseo (tenant_id, producto_id, cantidad, cuarto_id, enviado_por)
  values (v_tenant, p_producto_id, p_cantidad, p_cuarto_id, auth.uid())
  returning id into v_id;

  return v_id;
end $fn$;


create or replace function public.aseo_listo(p_aseo_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare a public.aseo%rowtype;
begin
  select * into a from public.aseo
   where id = p_aseo_id and tenant_id = public.current_tenant_id() and estado = 'pendiente';
  if not found then raise exception 'Pendiente de aseo no encontrado'; end if;

  perform public.registrar_movimiento(
    a.producto_id, 'devolucion_aseo', a.cantidad, a.cuarto_id, 'Vuelve de lavandería');

  update public.aseo set estado = 'listo', listo_at = now() where id = p_aseo_id;
end $fn$;


-- #############################################################################
-- 4. CHECK-IN Y CHECK-OUT
-- #############################################################################

create or replace function public.registrar_checkin(
  p_cuarto_id     uuid,
  p_modo          public.modo_estadia,
  p_nombre        text,
  p_tipo_doc      text default 'DNI',
  p_num_doc       text default null,
  p_telefono      text default null,
  p_horas         int  default null,
  p_noches        int  default null,
  p_fecha_entrada date default current_date,
  p_personas      int  default 1,
  p_medio         public.medio_pago default 'efectivo',
  p_banco         text default null,
  p_acompanantes  jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_tenant  uuid := public.current_tenant_id();
  v_turno   uuid := public.turno_abierto();
  c         public.cuartos%rowtype;
  v_huesped uuid;
  v_tarifa  jsonb;
  v_estadia uuid;
  v_salida  date;
  a         jsonb;
begin
  if not public.rol_en(public.r_caja()) then
    raise exception 'Solo administración o recepción pueden hacer check-in';
  end if;

  select * into c from public.cuartos
   where id = p_cuarto_id and tenant_id = v_tenant for update;
  if not found then raise exception 'Cuarto no encontrado'; end if;

  if c.estado not in ('lista','libre') then
    raise exception 'El cuarto % está en estado "%" y no admite check-in', c.numero, c.estado;
  end if;
  if p_personas > c.aforo then
    raise exception 'El cuarto % admite % personas y se registran %', c.numero, c.aforo, p_personas;
  end if;

  -- El precio SIEMPRE sale del tarifario del servidor.
  v_tarifa := public.calcular_tarifa(p_cuarto_id, p_modo, p_horas, p_noches, p_fecha_entrada);

  -- Huésped: se reutiliza si ya existe por documento.
  if p_num_doc is not null then
    select id into v_huesped from public.huespedes
     where tenant_id = v_tenant and tipo_doc = p_tipo_doc and num_doc = p_num_doc;
  end if;

  if v_huesped is null then
    insert into public.huespedes (tenant_id, nombre, tipo_doc, num_doc, telefono)
    values (v_tenant, p_nombre, p_tipo_doc,
            coalesce(p_num_doc, 'SIN-DOC-' || substr(gen_random_uuid()::text, 1, 8)),
            p_telefono)
    returning id into v_huesped;
  end if;

  v_salida := case
    when p_modo = 'horas' then p_fecha_entrada
    else p_fecha_entrada + coalesce(case when p_modo = 'dia' then 1 else p_noches end, 1)
  end;

  insert into public.estadias (
    tenant_id, huesped_id, cuarto_id, modo, horas, noches,
    fecha_entrada, fecha_salida, personas,
    tarifa_total, deposito, tarifa_detalle, turno_id, creado_por
  ) values (
    v_tenant, v_huesped, p_cuarto_id, p_modo, p_horas,
    case when p_modo = 'dia' then 1 else p_noches end,
    p_fecha_entrada, v_salida, p_personas,
    (v_tarifa ->> 'total')::numeric, (v_tarifa ->> 'deposito')::numeric,
    v_tarifa, v_turno, auth.uid()
  ) returning id into v_estadia;

  for a in select * from jsonb_array_elements(coalesce(p_acompanantes, '[]'::jsonb)) loop
    insert into public.acompanantes (tenant_id, estadia_id, nombre, tipo_doc, num_doc)
    values (v_tenant, v_estadia, a ->> 'nombre',
            coalesce(a ->> 'tipo_doc', 'DNI'), a ->> 'num_doc');
  end loop;

  update public.cuartos
     set estado = 'ocupada',
         nota   = p_nombre
   where id = p_cuarto_id;

  -- El cobro entra a la caja del turno.
  if v_turno is not null then
    insert into public.ventas (
      tenant_id, turno_id, concepto, cuarto_id, estadia_id, monto, medio, banco, actor_id
    ) values (
      v_tenant, v_turno, 'Check-in Hab. ' || c.numero, p_cuarto_id, v_estadia,
      (v_tarifa ->> 'total')::numeric, p_medio, p_banco, auth.uid()
    );
  end if;

  return jsonb_build_object(
    'estadia_id', v_estadia,
    'huesped_id', v_huesped,
    'cuarto',     c.numero,
    'tarifa',     v_tarifa
  );
end $fn$;


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
     set estado = 'checkout', nota = 'Check-out sin verificar'
   where id = e.cuarto_id;
end $fn$;


create or replace function public.cambiar_estado_cuarto(
  p_cuarto_id uuid,
  p_estado    public.estado_cuarto,
  p_nota      text default null
) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  update public.cuartos
     set estado = p_estado,
         nota   = coalesce(p_nota, nota)
   where id = p_cuarto_id and tenant_id = public.current_tenant_id();
  if not found then raise exception 'Cuarto no encontrado en este hostal'; end if;
end $fn$;


-- #############################################################################
-- 5. CIERRE DE TURNO Y CAJA — todo o nada
--
-- El "esperado" ya no miente: sale del snapshot de apertura más los
-- movimientos reales del turno.
-- #############################################################################

create or replace function public.esperado_cierre(p_turno_id uuid)
returns table (producto_id uuid, nombre text, unidad text, apertura numeric, esperado numeric)
language sql stable security definer set search_path = public as $fn$
  select p.id,
         p.nombre,
         p.unidad,
         coalesce((t.apertura_inventario ->> p.id::text)::numeric, 0) as apertura,
         coalesce((t.apertura_inventario ->> p.id::text)::numeric, 0)
           + coalesce((
               select sum(m.cantidad) from public.movimientos_inventario m
                where m.turno_id = t.id and m.producto_id = p.id
                  and m.tipo <> 'conteo_cierre'
             ), 0) as esperado
    from public.turnos t
    join public.productos p on p.tenant_id = t.tenant_id and p.activo
   where t.id = p_turno_id and t.tenant_id = public.current_tenant_id()
   order by p.nombre
$fn$;


-- p_conteos: [{"producto_id":"uuid","contado":20,"justificacion":"texto"}]
create or replace function public.cerrar_turno(
  p_conteos        jsonb,
  p_sencillo_dejar numeric,
  p_ajuste_monto   numeric default null,
  p_ajuste_razon   text    default null
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
  v_efectivo_ventas numeric(10,2) := 0;
  v_por_medio jsonb;
  v_por_banco jsonb;
  v_efectivo_caja numeric(10,2);
  v_recaudado numeric(10,2);
  v_caja_chica numeric(10,2);
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

    -- Justificación obligatoria en cada descuadre (regla del prototipo).
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

    -- El stock queda en lo realmente contado.
    update public.productos set stock = v_contado where id = r.producto_id;
  end loop;

  -------------------------------------------------------------------------
  -- B. Caja
  -------------------------------------------------------------------------
  select coalesce(sum(monto), 0),
         coalesce(sum(monto) filter (where medio = 'efectivo'), 0)
    into v_bruto, v_efectivo_ventas
    from public.ventas where turno_id = t.id;

  select coalesce(jsonb_object_agg(medio, total), '{}'::jsonb) into v_por_medio
    from (select medio, sum(monto) as total from public.ventas
           where turno_id = t.id group by medio) s;

  select coalesce(jsonb_object_agg(coalesce(banco, 'sin banco'), total), '{}'::jsonb) into v_por_banco
    from (select banco, sum(monto) as total from public.ventas
           where turno_id = t.id and medio = 'tarjeta' group by banco) s;

  v_efectivo_caja := t.sencillo_apertura + v_efectivo_ventas;
  v_recaudado     := v_bruto - coalesce(p_ajuste_monto, 0);

  if p_ajuste_monto is not null and coalesce(btrim(p_ajuste_razon), '') = '' then
    raise exception 'Indica la razón del ajuste de caja';
  end if;
  if p_sencillo_dejar < 0 or p_sencillo_dejar > v_efectivo_caja + 0.001 then
    raise exception 'El sencillo a dejar (S/ %) no puede superar el efectivo en caja (S/ %)',
      p_sencillo_dejar, v_efectivo_caja;
  end if;

  v_caja_chica := greatest(0, v_efectivo_caja - p_sencillo_dejar);

  insert into public.cierres_caja (
    tenant_id, turno_id, usuario_id, recaudado, por_medio, por_banco,
    efectivo_en_caja, sencillo_dejado, a_caja_chica,
    ajuste_monto, ajuste_razon, incidencias_count
  ) values (
    v_tenant, t.id, t.usuario_id, v_recaudado, v_por_medio, v_por_banco,
    v_efectivo_caja, p_sencillo_dejar, v_caja_chica,
    p_ajuste_monto, nullif(btrim(p_ajuste_razon), ''), v_incid
  ) returning id into v_cierre;

  -- El sencillo dejado es la apertura del próximo turno.
  update public.caja_estado
     set sencillo   = p_sencillo_dejar,
         caja_chica = caja_chica + v_caja_chica,
         updated_at = now()
   where tenant_id = v_tenant;

  update public.turnos
     set estado = 'cerrado', cerrado_at = now(),
         sencillo_dejado = p_sencillo_dejar, cerrado_por = v_actor
   where id = t.id;

  if v_incid > 0 then
    insert into public.alertas (tenant_id, severidad, titulo, detalle, origen, turno_id, requiere_validacion)
    values (v_tenant, 'warning',
            v_incid || ' descuadre(s) de inventario',
            'Registrados al cerrar el turno. Requieren validación humana.',
            'turno', t.id, true);
  end if;

  return jsonb_build_object(
    'cierre_id',        v_cierre,
    'recaudado',        v_recaudado,
    'por_medio',        v_por_medio,
    'por_banco',        v_por_banco,
    'efectivo_en_caja', v_efectivo_caja,
    'sencillo_dejado',  p_sencillo_dejar,
    'a_caja_chica',     v_caja_chica,
    'incidencias',      v_incid
  );
end $fn$;


create or replace function public.revisar_incidencia(p_incidencia_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.rol_en(public.r_caja()) then
    raise exception 'No tienes permiso para revisar incidencias';
  end if;
  update public.incidencias
     set estado = 'revisada', revisado_por = auth.uid(), revisado_at = now()
   where id = p_incidencia_id and tenant_id = public.current_tenant_id();
end $fn$;


-- #############################################################################
-- 6. PERMISOS
--
-- Se revoca la escritura DIRECTA sobre las tablas que mueven dinero o stock.
-- El cliente solo puede tocarlas llamando a las funciones de arriba, que
-- validan y calculan. Un INSERT crudo con un monto inventado ya no es posible.
-- La lectura sigue gobernada por el RLS de 01_schema.sql.
-- #############################################################################

revoke insert, update, delete on public.ventas                 from authenticated;
revoke insert, update, delete on public.movimientos_inventario from authenticated;
revoke insert, update, delete on public.turnos                 from authenticated;
revoke insert, update, delete on public.turno_conteos          from authenticated;
revoke insert, update, delete on public.cierres_caja           from authenticated;
revoke insert, update, delete on public.caja_estado            from authenticated;
revoke insert, update, delete on public.incidencias            from authenticated;
revoke insert, update, delete on public.cuarto_estado_log      from authenticated;
revoke insert, update, delete on public.estadias               from authenticated;
revoke insert, update, delete on public.aseo                   from authenticated;

grant execute on function public.calcular_tarifa(uuid, public.modo_estadia, int, int, date) to authenticated;
grant execute on function public.sugerir_cuarto(int, text[])                                 to authenticated;
grant execute on function public.turno_abierto()                                             to authenticated;
grant execute on function public.abrir_turno(numeric, text)                                  to authenticated;
grant execute on function public.registrar_movimiento(uuid, public.tipo_movimiento, numeric, uuid, text) to authenticated;
grant execute on function public.registrar_venta(uuid, numeric, uuid, public.medio_pago, text, char, numeric) to authenticated;
grant execute on function public.entregar_a_cuarto(uuid, numeric, uuid)                      to authenticated;
grant execute on function public.registrar_compra(uuid, numeric, text)                       to authenticated;
grant execute on function public.enviar_a_aseo(uuid, numeric, uuid)                          to authenticated;
grant execute on function public.aseo_listo(uuid)                                            to authenticated;
grant execute on function public.registrar_checkin(uuid, public.modo_estadia, text, text, text, text, int, int, date, int, public.medio_pago, text, jsonb) to authenticated;
grant execute on function public.registrar_checkout(uuid)                                    to authenticated;
grant execute on function public.cambiar_estado_cuarto(uuid, public.estado_cuarto, text)     to authenticated;
grant execute on function public.esperado_cierre(uuid)                                       to authenticated;
grant execute on function public.cerrar_turno(jsonb, numeric, numeric, text)                 to authenticated;
grant execute on function public.revisar_incidencia(uuid)                                    to authenticated;
grant execute on function public.es_fin_de_semana(date)                                      to authenticated;

do $$ begin
  raise notice 'OK · 03_logica_negocio.sql aplicado · dinero y stock solo por funciones';
end $$;
