-- #############################################################################
-- 22_limpieza_habilitable.sql · Hostal Inteligente (Atlas)
--
-- No todos los hostales necesitan el rol `limpieza` como cargo aparte — en uno
-- chico puede que el mismo recepcionista limpie. El administrador decide si su
-- hostal lo usa; si lo apaga, el personal ya dado de alta con ese rol se queda
-- bloqueado (no borrado: hay turnos, ventas y auditoría que no se tocan).
--
-- No hace falta una función nueva para escribir esta columna: `tenants_upd` (01,
-- §14) ya deja al administrador actualizar su propio tenant — este campo entra
-- por la misma puerta.
--
-- Idempotente. Se aplica con: node --env-file=.env.local scripts/migrar.mjs
-- #############################################################################

alter table public.tenants
  add column if not exists limpieza_habilitada boolean not null default true;

comment on column public.tenants.limpieza_habilitada is
  'Si es false, el personal con rol limpieza no puede iniciar sesión ni asignarse. No borra a nadie.';
