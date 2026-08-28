-- =============================================================================
-- 01_schema.sql · Hostal Inteligente (Atlas)
-- Esquema multi-tenant + RLS. Tablas vacías, derivadas 1:1 del prototipo.
--
-- Ejecutar en: Supabase SQL Editor · proyecto hostal-atlas-dev
-- Idempotente: se puede volver a ejecutar sin romper nada.
--
-- Orden interno (importa): tipos -> tablas -> funciones -> RLS.
-- Las funciones van después de las tablas porque Postgres valida el cuerpo de
-- las funciones `language sql` al crearlas, y consultan `profiles`.
--
-- Referencias: ADR-001 §2/§3/§4 · CLAUDE.md (gate de seguridad) · plan.md
-- =============================================================================


-- #############################################################################
-- 1. EXTENSIONES
-- #############################################################################
create extension if not exists pgcrypto;


-- #############################################################################
-- 2. TIPOS
-- Sin tildes a propósito: estos valores viajan en claims de JWT y en filtros.
-- #############################################################################

do $$ begin
  create type public.rol_usuario as enum ('administrador','recepcion','limpieza','mantenimiento');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.plan_tenant as enum ('base','premium');
exception when duplicate_object then null; end $$;

-- ESTADOS_FLUJO del prototipo, en el mismo orden operativo.
do $$ begin
  create type public.estado_cuarto as enum
    ('libre','ocupada','checkout','limpieza','inspeccion','lista','mantenimiento');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.categoria_producto as enum ('insumo','vendible');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.clase_producto as enum ('descartable','no_descartable');
exception when duplicate_object then null; end $$;

-- MEDIOS del prototipo.
do $$ begin
  create type public.medio_pago as enum ('efectivo','yape','plin','tarjeta');
exception when duplicate_object then null; end $$;

