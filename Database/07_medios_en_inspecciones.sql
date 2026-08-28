-- #############################################################################
-- 07_medios_en_inspecciones.sql · Hostal Inteligente (Atlas)
--
-- Enlaza la foto de una inspección con su fila en `medios`.
--
-- `inspecciones.foto_key` guardaba la llave del objeto en R2 suelta. Firmar una URL a
-- partir de una llave suelta obliga a confiar en la llave, y una llave no tiene dueño:
-- apuntando a `medios.id` el RLS de esa tabla vuelve a ser quien decide, igual que con
-- el resto de las fotos.
--
-- `foto_key` se queda por compatibilidad, marcada como obsoleta. No se borra una
-- columna que podría tener datos sin mirar antes qué hay dentro.
--
-- Idempotente. Se aplica con: node --env-file=.env.local scripts/migrar.mjs
-- #############################################################################

alter table public.inspecciones
  add column if not exists medio_id uuid references public.medios(id) on delete set null;

comment on column public.inspecciones.medio_id is
  'Foto de la inspección. El acceso se sirve con URL firmada; el RLS de `medios` es quien manda.';

comment on column public.inspecciones.foto_key is
  'OBSOLETA desde 07. Usar `medio_id`. Se conserva por si quedan datos de antes.';

create index if not exists inspecciones_medio_idx
  on public.inspecciones (medio_id) where medio_id is not null;


do $$ begin
  raise notice 'OK · 07_medios_en_inspecciones.sql aplicado';
end $$;
