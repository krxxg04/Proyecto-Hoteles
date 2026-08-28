-- #############################################################################
-- 08_acciones_por_rol.sql · Hostal Inteligente (Atlas)
--
-- Cierra en la base dos cosas que hasta ahora solo se limitaban en el menú.
--
-- El RLS ya separaba QUÉ TABLAS ve cada rol, pero `cuartos` y
-- `movimientos_inventario` no tienen restricción de rol en escritura: cualquiera
-- con sesión podía poner un cuarto en "ocupada" o registrar una compra. Se veía
-- bien porque el menú no ofrecía el botón — y un menú no es una puerta.
--
-- 1. Estados de cuarto: limpieza y mantenimiento se quedan en su flujo.
-- 2. Compras y ajustes de inventario: solo administración y recepción.
--
-- Idempotente. Se aplica con: node --env-file=.env.local scripts/migrar.mjs
-- #############################################################################


-- #############################################################################
-- 1. ESTADOS DE CUARTO SEGÚN QUIÉN LOS TOCA
--
-- `libre`, `ocupada` y `checkout` siguen a una estadía y a un cobro: los mueve
-- quien maneja el dinero. Los otros cuatro son trabajo de piso y los mueve quien
-- está en el piso — incluido `mantenimiento`, porque quien encuentra la ducha
-- rota suele ser quien entra a limpiar.
-- #############################################################################

create or replace function public.cambiar_estado_cuarto(
  p_cuarto_id uuid,
  p_estado    public.estado_cuarto,
  p_nota      text default null
) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.rol_en(public.r_caja())
     and p_estado in ('libre', 'ocupada', 'checkout')
  then
    raise exception 'El estado "%" lo cambia recepción: va con el check-in y el cobro', p_estado;
  end if;

  update public.cuartos
     set estado = p_estado,
         nota   = coalesce(p_nota, nota)
   where id = p_cuarto_id and tenant_id = public.current_tenant_id();

  if not found then raise exception 'Cuarto no encontrado en este hostal'; end if;
end $fn$;


-- #############################################################################
-- 2. QUÉ MOVIMIENTOS DE INVENTARIO PUEDE HACER CADA ROL
--
-- `compra` y `ajuste` mueven stock sin que haya pasado nada físico que otro
-- pueda ver: son la puerta por donde se tapa un descuadre. Van a administración
-- y recepción.
--
-- Entregar a un cuarto, mandar a lavandería o reportar un daño se quedan
-- abiertos a propósito: eso lo hace quien está limpiando, y que lo registre en
-- el momento es justo lo que hace que el kardex sirva para algo.
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
  if p_tipo in ('compra', 'ajuste') and not public.rol_en(public.r_caja()) then
    raise exception 'Un movimiento de tipo "%" lo registra administración o recepción', p_tipo;
  end if;

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


-- #############################################################################
-- 3. Y QUE NO SE PUEDA ESQUIVAR POR LA PUERTA DE AL LADO
--
-- Las dos funciones son SECURITY DEFINER, así que la comprobación de arriba solo
-- vale si nadie puede escribir en las tablas directamente. Para
-- `movimientos_inventario` el INSERT ya está revocado (03). Para `cuartos` no:
-- un UPDATE directo saltaría la función entera.
-- #############################################################################

drop policy if exists cuartos_upd on public.cuartos;
create policy cuartos_upd on public.cuartos
  for update to authenticated
  using      (tenant_id = public.current_tenant_id())
  with check (
    tenant_id = public.current_tenant_id()
    and (
      public.rol_en(public.r_caja())
      or estado not in ('libre', 'ocupada', 'checkout')
    )
  );


do $$
declare v_ok boolean;
begin
  -- El INSERT directo sobre movimientos tiene que seguir revocado.
  select has_table_privilege('authenticated', 'public.movimientos_inventario', 'insert')
    into v_ok;

  if v_ok then
    raise exception 'authenticated puede insertar en movimientos_inventario: la comprobación de rol se esquiva';
  end if;

  raise notice 'OK · 08_acciones_por_rol.sql aplicado';
end $$;