-- Motor de inventario completo (plan.md · mediano plazo).
do $$ begin
  create type public.tipo_movimiento as enum
    ('compra','entrega','venta','aseo','devolucion_aseo','danio','perdida','ajuste','conteo_cierre');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.modo_estadia as enum ('horas','dia','rango');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_estadia as enum ('activa','cerrada','cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_reserva as enum ('pendiente','confirmada','cancelada','no_show','convertida');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_turno as enum ('abierto','cerrado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_incidencia as enum ('abierta','revisada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.severidad_alerta as enum ('info','warning','danger');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_aseo as enum ('pendiente','listo');
exception when duplicate_object then null; end $$;


-- #############################################################################
-- 3. UTILIDADES
-- #############################################################################

create or replace function public.set_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at = now();
  return new;
end $fn$;


-- #############################################################################
-- 4. TABLAS — BASE
-- #############################################################################

-- Un tenant = un hostal (cliente de la licencia mensual).
create table if not exists public.tenants (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  nombre      text not null,
  ruc         text,
  ciudad      text not null default 'Lima',
  moneda      char(3) not null default 'PEN',
  plan        public.plan_tenant not null default 'base',
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.tenants is 'Hostales suscritos. Raíz del aislamiento multi-tenant.';
comment on column public.tenants.slug is 'Identificador corto. Se usa para el email sintético de login: <dni>@<slug>.hostal.local';

-- Personal. 1:1 con auth.users. El PIN lo guarda Supabase Auth, no esta tabla.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  dni         text not null,
  nombre      text not null,
  rol         public.rol_usuario not null default 'recepcion',
  telefono    text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_dni_unico_por_tenant unique (tenant_id, dni)
);
comment on table public.profiles is 'STAFF del prototipo. El PIN vive en auth.users como contraseña.';
create index if not exists profiles_tenant_idx on public.profiles (tenant_id);


-- #############################################################################
-- 5. TABLAS — CATÁLOGOS GLOBALES
-- Sin tenant_id: son referencia compartida, no datos de cliente.
-- #############################################################################

-- FEATURES del prototipo.
create table if not exists public.caracteristicas (
  clave  text primary key,
  label  text not null,
  icono  text not null,
  orden  int  not null default 0
);

-- BANCOS del prototipo.
create table if not exists public.bancos (
  clave  text primary key,
  label  text not null,
  orden  int  not null default 0
);


-- #############################################################################
-- 6. TABLAS — CUARTOS Y TARIFARIO
-- #############################################################################

-- ROOM_TIPOS + TARIFA_DEF del prototipo.
-- Aquí vive el tarifario que hoy está hardcodeado en RATE_HOUR/RATE_NIGHT.
create table if not exists public.tipos_cuarto (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  nombre            text not null,
  aforo             int  not null default 2 check (aforo between 1 and 12),
  -- Tarifario (TARIFA_DEF): bloque de horas + amanecida, con diferencia L-J / V-D
  costo             numeric(10,2) not null default 0,   -- precio del bloque de horas
  horas_lj          int  not null default 6,            -- horas incluidas lunes-jueves
  horas_vd          int  not null default 4,            -- horas incluidas viernes-domingo
  hora_extra        numeric(10,2) not null default 0,   -- precio por hora fuera del bloque
  amanecida         numeric(10,2) not null default 0,   -- noche lunes-jueves
  amanecida_vd      numeric(10,2) not null default 0,   -- noche viernes-domingo
  deposito          numeric(10,2) not null default 0,
  activo            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint tipos_cuarto_nombre_unico unique (tenant_id, nombre)
);
comment on table public.tipos_cuarto is
  'Tarifario configurable por Admin. Reemplaza las constantes RATE_HOUR/RATE_NIGHT marcadas [BACKEND] en stayInfo().';
create index if not exists tipos_cuarto_tenant_idx on public.tipos_cuarto (tenant_id);

-- ROOMS del prototipo.
create table if not exists public.cuartos (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  numero             text not null,
  tipo_id            uuid not null references public.tipos_cuarto(id) on delete restrict,
  estado             public.estado_cuarto not null default 'libre',
  nota               text,
  aforo              int not null default 2 check (aforo between 1 and 12),
  caracteristicas    text[] not null default '{}',
  -- Overrides opcionales por cuarto (tarifaOf() los contempla)
  tarifa_costo       numeric(10,2),
  tarifa_amanecida   numeric(10,2),
  activo             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint cuartos_numero_unico unique (tenant_id, numero)
);
create index if not exists cuartos_tenant_idx on public.cuartos (tenant_id);
create index if not exists cuartos_estado_idx on public.cuartos (tenant_id, estado);

-- Historial de setRoomState(). El prototipo lo pierde; aquí queda auditado.
create table if not exists public.cuarto_estado_log (
  id           bigserial primary key,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  cuarto_id    uuid not null references public.cuartos(id) on delete cascade,
  estado_ant   public.estado_cuarto,
  estado_new   public.estado_cuarto not null,
  actor_id     uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists cuarto_estado_log_idx on public.cuarto_estado_log (tenant_id, cuarto_id, created_at desc);


-- #############################################################################
-- 7. TABLAS — INVENTARIO
-- #############################################################################

-- INV del prototipo.
create table if not exists public.productos (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  nombre      text not null,
  icono       text not null default 'package',
  unidad      text not null default 'unid.',
  stock       numeric(12,2) not null default 0 check (stock >= 0),
  stock_max   numeric(12,2) not null default 100 check (stock_max > 0),
  categoria   public.categoria_producto not null default 'insumo',
  clase       public.clase_producto not null default 'descartable',
  precio      numeric(10,2) not null default 0 check (precio >= 0),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint productos_nombre_unico unique (tenant_id, nombre)
);
comment on column public.productos.categoria is 'insumo = no se vende · vendible = tiene precio y se cobra';
comment on column public.productos.clase is 'descartable = se consume · no_descartable = vuelve por lavandería (ASEO)';
create index if not exists productos_tenant_idx on public.productos (tenant_id);

-- El libro mayor del inventario. Sin esto, el "esperado" del cierre de turno
-- es mentira (el prototipo lo admite: "[BACKEND] esperado = apertura").
create table if not exists public.movimientos_inventario (
  id           bigserial primary key,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  producto_id  uuid not null references public.productos(id) on delete restrict,
  tipo         public.tipo_movimiento not null,
  cantidad     numeric(12,2) not null,   -- positivo entra, negativo sale
  cuarto_id    uuid references public.cuartos(id) on delete set null,
  turno_id     uuid,                     -- FK diferida (turnos se define más abajo)
  estadia_id   uuid,
  motivo       text,
  actor_id     uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
comment on table public.movimientos_inventario is
  'Libro mayor. esperado_cierre = apertura + sum(cantidad) de los movimientos del turno.';
create index if not exists mov_inv_tenant_idx   on public.movimientos_inventario (tenant_id, created_at desc);
create index if not exists mov_inv_producto_idx on public.movimientos_inventario (tenant_id, producto_id);
create index if not exists mov_inv_turno_idx    on public.movimientos_inventario (turno_id);

-- ASEO del prototipo: no descartables enviados a lavandería.
create table if not exists public.aseo (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  producto_id  uuid not null references public.productos(id) on delete restrict,
  cantidad     numeric(12,2) not null default 1,
  cuarto_id    uuid references public.cuartos(id) on delete set null,
  estado       public.estado_aseo not null default 'pendiente',
  enviado_por  uuid references public.profiles(id) on delete set null,
  enviado_at   timestamptz not null default now(),
  listo_at     timestamptz
);
create index if not exists aseo_tenant_idx on public.aseo (tenant_id, estado);


-- #############################################################################
-- 8. TABLAS — HUÉSPEDES Y ESTADÍAS
-- #############################################################################

-- GUESTS del prototipo.
create table if not exists public.huespedes (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  nombre         text not null,
  tipo_doc       text not null default 'DNI',
  num_doc        text not null,
  telefono       text,
  email          text,
  nacionalidad   text,
  notas          text,
  -- "nunca lista negra": el prototipo exige lenguaje seguro + validación humana
  requiere_revision boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint huespedes_doc_unico unique (tenant_id, tipo_doc, num_doc)
);
comment on column public.huespedes.requiere_revision is
  'Marca neutra. Nunca "lista negra": requiere evidencia y validación humana (context.md).';
create index if not exists huespedes_tenant_idx on public.huespedes (tenant_id);
create index if not exists huespedes_doc_idx on public.huespedes (tenant_id, num_doc);

-- Check-in de 4 pasos del prototipo.
create table if not exists public.estadias (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  huesped_id      uuid not null references public.huespedes(id) on delete restrict,
  cuarto_id       uuid not null references public.cuartos(id) on delete restrict,
  modo            public.modo_estadia not null,
  horas           int,
  noches          int,
  fecha_entrada   date not null,
  fecha_salida    date,
  hora_entrada    timestamptz not null default now(),
  hora_salida     timestamptz,
  personas        int not null default 1 check (personas between 1 and 12),
  -- Precio calculado en el SERVIDOR desde el tarifario. Nunca lo manda el cliente.
  tarifa_total    numeric(10,2) not null default 0,
  deposito        numeric(10,2) not null default 0,
  tarifa_detalle  jsonb not null default '{}'::jsonb,
  estado          public.estado_estadia not null default 'activa',
  turno_id        uuid,
  creado_por      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint estadias_modo_coherente check (
    (modo = 'horas' and horas is not null and horas > 0) or
    (modo in ('dia','rango') and noches is not null and noches > 0)
  )
);
create index if not exists estadias_tenant_idx  on public.estadias (tenant_id, estado);
create index if not exists estadias_cuarto_idx  on public.estadias (tenant_id, cuarto_id);
create index if not exists estadias_huesped_idx on public.estadias (tenant_id, huesped_id);

-- ciAcomp del prototipo (acompañantes del check-in).
create table if not exists public.acompanantes (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  estadia_id  uuid not null references public.estadias(id) on delete cascade,
  nombre      text not null,
  tipo_doc    text default 'DNI',
  num_doc     text,
  created_at  timestamptz not null default now()
);
create index if not exists acompanantes_estadia_idx on public.acompanantes (estadia_id);

-- Vista Reservas (hoy empty state en el prototipo).
create table if not exists public.reservas (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  huesped_id     uuid references public.huespedes(id) on delete set null,
  nombre_contacto text,
  telefono       text,
  tipo_id        uuid references public.tipos_cuarto(id) on delete set null,
  cuarto_id      uuid references public.cuartos(id) on delete set null,
  fecha_entrada  date not null,
  fecha_salida   date,
  personas       int not null default 1,
  estado         public.estado_reserva not null default 'pendiente',
  origen         text default 'directo',
  notas          text,
  estadia_id     uuid references public.estadias(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists reservas_tenant_idx on public.reservas (tenant_id, fecha_entrada);

-- INSP del prototipo: checklist post check-out.
create table if not exists public.inspecciones (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  cuarto_id    uuid not null references public.cuartos(id) on delete cascade,
  estadia_id   uuid references public.estadias(id) on delete set null,
  resultado    jsonb not null default '[]'::jsonb,  -- [{item, esperado, confirmado, nota}]
  nota         text,
  foto_key     text,                                 -- objeto en R2 (bucket privado)
  actor_id     uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists inspecciones_tenant_idx on public.inspecciones (tenant_id, created_at desc);


-- #############################################################################
-- 9. TABLAS — TURNO Y CAJA
-- #############################################################################

-- CAJA_ESTADO del prototipo: una fila por hostal.
create table if not exists public.caja_estado (
  tenant_id   uuid primary key references public.tenants(id) on delete cascade,
  sencillo    numeric(10,2) not null default 0,   -- lo que deja un turno para el siguiente
  caja_chica  numeric(10,2) not null default 0,   -- acumulado
  updated_at  timestamptz not null default now()
);
comment on column public.caja_estado.sencillo is 'Efectivo de apertura del próximo turno. Lo fija el cierre anterior.';

-- TURNO del prototipo.
create table if not exists public.turnos (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  usuario_id          uuid not null references public.profiles(id) on delete restrict,
  estado              public.estado_turno not null default 'abierto',
  abierto_at          timestamptz not null default now(),
  cerrado_at          timestamptz,
  sencillo_esperado   numeric(10,2) not null default 0,
  sencillo_apertura   numeric(10,2) not null default 0,   -- efectivo contado al abrir
  sencillo_dejado     numeric(10,2),                      -- efectivo dejado al cerrar
  apertura_inventario jsonb not null default '{}'::jsonb, -- snapshot {producto_id: stock}
  cerrado_por         uuid references public.profiles(id) on delete set null,
  forzado             boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists turnos_tenant_idx on public.turnos (tenant_id, estado, abierto_at desc);

-- Un solo turno abierto por hostal a la vez.
create unique index if not exists turnos_uno_abierto_por_tenant
  on public.turnos (tenant_id) where estado = 'abierto';

-- Conteo de cierre: esperado vs contado, producto por producto.
create table if not exists public.turno_conteos (
  id             bigserial primary key,
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  turno_id       uuid not null references public.turnos(id) on delete cascade,
  producto_id    uuid not null references public.productos(id) on delete restrict,
  apertura       numeric(12,2) not null,
  esperado       numeric(12,2) not null,
  contado        numeric(12,2) not null,
  justificacion  text,
  created_at     timestamptz not null default now(),
  constraint turno_conteos_unico unique (turno_id, producto_id)
);

-- INCIDENCIAS del prototipo.
create table if not exists public.incidencias (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  turno_id       uuid references public.turnos(id) on delete set null,
  producto_id    uuid references public.productos(id) on delete set null,
  concepto       text not null,
  unidad         text not null default 'unid.',
  esperado       numeric(12,2) not null,
  contado        numeric(12,2) not null,
  diferencia     numeric(12,2) not null,      -- >0 faltante · <0 sobrante
  justificacion  text not null,
  estado         public.estado_incidencia not null default 'abierta',
  registrado_por uuid references public.profiles(id) on delete set null,
  revisado_por   uuid references public.profiles(id) on delete set null,
  revisado_at    timestamptz,
  created_at     timestamptz not null default now()
);
comment on table public.incidencias is
  'Descuadres con justificación obligatoria. Requieren validación humana. Nunca acusan a una persona.';
create index if not exists incidencias_tenant_idx on public.incidencias (tenant_id, estado, created_at desc);

-- VENTAS_LOG del prototipo. El descuento de stock ocurre en la misma transacción.
create table if not exists public.ventas (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  turno_id     uuid references public.turnos(id) on delete set null,
  concepto     text not null,
  producto_id  uuid references public.productos(id) on delete set null,
  cantidad     numeric(12,2),
  cuarto_id    uuid references public.cuartos(id) on delete set null,
  estadia_id   uuid references public.estadias(id) on delete set null,
  monto        numeric(10,2) not null check (monto >= 0),
  medio        public.medio_pago not null,
  banco        text references public.bancos(clave) on delete set null,
  -- Multimoneda: se registra el original y se consolida en S/
  moneda_orig  char(3),
  monto_orig   numeric(10,2),
  tipo_cambio  numeric(10,4),
  actor_id     uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists ventas_tenant_idx on public.ventas (tenant_id, created_at desc);
create index if not exists ventas_turno_idx  on public.ventas (turno_id);

-- CAJA_HISTORIAL del prototipo.
create table if not exists public.cierres_caja (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  turno_id          uuid not null references public.turnos(id) on delete cascade,
  usuario_id        uuid references public.profiles(id) on delete set null,
  recaudado         numeric(10,2) not null default 0,
  por_medio         jsonb not null default '{}'::jsonb,
  por_banco         jsonb not null default '{}'::jsonb,
  efectivo_en_caja  numeric(10,2) not null default 0,
  sencillo_dejado   numeric(10,2) not null default 0,
  a_caja_chica      numeric(10,2) not null default 0,
  ajuste_monto      numeric(10,2),
  ajuste_razon      text,
  incidencias_count int not null default 0,
  resumen_enviado   boolean not null default false,
  created_at        timestamptz not null default now(),
  constraint cierres_caja_turno_unico unique (turno_id)
);
create index if not exists cierres_caja_tenant_idx on public.cierres_caja (tenant_id, created_at desc);

-- FX del prototipo.
create table if not exists public.tipo_cambio (
  id         bigserial primary key,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  moneda     char(3) not null,
  valor      numeric(10,4) not null check (valor > 0),
  vigente_desde timestamptz not null default now(),
  fijado_por uuid references public.profiles(id) on delete set null,
  constraint tipo_cambio_unico unique (tenant_id, moneda, vigente_desde)
);


-- #############################################################################
-- 10. TABLAS — ALERTAS, INTEGRACIONES, MEDIOS, AUDITORÍA
-- #############################################################################

-- ALERTAS_ADMIN + vista de alertas e incidentes.
create table if not exists public.alertas (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  severidad     public.severidad_alerta not null default 'info',
  titulo        text not null,
  detalle       text,
  origen        text,                    -- 'turno' | 'camara' | 'sensor' | 'ia' | 'sistema'
  cuarto_id     uuid references public.cuartos(id) on delete set null,
  turno_id      uuid references public.turnos(id) on delete set null,
  -- La IA propone; un humano valida. Nunca se auto-resuelve nada sensible.
  generado_por_ia boolean not null default false,
  requiere_validacion boolean not null default false,
  atendida      boolean not null default false,
  atendida_por  uuid references public.profiles(id) on delete set null,
  atendida_at   timestamptz,
  solo_admin    boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists alertas_tenant_idx on public.alertas (tenant_id, atendida, created_at desc);

-- INTEGR del prototipo (base vs premium).
create table if not exists public.integraciones (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  clave       text not null,
  nombre      text not null,
  icono       text not null default 'plug',
  descripcion text,
  premium     boolean not null default false,
  activa      boolean not null default false,
  config      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint integraciones_unico unique (tenant_id, clave)
);

-- Archivos en Cloudflare R2. La tabla guarda la LLAVE, nunca una URL pública:
-- el bucket es privado y se sirve con URL firmada (ADR-001 §4).
create table if not exists public.medios (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  bucket       text not null default 'hostal-privado',
  object_key   text not null,
  mime         text,
  bytes        bigint,
  tipo         text not null,   -- 'dni' | 'rostro' | 'inspeccion' | 'incidente' | 'clip'
  huesped_id   uuid references public.huespedes(id) on delete cascade,
  estadia_id   uuid references public.estadias(id) on delete cascade,
  -- Ley 29733: retención y borrado
  retener_hasta timestamptz,
  subido_por   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint medios_key_unico unique (bucket, object_key)
);
comment on table public.medios is
  'Bucket privado + URL firmada. Jamás guardar URLs públicas. Retención según Ley 29733.';
create index if not exists medios_tenant_idx on public.medios (tenant_id, tipo);

-- Consentimiento informado para datos sensibles (rostro/DNI).
create table if not exists public.consentimientos (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  huesped_id   uuid not null references public.huespedes(id) on delete cascade,
  finalidad    text not null,
  otorgado     boolean not null default false,
  otorgado_at  timestamptz,
  revocado_at  timestamptz,
  evidencia    text,
  created_at   timestamptz not null default now()
);

-- Auditoría transversal. Obligatoria por el gate de seguridad.
create table if not exists public.audit_log (
  id          bigserial primary key,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  tabla       text not null,
  operacion   text not null,
  registro_id text,
  actor_id    uuid,
  datos_antes jsonb,
  datos_despues jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_tenant_idx on public.audit_log (tenant_id, created_at desc);
create index if not exists audit_log_tabla_idx  on public.audit_log (tenant_id, tabla, created_at desc);

-- FK diferidas (turnos y estadias ya existen a esta altura).
do $$ begin
  alter table public.movimientos_inventario
    add constraint mov_inv_turno_fk foreign key (turno_id) references public.turnos(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.movimientos_inventario
    add constraint mov_inv_estadia_fk foreign key (estadia_id) references public.estadias(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.estadias
    add constraint estadias_turno_fk foreign key (turno_id) references public.turnos(id) on delete set null;
exception when duplicate_object then null; end $$;


-- #############################################################################
-- 11. TRIGGERS updated_at
-- #############################################################################

do $$
declare t text;
begin
  foreach t in array array[
    'tenants','profiles','tipos_cuarto','cuartos','productos','huespedes',
    'estadias','reservas','integraciones'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t);
  end loop;
end $$;


-- #############################################################################
-- 12. HELPERS DE RLS — el corazón del aislamiento
--
-- Van aquí, después de las tablas, porque consultan `profiles` y Postgres
-- valida el cuerpo de las funciones `language sql` en el momento de crearlas.
--
-- SECURITY DEFINER a propósito: el owner (postgres) no está sujeto a las
-- policies, así que consultar `profiles` aquí NO provoca recursión infinita
-- cuando la propia policy de profiles llama a current_tenant_id().
-- CONSECUENCIA: nunca aplicar `force row level security` sobre profiles.
-- #############################################################################

create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public, auth as $fn$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id',''),
    (select p.tenant_id::text from public.profiles p where p.id = auth.uid())
  )::uuid
$fn$;

create or replace function public.current_rol()
returns public.rol_usuario language sql stable security definer set search_path = public, auth as $fn$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'rol',''),
    (select p.rol::text from public.profiles p where p.id = auth.uid())
  )::public.rol_usuario
$fn$;

create or replace function public.is_admin()
returns boolean language sql stable as $fn$
  select public.current_rol() = 'administrador'
$fn$;

create or replace function public.rol_en(roles public.rol_usuario[])
returns boolean language sql stable as $fn$
  select public.current_rol() = any(roles)
$fn$;

revoke execute on function public.current_tenant_id() from anon;
revoke execute on function public.current_rol() from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.rol_en(public.rol_usuario[]) from anon;

-- Conjuntos de roles según ROLE_NAV del prototipo.
create or replace function public.r_admin() returns public.rol_usuario[]
  language sql immutable as $fn$ select array['administrador']::public.rol_usuario[] $fn$;

create or replace function public.r_caja() returns public.rol_usuario[]
  language sql immutable as $fn$ select array['administrador','recepcion']::public.rol_usuario[] $fn$;

create or replace function public.r_recepcion() returns public.rol_usuario[]
  language sql immutable as $fn$ select array['administrador','recepcion']::public.rol_usuario[] $fn$;


-- #############################################################################
-- 13. APLICADOR DE RLS
--
-- Genera el juego completo de policies + grants para una tabla con tenant_id.
-- Los GRANT van aquí a propósito: el proyecto se creó con "Automatically expose
-- new tables" DESACTIVADO, así que sin grant explícito la tabla queda
-- inaccesible (error de permisos antes de siquiera evaluar RLS).
-- #############################################################################

create or replace function public.aplicar_rls(
  tabla     text,
  lectura   public.rol_usuario[] default null,
  escritura public.rol_usuario[] default null
) returns void language plpgsql as $fn$
declare
  cond_r text;
  cond_w text;
begin
  execute format('alter table public.%I enable row level security', tabla);

  cond_r := 'tenant_id = public.current_tenant_id()';
  if lectura is not null then
    cond_r := cond_r || format(' and public.rol_en(%L::public.rol_usuario[])', lectura);
  end if;

  cond_w := 'tenant_id = public.current_tenant_id()';
  if escritura is not null then
    cond_w := cond_w || format(' and public.rol_en(%L::public.rol_usuario[])', escritura);
  end if;

  execute format('drop policy if exists %I on public.%I', tabla || '_sel', tabla);
  execute format('create policy %I on public.%I for select to authenticated using (%s)',
                 tabla || '_sel', tabla, cond_r);

  execute format('drop policy if exists %I on public.%I', tabla || '_ins', tabla);
  execute format('create policy %I on public.%I for insert to authenticated with check (%s)',
                 tabla || '_ins', tabla, cond_w);

  -- El WITH CHECK no es opcional: sin él un usuario puede MOVER una fila suya
  -- al tenant de otro hostal con un simple UPDATE.
  execute format('drop policy if exists %I on public.%I', tabla || '_upd', tabla);
  execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
                 tabla || '_upd', tabla, cond_w, cond_w);

  execute format('drop policy if exists %I on public.%I', tabla || '_del', tabla);
  execute format('create policy %I on public.%I for delete to authenticated using (%s)',
                 tabla || '_del', tabla, cond_w);

  execute format('revoke all on public.%I from anon', tabla);
  execute format('grant select, insert, update, delete on public.%I to authenticated', tabla);
  -- service_role tiene BYPASSRLS, pero sin GRANT la tabla le queda inaccesible igual.
  -- Sin esto, los scripts de servidor (alta de tenants y de personal) no pueden correr.
  execute format('grant all privileges on public.%I to service_role', tabla);
end $fn$;

revoke all on function public.aplicar_rls(text, public.rol_usuario[], public.rol_usuario[]) from public;


-- #############################################################################
-- 14. RLS — GATE #1 DE CLAUDE.md
--
-- Matriz de roles tomada de ROLE_NAV del prototipo:
--   administrador -> todo
--   recepcion     -> todo salvo el CRUD de administración
--   limpieza      -> cuartos, inventario, aseo
--   mantenimiento -> cuartos, inventario, alertas, aseo
-- #############################################################################

alter table public.tenants  enable row level security;
alter table public.profiles enable row level security;

drop policy if exists tenants_sel on public.tenants;
create policy tenants_sel on public.tenants
  for select to authenticated using (id = public.current_tenant_id());

drop policy if exists tenants_upd on public.tenants;
create policy tenants_upd on public.tenants
  for update to authenticated
  using      (id = public.current_tenant_id() and public.is_admin())
  with check (id = public.current_tenant_id());

-- Alta de tenants: solo desde el servidor con service_role, al contratar licencia.
-- La ausencia de policy de INSERT/DELETE es intencional.

drop policy if exists profiles_sel on public.profiles;
create policy profiles_sel on public.profiles
  for select to authenticated using (tenant_id = public.current_tenant_id());

drop policy if exists profiles_ins on public.profiles;
create policy profiles_ins on public.profiles
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_admin());

-- Cada quien edita su propio perfil; el admin edita a todo su hostal.
-- El WITH CHECK impide mudarse de tenant o auto-ascenderse de rol.
drop policy if exists profiles_upd on public.profiles;
create policy profiles_upd on public.profiles
  for update to authenticated
  using (tenant_id = public.current_tenant_id() and (id = auth.uid() or public.is_admin()))
  with check (tenant_id = public.current_tenant_id()
              and (public.is_admin() or rol = public.current_rol()));

drop policy if exists profiles_del on public.profiles;
create policy profiles_del on public.profiles
  for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());

revoke all on public.tenants  from anon;
revoke all on public.profiles from anon;
grant select, update                 on public.tenants  to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
-- El alta de tenants y de personal ocurre aquí, desde el servidor (ver §14).
grant all privileges on public.tenants  to service_role;
grant all privileges on public.profiles to service_role;

-- Catálogos globales: lectura para cualquier autenticado.
alter table public.caracteristicas enable row level security;
alter table public.bancos          enable row level security;

drop policy if exists caracteristicas_sel on public.caracteristicas;
create policy caracteristicas_sel on public.caracteristicas
  for select to authenticated using (true);

drop policy if exists bancos_sel on public.bancos;
create policy bancos_sel on public.bancos
  for select to authenticated using (true);

revoke all on public.caracteristicas from anon;
revoke all on public.bancos          from anon;
grant select on public.caracteristicas to authenticated;
grant select on public.bancos          to authenticated;

-- Tablas con tenant_id.
select public.aplicar_rls('cuartos');
select public.aplicar_rls('cuarto_estado_log');
select public.aplicar_rls('productos');
select public.aplicar_rls('movimientos_inventario');
select public.aplicar_rls('aseo');
select public.aplicar_rls('alertas');
select public.aplicar_rls('inspecciones');

-- Tarifario: todos lo leen (se necesita para cotizar), solo admin lo cambia.
select public.aplicar_rls('tipos_cuarto', null, public.r_admin());

-- Huéspedes, estadías y reservas: administrador y recepción.
select public.aplicar_rls('huespedes',    public.r_recepcion(), public.r_recepcion());
select public.aplicar_rls('estadias',     public.r_recepcion(), public.r_recepcion());
select public.aplicar_rls('acompanantes', public.r_recepcion(), public.r_recepcion());
select public.aplicar_rls('reservas',     public.r_recepcion(), public.r_recepcion());

-- Caja y turno: administrador y recepción. Limpieza NO ve el dinero.
select public.aplicar_rls('turnos',        public.r_caja(), public.r_caja());
select public.aplicar_rls('turno_conteos', public.r_caja(), public.r_caja());
select public.aplicar_rls('ventas',        public.r_caja(), public.r_caja());
select public.aplicar_rls('cierres_caja',  public.r_caja(), public.r_admin());
select public.aplicar_rls('caja_estado',   public.r_caja(), public.r_admin());
select public.aplicar_rls('tipo_cambio',   null,            public.r_admin());

-- Incidencias: todos las ven (transparencia), solo admin/recepción las cierran.
select public.aplicar_rls('incidencias', null, public.r_caja());

-- Integraciones: lectura general, cambios solo admin.
select public.aplicar_rls('integraciones', null, public.r_admin());

-- Datos sensibles: administrador y recepción.
select public.aplicar_rls('medios',          public.r_recepcion(), public.r_recepcion());
select public.aplicar_rls('consentimientos', public.r_recepcion(), public.r_recepcion());

-- Auditoría: solo el administrador la lee. NADIE la escribe desde el cliente
-- (la escriben los triggers, que corren como definer).
alter table public.audit_log enable row level security;
drop policy if exists audit_log_sel on public.audit_log;
create policy audit_log_sel on public.audit_log
  for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_admin());
revoke all on public.audit_log from anon;
grant select on public.audit_log to authenticated;


-- #############################################################################
-- 15. VERIFICACIÓN — que no quede ninguna tabla sin RLS
-- #############################################################################

do $$
declare faltantes text;
begin
  select string_agg(c.relname, ', ')
    into faltantes
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not c.relrowsecurity;

  if faltantes is not null then
    raise exception 'GATE #1 VIOLADO · tablas sin RLS: %', faltantes;
  end if;

  raise notice 'OK · 01_schema.sql aplicado · RLS activo en todas las tablas de public';
end $$;
