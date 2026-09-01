-- =============================================================================
-- 10 · Stock mínimo, bajas reversibles y catálogo solo para administración
-- =============================================================================

-- 1 · Stock mínimo -----------------------------------------------------------
-- El aviso salía de un 25 % del máximo fijado en el código: el mismo umbral para el papel
-- y para las sábanas. Ahora cada producto dice a partir de cuánto hay que reponerlo.

alter table public.productos
  add column if not exists stock_min numeric(12,2) not null default 0
    check (stock_min >= 0);

comment on column public.productos.stock_min is
  'Avisar cuando el stock baje de aquí. 0 = sin aviso.';

-- Los productos que ya existían conservan el umbral que tenían de hecho (el 25 %),
-- para que nadie vea cambiar sus alertas por haber corrido una migración.
update public.productos
   set stock_min = round(stock_max * 0.25)
 where stock_min = 0;


-- 2 · Bajas reversibles ------------------------------------------------------
-- `activo` ya existía en las dos tablas y nadie lo volvía a poner en true. Un tipo de
-- cuarto con cuartos activos detrás no se puede inhabilitar: dejaría cuartos apuntando a
-- un tarifario que ya no se ofrece.

create or replace function public.inhabilitar_tipo_cuarto(p_tipo_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_tenant uuid := public.current_tenant_id();
  v_cuartos int;
begin
  if not public.rol_en(public.r_admin()) then
    raise exception 'Solo administración puede inhabilitar tipos de cuarto';
  end if;

  select count(*) into v_cuartos
    from public.cuartos
   where tipo_id = p_tipo_id and tenant_id = v_tenant and activo;

  if v_cuartos > 0 then
    raise exception 'Ese tipo todavía lo usan % cuarto(s) activo(s). Cámbialos de tipo o inhabilítalos primero.', v_cuartos;
  end if;

  update public.tipos_cuarto
     set activo = false
   where id = p_tipo_id and tenant_id = v_tenant;

  if not found then
    raise exception 'No existe ese tipo de cuarto';
  end if;
end $fn$;

create or replace function public.habilitar_tipo_cuarto(p_tipo_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.rol_en(public.r_admin()) then
    raise exception 'Solo administración puede habilitar tipos de cuarto';
  end if;

  update public.tipos_cuarto
     set activo = true
   where id = p_tipo_id and tenant_id = public.current_tenant_id();

  if not found then
    raise exception 'No existe ese tipo de cuarto';
  end if;
end $fn$;

-- Un cuarto vuelve solo si su tipo sigue en pie; si no, quedaría sin tarifa que cobrar.
create or replace function public.habilitar_cuarto(p_cuarto_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_tenant uuid := public.current_tenant_id();
  v_tipo_activo boolean;
begin
  if not public.rol_en(public.r_admin()) then
    raise exception 'Solo administración puede habilitar cuartos';
  end if;

  select t.activo into v_tipo_activo
    from public.cuartos c
    join public.tipos_cuarto t on t.id = c.tipo_id
   where c.id = p_cuarto_id and c.tenant_id = v_tenant;

  if v_tipo_activo is null then
    raise exception 'No existe ese cuarto';
  end if;

  if not v_tipo_activo then
    raise exception 'Su tipo de cuarto está inhabilitado. Habilítalo primero.';
  end if;

  update public.cuartos
     set activo = true, estado = 'libre'
   where id = p_cuarto_id and tenant_id = v_tenant;
end $fn$;


-- 3 · El catálogo es de administración ---------------------------------------
-- `aplicar_rls('productos')` y `aplicar_rls('cuartos')` se aplicaron sin rol de escritura,
-- así que cualquiera con sesión podía crear, editar o borrar productos y cuartos yendo
-- directo a PostgREST. La comprobación estaba solo en TypeScript, y eso no es una regla.
--
-- No rompe nada: `registrar_movimiento`, `registrar_venta`, `cerrar_turno` y
-- `cambiar_estado_cuarto` son SECURITY DEFINER y siguen moviendo stock y estados.

drop policy if exists productos_ins on public.productos;
create policy productos_ins on public.productos
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.rol_en(public.r_admin()));

drop policy if exists productos_upd on public.productos;
create policy productos_upd on public.productos
  for update to authenticated
  using      (tenant_id = public.current_tenant_id() and public.rol_en(public.r_admin()))
  with check (tenant_id = public.current_tenant_id() and public.rol_en(public.r_admin()));

drop policy if exists productos_del on public.productos;
create policy productos_del on public.productos
  for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.rol_en(public.r_admin()));

-- En `cuartos` solo se cierran el alta y la baja. El UPDATE lo sigue gobernando
-- `cuartos_upd` de la migración 08, que es la que deja a limpieza mover estados de piso.
drop policy if exists cuartos_ins on public.cuartos;
create policy cuartos_ins on public.cuartos
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.rol_en(public.r_admin()));

drop policy if exists cuartos_del on public.cuartos;
create policy cuartos_del on public.cuartos
  for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.rol_en(public.r_admin()));


-- 4 · Ejecución ---------------------------------------------------------------
revoke execute on function public.inhabilitar_tipo_cuarto(uuid) from public;
revoke execute on function public.habilitar_tipo_cuarto(uuid)   from public;
revoke execute on function public.habilitar_cuarto(uuid)        from public;

grant execute on function public.inhabilitar_tipo_cuarto(uuid) to authenticated;
grant execute on function public.habilitar_tipo_cuarto(uuid)   to authenticated;
grant execute on function public.habilitar_cuarto(uuid)        to authenticated;
