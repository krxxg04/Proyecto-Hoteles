-- #############################################################################
-- 16 · Una inspección con faltantes deja alerta
-- #############################################################################
--
-- La inspección contaba los faltantes, los devolvía a la pantalla, y ahí se acababa.
-- El propio diálogo lo decía: "el faltante se registra, no se descuenta" — y era verdad,
-- pero nadie volvía a mirar ese registro. Faltar una toalla al salir un huésped es
-- exactamente el caso para el que existe la revisión de salida.
--
-- Va en un trigger y no en `guardarInspeccion` por la misma razón que las demás reglas:
-- desde TypeScript se puede olvidar, y por PostgREST se puede esquivar. Aquí no.
--
-- Es el mismo criterio que `registrar_gasto()`: lo que no encaja se revisa, sin excepción.

create or replace function public.fn_alerta_faltantes()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_faltan   int;
  v_detalle  text;
  v_numero   text;
begin
  -- `resultado` es [{item, esperado, confirmado, nota}]. Falta lo que se contó por debajo
  -- de lo esperado; contar de más no es un problema que haya que revisar.
  select count(*),
         string_agg(
           (r->>'item') || ': faltan ' ||
           ((r->>'esperado')::numeric - (r->>'confirmado')::numeric)::text,
           ' · ' order by r->>'item'
         )
    into v_faltan, v_detalle
    from jsonb_array_elements(new.resultado) r
   where (r->>'confirmado')::numeric < (r->>'esperado')::numeric;

  if coalesce(v_faltan, 0) = 0 then
    return new;
  end if;

  select numero into v_numero from public.cuartos where id = new.cuarto_id;

  insert into public.alertas (
    tenant_id, severidad, titulo, detalle, origen, cuarto_id, requiere_validacion
  ) values (
    new.tenant_id,
    -- Una cosa puede ser un descuido; tres o más al salir alguien ya es otra conversación.
    -- El cast es obligatorio: un `case` con dos literales se tipa como `text` y la columna
    -- es el enum `severidad_alerta`, que no acepta la conversión implícita.
    (case when v_faltan >= 3 then 'danger' else 'warning' end)::public.severidad_alerta,
    'Faltantes en la ' || coalesce(v_numero, 'habitación') ||
      ' · ' || v_faltan || (case when v_faltan = 1 then ' artículo' else ' artículos' end),
    coalesce(v_detalle, '') ||
      coalesce('. Nota de la inspección: ' || nullif(btrim(new.nota), ''), ''),
    'inspeccion',
    new.cuarto_id,
    true
  );

  return new;
end $fn$;

drop trigger if exists inspecciones_alerta_faltantes on public.inspecciones;
create trigger inspecciones_alerta_faltantes
  after insert on public.inspecciones
  for each row execute function public.fn_alerta_faltantes();

-- El trigger corre como definer y escribe en `alertas`; nadie lo ejecuta a mano.
revoke execute on function public.fn_alerta_faltantes() from public;
