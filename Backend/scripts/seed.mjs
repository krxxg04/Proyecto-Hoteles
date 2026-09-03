/**
 * Carga en un hostal los datos que el prototipo tenía en memoria.
 *
 * `backend.md` lo pide literal: "migra los datos que hoy están en memoria en
 * hostal-atlas.html (ROOMS/INV/GUESTS/STAFF/TURNO/INCIDENCIAS)". Antes este script
 * inventaba habitaciones y productos parecidos; ahora son los del prototipo, con
 * sus nombres, sus estados, sus notas y su tarifario.
 *
 * De dónde sale cada cosa (`index.html`):
 *   TARIFA_DEF + ROOM_TIPOS -> tipos_cuarto        ROOMS   -> cuartos
 *   INV                     -> productos           GUESTS  -> huespedes
 *   STAFF                   -> profiles (auth)     VENTAS_LOG -> ventas + kardex
 *   CAJA_ESTADO             -> caja_estado
 *   TURNO e INCIDENCIAS empiezan vacíos en el prototipo: aquí también.
 *
 * Corre DESPUÉS de bootstrap.mjs. Es idempotente: se puede repetir sin duplicar nada.
 * Solo para desarrollo — usa `service_role`, así que nunca desde el navegador.
 *
 * Uso:
 *   node --env-file=.env.local scripts/seed.mjs --slug aurora
 *   node --env-file=.env.local scripts/seed.mjs --slug aurora --limpiar
 *   node --env-file=.env.demo  scripts/seed.mjs --slug demo --rica
 *
 * `--rica` añade el histórico grande de `datos-demo.mjs`: 14 días de ventas y consumo,
 * estadías cerradas, reservas, turnos cerrados con sus gastos y las alertas que dejan.
 * Sin la bandera, esto sigue siendo exactamente el prototipo — que es lo que hace útil
 * el contraste contra `index.html` en desarrollo.
 */

import { createClient } from '@supabase/supabase-js';

import {
  CAJA_RICA,
  COSTO_REFERENCIA,
  HUESPEDES_EXTRA,
  construirEntregas,
  construirEstadiasCerradas,
  construirReservas,
  construirTurnos,
  construirVentas,
} from './datos-demo.mjs';

// --------------------------------------------------------------- argumentos

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const clave = argv[i].slice(2);
  const valor = argv[i + 1];
  if (!valor || valor.startsWith('--')) {
    args[clave] = true;
  } else {
    args[clave] = valor;
    i++;
  }
}

if (!args.slug) {
  console.error('\nFalta --slug (el del hostal que creaste con bootstrap.mjs).\n');
  console.error('  node --env-file=.env.local scripts/seed.mjs --slug aurora\n');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !clave) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Corre con: node --env-file=.env.local scripts/seed.mjs ...');
  process.exit(1);
}

const admin = createClient(url, clave, {
  auth: { autoRefreshToken: false, persistSession: false },
  // Estos datos no los escribe una persona ni el asistente. Ver `shared/origen.ts`.
  global: { headers: { 'x-origen': 'sistema' } },
});

/** Con `--rica`, el histórico grande de la demo. Sin ella, solo el prototipo. */
const rica = !!args.rica;

// ------------------------------------------------------------ datos del mockup

/**
 * TARIFA_DEF + ROOM_TIPOS. Tarifario real del prototipo (Asturias ATE), en S/:
 * bloque de horas + amanecida hasta las 12, con diferencia lunes-jueves / viernes-domingo.
 *
 * `hora_extra` y `deposito` van en 0 a propósito: el prototipo no tiene esos conceptos.
 * Los configura el administrador desde "Cuartos y tarifas".
 */
const TIPOS = [
  { nombre: 'Estándar',           aforo: 2, costo: 40, horas_lj: 6, horas_vd: 4, hora_extra: 0, amanecida: 90,  amanecida_vd: 90,  deposito: 0 },
  { nombre: 'Matrimonial',        aforo: 2, costo: 50, horas_lj: 6, horas_vd: 4, hora_extra: 0, amanecida: 100, amanecida_vd: 100, deposito: 0 },
  { nombre: 'Ejecutiva',          aforo: 3, costo: 60, horas_lj: 6, horas_vd: 4, hora_extra: 0, amanecida: 110, amanecida_vd: 110, deposito: 0 },
  { nombre: 'Ejecutiva con Aire', aforo: 3, costo: 70, horas_lj: 6, horas_vd: 4, hora_extra: 0, amanecida: 120, amanecida_vd: 120, deposito: 0 },
  { nombre: 'Jacuzzi',            aforo: 2, costo: 99, horas_lj: 3, horas_vd: 3, hora_extra: 0, amanecida: 199, amanecida_vd: 219, deposito: 0 },
];

/** ROOMS. Los estados del prototipo iban capitalizados; el esquema los usa en minúscula. */
const CUARTOS = [
  { numero: '101', tipo: 'Estándar',           estado: 'lista',      nota: 'Lista para check-in 15:00', aforo: 2, caracteristicas: ['tv', 'wifi', 'agua_caliente'] },
  { numero: '102', tipo: 'Matrimonial',        estado: 'ocupada',    nota: 'Carlos M. · sale mañana',   aforo: 2, caracteristicas: ['tv', 'wifi', 'agua_caliente'] },
  { numero: '103', tipo: 'Estándar',           estado: 'libre',      nota: 'Disponible',                aforo: 2, caracteristicas: ['wifi', 'agua_caliente'] },
  { numero: '105', tipo: 'Ejecutiva',          estado: 'inspeccion', nota: 'Check-out sin verificar',   aforo: 3, caracteristicas: ['tv', 'wifi', 'calle'] },
  { numero: '201', tipo: 'Ejecutiva con Aire', estado: 'ocupada',    nota: 'Familia Ríos · 3 noches',   aforo: 3, caracteristicas: ['tv', 'wifi', 'agua_caliente', 'aire', 'balcon'] },
  { numero: '203', tipo: 'Estándar',           estado: 'limpieza',   nota: 'Marta · limpieza en curso', aforo: 2, caracteristicas: ['tv', 'wifi'] },
  { numero: '204', tipo: 'Jacuzzi',            estado: 'checkout',   nota: 'Renovación pendiente',      aforo: 2, caracteristicas: ['tv', 'wifi', 'jacuzzi', 'agua_caliente', 'aire', 'calle'] },
  { numero: '205', tipo: 'Matrimonial',        estado: 'lista',      nota: 'Lista para check-in',       aforo: 2, caracteristicas: ['tv', 'wifi', 'agua_caliente'] },
  { numero: '301', tipo: 'Ejecutiva',          estado: 'ocupada',    nota: 'Andrés V. · 2 noches',      aforo: 3, caracteristicas: ['tv', 'wifi', 'calle'] },
];

/**
 * INV. `stock` no se escribe a mano: la columna nace en 0 y solo se mueve con
 * movimientos registrados, para que el kardex cuadre desde el primer día.
 * `stock_actual` es el número que el prototipo mostraba (`qty`).
 */
/**
 * `stock_min` es el aviso de reposición: con menos que eso ya no da tiempo a comprar.
 *
 * Se elige contra el consumo, no contra el máximo. El kit de aseo se gasta ~2 cada 14 días:
 * pedirle un mínimo de 20 sería exigir stock para 140 días, y la alerta saltaría mientras la
 * propia tarjeta dice que da para tres meses. El papel va a 30 a propósito: es el que el
 * prototipo mostraba corto y el que tiene que avisar.
 */
const PRODUCTOS = [
  { nombre: 'Papel higiénico', icono: 'scroll-text', unidad: 'rollos', stock_actual: 22, stock_max: 120, stock_min: 30, categoria: 'insumo',   clase: 'descartable',    precio: 0 },
  { nombre: 'Toallas',         icono: 'shirt',       unidad: 'unid.',  stock_actual: 38, stock_max: 80, stock_min: 20,  categoria: 'insumo',   clase: 'no_descartable', precio: 0 },
  { nombre: 'Sábanas',         icono: 'bed',         unidad: 'juegos', stock_actual: 44, stock_max: 60, stock_min: 15,  categoria: 'insumo',   clase: 'no_descartable', precio: 0 },
  { nombre: 'Almohadas',       icono: 'cloud',       unidad: 'unid.',  stock_actual: 31, stock_max: 50, stock_min: 12,  categoria: 'insumo',   clase: 'no_descartable', precio: 0 },
  { nombre: 'Kit de aseo',     icono: 'sparkles',    unidad: 'kits',   stock_actual: 15, stock_max: 60, stock_min: 8,   categoria: 'vendible', clase: 'descartable',    precio: 8 },
  { nombre: 'Jabón',           icono: 'droplet',     unidad: 'unid.',  stock_actual: 52, stock_max: 80, stock_min: 20,  categoria: 'insumo',   clase: 'descartable',    precio: 0 },
  { nombre: 'Agua 500 ml',     icono: 'cup-soda',    unidad: 'unid.',  stock_actual: 40, stock_max: 60, stock_min: 15,  categoria: 'vendible', clase: 'descartable',    precio: 2 },
  { nombre: 'Gaseosa',         icono: 'cup-soda',    unidad: 'unid.',  stock_actual: 24, stock_max: 48, stock_min: 12,  categoria: 'vendible', clase: 'descartable',    precio: 4 },
];

/**
 * GUESTS. El prototipo mostraba documentos colombianos ("CC 71.234.567") porque venía
 * de otra plaza. Aquí se guardan como DNI peruano (solo dígitos) y pasaporte, que es
 * lo que el esquema y el mercado esperan. Los números son los mismos.
 */
const HUESPEDES = [
  { nombre: 'Carlos Mendoza', tipo_doc: 'DNI',       num_doc: '71234567', nacionalidad: 'Peruana', requiere_revision: false, notas: 'Huésped frecuente.' },
  { nombre: 'Familia Ríos',   tipo_doc: 'DNI',       num_doc: '43110982', nacionalidad: 'Peruana', requiere_revision: false, notas: null },
  { nombre: 'Laura Gómez',    tipo_doc: 'DNI',       num_doc: '01020334', nacionalidad: 'Peruana', requiere_revision: true,  notas: 'Marcada para revisión en el prototipo. Requiere evidencia y validación humana.' },
  { nombre: 'Andrés Villa',   tipo_doc: 'Pasaporte', num_doc: 'AP-88231', nacionalidad: 'Chilena', requiere_revision: false, notas: null },
];

/**
 * Estadías de las tres habitaciones que el prototipo marcaba como ocupadas.
 * El mockup solo dejaba la nota ("Familia Ríos · 3 noches"); sin estadía real, un
 * cuarto "ocupada" no cuadra con nada y el check-out no tendría de dónde agarrarse.
 */
const ESTADIAS = [
  { cuarto: '102', huesped: '71234567', noches: 1, personas: 1 },
  { cuarto: '201', huesped: '43110982', noches: 3, personas: 3 },
  { cuarto: '301', huesped: 'AP-88231', noches: 2, personas: 2 },
];

/** STAFF. Los PIN del prototipo son de 4 dígitos y Supabase exige 6: se rellenan con `00`. */
const PERSONAL = [
  { dni: '40123456', nombre: 'Ana Torres',  rol: 'administrador', telefono: '+51 987 654 321', pin: '123400' },
  { dni: '41567890', nombre: 'Luis Quispe', rol: 'recepcion',     telefono: '+51 998 333 444', pin: '112200' },
  { dni: '42876543', nombre: 'Marta Ríos',  rol: 'limpieza',      telefono: '+51 976 111 222', pin: '258000' },
];

/** VENTAS_LOG: el histórico que el prototipo sembraba para que el panel tuviera qué mostrar. */
const VENTAS = [
  { producto: 'Agua 500 ml', cantidad: 2, monto: 4, medio: 'efectivo', cuarto: '101', dia: 'ayer' },
  { producto: 'Gaseosa',     cantidad: 1, monto: 4, medio: 'yape',     cuarto: '201', dia: 'ayer' },
  { producto: 'Kit de aseo', cantidad: 1, monto: 8, medio: 'efectivo', cuarto: '204', dia: 'ayer' },
  { producto: 'Agua 500 ml', cantidad: 3, monto: 6, medio: 'efectivo', cuarto: '204', dia: 'ayer' },
  { producto: 'Gaseosa',     cantidad: 2, monto: 8, medio: 'plin',     cuarto: '101', dia: 'hoy' },
  { producto: 'Agua 500 ml', cantidad: 1, monto: 2, medio: 'efectivo', cuarto: '301', dia: 'hoy' },
  { producto: 'Kit de aseo', cantidad: 1, monto: 8, medio: 'tarjeta',  cuarto: '201', dia: 'hoy' },
  { producto: 'Agua 500 ml', cantidad: 2, monto: 4, medio: 'efectivo', cuarto: '201', dia: 'hoy' },
  { producto: 'Gaseosa',     cantidad: 1, monto: 4, medio: 'efectivo', cuarto: '204', dia: 'hoy' },
];

/** CAJA_ESTADO del prototipo. */
/** Una sola caja (migración 12). El prototipo dejaba S/ 100 de sencillo; ese es el saldo. */
const CAJA = { saldo: 100 };

// --------------------------------------------------------------------- pasos

const { data: tenant } = await admin
  .from('tenants')
  .select('id, nombre')
  .eq('slug', args.slug)
  .maybeSingle();

if (!tenant) {
  console.error(`\nNo existe ningún hostal con slug "${args.slug}".`);
  console.error('Créalo primero con scripts/bootstrap.mjs.\n');
  process.exit(1);
}

const tenantId = tenant.id;
console.log(`\nCargando los datos del prototipo en "${tenant.nombre}"...\n`);

function morir(paso, error) {
  console.error(`  ${paso}: ${error.message}`);
  process.exit(1);
}

/**
 * Borrar productos con un turno abierto deja el snapshot de apertura apuntando a ids
 * que ya no existen: el conteo de cierre sale descuadrado sin que nadie haya hecho nada
 * mal. Mejor negarse que dejar la caja mintiendo.
 */
if (args.limpiar) {
  const { data: turnoAbierto } = await admin
    .from('turnos')
    .select('id, abierto_at')
    .eq('tenant_id', tenantId)
    .eq('estado', 'abierto')
    .maybeSingle();

  if (turnoAbierto) {
    console.error('');
    console.error('  Hay un turno abierto desde ' + turnoAbierto.abierto_at.slice(0, 16).replace('T', ' ') + '.');
    console.error('  Ciérralo desde Caja antes de recargar los datos, o el conteo de cierre');
    console.error('  quedará descuadrado contra productos que ya no existen.');
    console.error('');
    process.exit(1);
  }

  console.log('  Borrando datos previos...');

  /**
   * Orden inverso a las dependencias, y COMPLETO.
   *
   * Faltaba `turno_conteos`, que apunta a `productos` con `on delete restrict`: el
   * borrado de productos fallaba y, como no se miraba el error, el script seguía como
   * si hubiera funcionado. El stock viejo se quedaba y nadie se enteraba.
   *
   * El historial de turnos también se va: sus conteos y sus incidencias hablan de
   * productos que están a punto de dejar de existir. Guardar el historial y borrar lo
   * que describe deja un registro que miente. Además la cabecera de este script ya dice
   * que TURNO e INCIDENCIAS arrancan vacíos, igual que en el prototipo.
   */
  const EN_ORDEN = [
    // `gastos` apunta a `turnos` Y a `productos`, las dos con `on delete restrict`: va
    // primero o el borrado de turnos revienta. Es el mismo tropiezo que `turno_conteos`.
    'gastos',
    'alertas',
    'turno_conteos',
    'cierres_caja',
    'incidencias',
    'ventas',
    'movimientos_inventario',
    'aseo',
    'inspecciones',
    'medios',
    'consentimientos',
    'acompanantes',
    'reservas',
    'estadias',
    'turnos',
    'cuartos',
    'tipos_cuarto',
    'productos',
    'huespedes',
  ];

  for (const tabla of EN_ORDEN) {
    const { error } = await admin.from(tabla).delete().eq('tenant_id', tenantId);

    // Un borrado que falla en silencio es peor que uno que revienta: el script sigue
    // y deja la base a medio camino, con datos viejos mezclados con nuevos.
    if (error) morir(`borrando ${tabla}`, error);
  }
}

// 1 · Tarifario -------------------------------------------------------------

const { data: tipos, error: eTipos } = await admin
  .from('tipos_cuarto')
  .upsert(TIPOS.map((t) => ({ ...t, tenant_id: tenantId })), { onConflict: 'tenant_id,nombre' })
  .select('id, nombre');

if (eTipos) morir('tarifario', eTipos);

const idDeTipo = Object.fromEntries(tipos.map((t) => [t.nombre, t.id]));
console.log(`  Tarifario: ${tipos.length} tipos, con el bloque de horas y la amanecida del prototipo.`);

// 2 · Habitaciones ----------------------------------------------------------

const { data: cuartos, error: eCuartos } = await admin
  .from('cuartos')
  .upsert(
    CUARTOS.map((c) => ({
      tenant_id: tenantId,
      numero: c.numero,
      tipo_id: idDeTipo[c.tipo],
      estado: c.estado,
      nota: c.nota,
      aforo: c.aforo,
      caracteristicas: c.caracteristicas,
    })),
    { onConflict: 'tenant_id,numero' }
  )
  .select('id, numero');

if (eCuartos) morir('habitaciones', eCuartos);

const idDeCuarto = Object.fromEntries(cuartos.map((c) => [c.numero, c.id]));
console.log(`  Habitaciones: ${cuartos.length}, con los estados y las notas del prototipo.`);

// 3 · Catálogo --------------------------------------------------------------

const { data: productos, error: eProductos } = await admin
  .from('productos')
  .upsert(
    PRODUCTOS.map(({ stock_actual, ...p }) => {
      void stock_actual; // el stock entra por movimientos, más abajo
      return {
        ...p,
        tenant_id: tenantId,
        // Sin costo de referencia la alarma de sobreprecio no puede saltar nunca.
        ...(rica ? { costo_referencia: COSTO_REFERENCIA[p.nombre] ?? 0 } : {}),
      };
    }),
    { onConflict: 'tenant_id,nombre' }
  )
  .select('id, nombre, stock');

if (eProductos) morir('catálogo', eProductos);

const idDeProducto = Object.fromEntries(productos.map((p) => [p.nombre, p.id]));
console.log(`  Catálogo: ${productos.length} productos.`);

// 4 · Huéspedes -------------------------------------------------------------

const LISTA_HUESPEDES = rica ? [...HUESPEDES, ...HUESPEDES_EXTRA] : HUESPEDES;

const { data: huespedes, error: eHuespedes } = await admin
  .from('huespedes')
  .upsert(
    LISTA_HUESPEDES.map((h) => ({ ...h, tenant_id: tenantId })),
    { onConflict: 'tenant_id,tipo_doc,num_doc' }
  )
  .select('id, num_doc');

if (eHuespedes) morir('huéspedes', eHuespedes);

const idDeHuesped = Object.fromEntries(huespedes.map((h) => [h.num_doc, h.id]));
console.log(`  Huéspedes: ${huespedes.length}.`);

// 5 · Stock y ventas --------------------------------------------------------

/**
 * El prototipo mostraba el stock ya consumido y, aparte, un histórico de ventas que no
 * lo afectaba. Aquí no puede ser: `esperado_cierre()` sale del kardex.
 *
 * Así que la compra inicial es `stock del prototipo + lo vendido`, y cada venta descuenta.
 * El resultado final es exactamente el número que mostraba el mockup, pero cuadrando.
 *
 * No se usa `registrar_venta()`: esa función saca el hostal de `current_tenant_id()`,
 * que lee el JWT, y un script con `service_role` no tiene sesión.
 */
const ahora = Date.now();
const CUANDO = {
  ayer: new Date(ahora - 26 * 3600 * 1000).toISOString(),
  hoy: new Date(ahora - 2 * 3600 * 1000).toISOString(),
};
// Con `--rica` la carga inicial se va más atrás que los 14 días de histórico: si entrara
// después de la primera venta, el kardex tendría stock negativo a mitad de la semana.
const APERTURA = new Date(ahora - (rica ? 16 : 3) * 24 * 3600 * 1000).toISOString();

const numerosCuarto = CUARTOS.map((c) => c.numero);

/** Ventas: las nueve del prototipo, o catorce días de movimiento. */
const LISTA_VENTAS = rica ? construirVentas({ numerosCuarto, ahora }) : VENTAS;
const cuandoVenta = (v) => v.ts ?? CUANDO[v.dia];

/** Insumos entregados a habitaciones. Solo en la demo: el prototipo no los tenía. */
const ENTREGAS = rica ? construirEntregas({ numerosCuarto, ahora }) : [];

/** Turnos cerrados con sus gastos. Sus compras también entran al kardex. */
const TURNOS_DEMO = rica ? construirTurnos({ ahora }) : [];
const GASTOS_FIJOS = TURNOS_DEMO.flatMap((t) =>
  t.gastos.filter((g) => g.categoria === 'fijo')
);

/**
 * Que la suma del kardex dé el stock final no basta: el saldo tiene que ser positivo en
 * CADA momento. La primera versión de este dataset vendía kits de aseo doce días antes de
 * comprarlos — la suma cuadraba y el recorrido no, que es un histórico imposible.
 *
 * Se comprueba antes de escribir nada, en orden cronológico y producto por producto.
 */
function comprobarRecorrido(inicialDe) {
  const movimientos = [
    ...PRODUCTOS.map((p) => ({ producto: p.nombre, delta: inicialDe(p), ts: APERTURA })),
    ...LISTA_VENTAS.map((v) => ({ producto: v.producto, delta: -v.cantidad, ts: cuandoVenta(v) })),
    ...ENTREGAS.map((e) => ({ producto: e.producto, delta: -e.cantidad, ts: e.ts })),
    ...TURNOS_DEMO.flatMap((t) =>
      t.gastos
        .filter((g) => g.categoria === 'fijo')
        .map((g) => ({ producto: g.producto, delta: g.cantidad, ts: t.cerrado_at }))
    ),
  ].sort((a, b) => a.ts.localeCompare(b.ts));

  const saldo = {};
  for (const m of movimientos) {
    saldo[m.producto] = (saldo[m.producto] ?? 0) + m.delta;
    if (saldo[m.producto] < 0) {
      morir(
        `recorrido del kardex de ${m.producto}`,
        new Error(
          `el saldo llega a ${saldo[m.producto]} el ${m.ts.slice(0, 10)}: se consume antes ` +
            'de comprar. Baja el consumo o adelanta la compra en datos-demo.mjs.'
        )
      );
    }
  }
}

const yaSembrado = productos.some((p) => Number(p.stock) > 0);

if (yaSembrado) {
  console.log('  Stock: los productos ya tenían movimientos, no se tocan.');
  console.log('    Para rehacerlo desde cero: --limpiar');
} else {
  const sumaDe = (filas, nombre) =>
    filas.filter((f) => f.producto === nombre).reduce((s, f) => s + f.cantidad, 0);

  /**
   * El stock final tiene que ser el del prototipo, y el kardex tiene que llegar solo a
   * ese número. Con `--rica` hay tres salidas y dos entradas en juego, así que la carga
   * inicial es lo que falta para que la cuenta cierre:
   *
   *   inicial = final + vendido + entregado − comprado_en_gastos
   *
   * Si sale negativa, el dataset está pidiendo comprar más de lo que se consume: se
   * revienta aquí con el nombre del producto en vez de dejar un kardex que no cuadra.
   */
  const inicialDe = (p) =>
    p.stock_actual +
    sumaDe(LISTA_VENTAS, p.nombre) +
    sumaDe(ENTREGAS, p.nombre) -
    sumaDe(GASTOS_FIJOS, p.nombre);

  for (const p of PRODUCTOS) {
    if (inicialDe(p) < 0) {
      morir(
        `carga inicial de ${p.nombre}`,
        new Error(
          `saldría ${inicialDe(p)}: los gastos compran más de lo que se consume. ` +
            'Sube el consumo en datos-demo.mjs o baja la cantidad del gasto.'
        )
      );
    }
  }

  comprobarRecorrido(inicialDe);

  const compras = PRODUCTOS.map((p) => ({
    tenant_id: tenantId,
    producto_id: idDeProducto[p.nombre],
    tipo: 'compra',
    cantidad: inicialDe(p),
    motivo: 'Carga inicial (datos del prototipo)',
    created_at: APERTURA,
  })).filter((m) => m.cantidad > 0);

  const { error: eCompras } = await admin.from('movimientos_inventario').insert(compras);
  if (eCompras) morir('stock inicial', eCompras);

  const salidas = LISTA_VENTAS.map((v) => ({
    tenant_id: tenantId,
    producto_id: idDeProducto[v.producto],
    tipo: 'venta',
    cantidad: -v.cantidad,
    cuarto_id: idDeCuarto[v.cuarto] ?? null,
    motivo: 'Venta (datos del prototipo)',
    created_at: cuandoVenta(v),
  }));

  const { error: eSalidas } = await admin.from('movimientos_inventario').insert(salidas);
  if (eSalidas) morir('movimientos de venta', eSalidas);

  if (ENTREGAS.length) {
    const { error } = await admin.from('movimientos_inventario').insert(
      ENTREGAS.map((e) => ({
        tenant_id: tenantId,
        producto_id: idDeProducto[e.producto],
        tipo: 'entrega',
        cantidad: -e.cantidad,
        cuarto_id: idDeCuarto[e.cuarto] ?? null,
        motivo: 'Entrega a habitación',
        created_at: e.ts,
      }))
    );
    if (error) morir('entregas a habitaciones', error);
  }

  const { error: eVentas } = await admin.from('ventas').insert(
    LISTA_VENTAS.map((v) => ({
      tenant_id: tenantId,
      concepto: v.producto,
      producto_id: idDeProducto[v.producto],
      cantidad: v.cantidad,
      cuarto_id: idDeCuarto[v.cuarto] ?? null,
      monto: v.monto,
      medio: v.medio,
      // `turno_id` va nulo: en el prototipo TURNO arranca en null y aquí también.
      created_at: cuandoVenta(v),
    }))
  );
  if (eVentas) morir('ventas', eVentas);

  for (const p of PRODUCTOS) {
    const { error } = await admin
      .from('productos')
      .update({ stock: p.stock_actual })
      .eq('id', idDeProducto[p.nombre]);
    if (error) morir(`stock de ${p.nombre}`, error);
  }

  console.log(
    `  Stock e histórico: ${compras.length} compras y ${LISTA_VENTAS.length} ventas` +
      (rica ? ` en 14 días, más ${ENTREGAS.length} entregas a habitaciones.` : ' del mockup.')
  );
  console.log('    (papel higiénico y kit de aseo quedan bajos, como en el prototipo)');
}

// 6 · Estadías de las habitaciones ocupadas ---------------------------------

const { data: estadiasHay } = await admin
  .from('estadias')
  .select('id')
  .eq('tenant_id', tenantId)
  .eq('estado', 'activa')
  .limit(1);

if (estadiasHay?.length) {
  console.log('  Estadías: ya había alguna activa, no se tocan.');
} else {
  const hoy = new Date();
  const filas = ESTADIAS.map((e) => {
    const cuarto = CUARTOS.find((c) => c.numero === e.cuarto);
    const tipo = TIPOS.find((t) => t.nombre === cuarto.tipo);
    const salida = new Date(hoy.getTime() + e.noches * 24 * 3600 * 1000);
    return {
      tenant_id: tenantId,
      huesped_id: idDeHuesped[e.huesped],
      cuarto_id: idDeCuarto[e.cuarto],
      modo: 'rango',
      noches: e.noches,
      fecha_entrada: hoy.toISOString().slice(0, 10),
      fecha_salida: salida.toISOString().slice(0, 10),
      personas: e.personas,
      tarifa_total: tipo.amanecida * e.noches,
      deposito: tipo.deposito,
      tarifa_detalle: {
        total: tipo.amanecida * e.noches,
        deposito: tipo.deposito,
        moneda: 'PEN',
        modo: 'rango',
        detalle: [{ concepto: `${e.noches} noche(s) · ${tipo.nombre}`, monto: tipo.amanecida * e.noches }],
      },
      estado: 'activa',
    };
  });

  const { error } = await admin.from('estadias').insert(filas);
  if (error) morir('estadías', error);
  console.log(`  Estadías: ${filas.length} activas, una por cada habitación ocupada.`);
}

// 7 · Caja ------------------------------------------------------------------

// Con `--rica`, el saldo es lo que dejó el último turno cerrado del paso 9.
const SALDO = rica ? CAJA_RICA : CAJA;

const { error: eCaja } = await admin
  .from('caja_estado')
  .upsert({ tenant_id: tenantId, ...SALDO }, { onConflict: 'tenant_id' });

if (eCaja) morir('caja', eCaja);
console.log(`  Caja: S/ ${SALDO.saldo.toFixed(2)} de saldo.`);

// 8 · Personal --------------------------------------------------------------

const nuevos = [];
const yaExistian = [];
for (const persona of PERSONAL) {
  const email = `${persona.dni}@${args.slug}.hostal.local`;
  const { error } = await admin.auth.admin.createUser({
    email,
    password: persona.pin,
    email_confirm: true,
    user_metadata: {
      tenant_id: tenantId,
      dni: persona.dni,
      nombre: persona.nombre,
      rol: persona.rol,
      telefono: persona.telefono,
    },
  });

  if (!error) {
    nuevos.push(persona);
  } else if (error.message?.includes('already been registered')) {
    // Ya existía (p. ej. el admin que creó bootstrap.mjs): conserva SU PIN, no el de aquí.
    yaExistian.push(persona);
  } else {
    console.error(`  No se pudo crear a ${persona.nombre}: ${error.message}`);
  }
}

console.log(`  Personal: ${PERSONAL.length} del prototipo (${nuevos.length} creados ahora).`);

// 9 · Histórico de la demo (solo con --rica) ---------------------------------

/**
 * Va al final porque todo lo de aquí apunta a `profiles`, y los perfiles los crea el
 * trigger de auth en el paso 8. Antes de ese paso no existen.
 *
 * No se siembra `turno_conteos`: haría falta inventar el stock que había en cada cierre,
 * y esos números no atarían con el kardex. Un conteo que no cuadra con el inventario es
 * exactamente el registro que miente que este script evita en todo lo demás.
 */
if (rica) {
  const { data: perfiles, error: ePerfiles } = await admin
    .from('profiles')
    .select('id, rol')
    .eq('tenant_id', tenantId)
    .eq('activo', true);

  if (ePerfiles) morir('perfiles para el histórico', ePerfiles);

  const admin1 = perfiles.find((p) => p.rol === 'administrador') ?? perfiles[0];
  const recepcion = perfiles.find((p) => p.rol === 'recepcion') ?? admin1;

  if (!admin1) morir('perfiles para el histórico', new Error('no hay ningún perfil activo'));

  // --- turnos cerrados, con sus gastos y las alertas que dejan ---------------

  let nGastos = 0;
  let nAlertas = 0;

  for (const [i, t] of TURNOS_DEMO.entries()) {
    const quien = i % 2 === 0 ? recepcion.id : admin1.id;

    const { data: turno, error: eTurno } = await admin
      .from('turnos')
      .insert({
        tenant_id: tenantId,
        usuario_id: quien,
        estado: 'cerrado',
        abierto_at: t.abierto_at,
        cerrado_at: t.cerrado_at,
        sencillo_apertura: t.apertura,
        sencillo_dejado: t.dejado,
        cerrado_por: quien,
      })
      .select('id')
      .single();

    if (eTurno) morir('turnos del histórico', eTurno);

    const { error: eCierre } = await admin.from('cierres_caja').insert({
      tenant_id: tenantId,
      turno_id: turno.id,
      usuario_id: quien,
      recaudado: t.recaudado,
      por_medio: t.por_medio,
      efectivo_en_caja: t.dejado,
      sencillo_dejado: t.dejado,
    });

    if (eCierre) morir('cierres de caja del histórico', eCierre);

    for (const g of t.gastos) {
      const productoId = g.producto ? idDeProducto[g.producto] : null;

      const { error: eGasto } = await admin.from('gastos').insert({
        tenant_id: tenantId,
        turno_id: turno.id,
        categoria: g.categoria,
        producto_id: productoId,
        cantidad: g.cantidad ?? null,
        concepto: g.concepto,
        monto: g.monto,
        medio: g.medio,
        justificacion: g.justificacion ?? null,
        actor_id: quien,
        created_at: t.cerrado_at,
      });

      if (eGasto) morir(`gasto "${g.concepto}"`, eGasto);
      nGastos++;

      // Un gasto fijo ES una compra: entra al kardex, igual que en registrar_gasto().
      if (g.categoria === 'fijo') {
        const { error } = await admin.from('movimientos_inventario').insert({
          tenant_id: tenantId,
          producto_id: productoId,
          tipo: 'compra',
          cantidad: g.cantidad,
          turno_id: turno.id,
          motivo: `Compra · ${g.concepto}`,
          created_at: t.cerrado_at,
        });
        if (error) morir(`compra de "${g.concepto}"`, error);
      }

      /**
       * Las alertas se derivan con la MISMA regla que `registrar_gasto()`, no se copian
       * a mano: justificable siempre, y fijo solo si se pasa del 30 % sobre la referencia.
       * Si alguien cambia `margen_gasto()`, esto se queda corto — pero al menos hoy dice
       * lo mismo que diría la función, con el mismo texto.
       */
      const soles = (n) => n.toFixed(2);

      if (g.categoria === 'justificable') {
        const { error } = await admin.from('alertas').insert({
          tenant_id: tenantId,
          severidad: 'warning',
          titulo: `Gasto fuera de lo habitual: ${g.concepto} · S/ ${soles(g.monto)}`,
          detalle: `Justificación: ${g.justificacion}`,
          origen: 'caja',
          turno_id: turno.id,
          requiere_validacion: true,
          created_at: t.cerrado_at,
        });
        if (error) morir('alerta de gasto justificable', error);
        nAlertas++;
      } else {
        const referencia = COSTO_REFERENCIA[g.producto] ?? 0;
        const esperado = Math.round(referencia * g.cantidad * 100) / 100;
        const unidad = PRODUCTOS.find((p) => p.nombre === g.producto)?.unidad ?? 'unid.';

        if (referencia > 0 && g.monto > esperado * 1.3) {
          const { error } = await admin.from('alertas').insert({
            tenant_id: tenantId,
            severidad: 'danger',
            titulo: `Sobreprecio en ${g.producto}`,
            detalle:
              `Se pagó S/ ${soles(g.monto)} por ${g.cantidad} ${unidad}. ` +
              `Al precio de referencia serían S/ ${soles(esperado)}.`,
            origen: 'caja',
            turno_id: turno.id,
            requiere_validacion: true,
            created_at: t.cerrado_at,
          });
          if (error) morir('alerta de sobreprecio', error);
          nAlertas++;
        }
      }
    }
  }

  console.log(
    `  Turnos: ${TURNOS_DEMO.length} cerrados, con ${nGastos} gastos y ${nAlertas} alertas sin atender.`
  );

  // --- estadías ya cerradas -------------------------------------------------

  const cerradas = construirEstadiasCerradas({
    cuartos: CUARTOS,
    documentos: LISTA_HUESPEDES.map((h) => h.num_doc),
    ahora,
  });

  const { error: eCerradas } = await admin.from('estadias').insert(
    cerradas.map((e) => {
      const cuarto = CUARTOS.find((c) => c.numero === e.cuarto);
      const tipo = TIPOS.find((t) => t.nombre === cuarto.tipo);
      const total = tipo.amanecida * e.noches;

      return {
        tenant_id: tenantId,
        huesped_id: idDeHuesped[e.documento],
        cuarto_id: idDeCuarto[e.cuarto],
        modo: 'rango',
        noches: e.noches,
        fecha_entrada: e.fecha_entrada,
        fecha_salida: e.fecha_salida,
        hora_entrada: e.hora_entrada,
        hora_salida: e.hora_salida,
        personas: e.personas,
        tarifa_total: total,
        deposito: tipo.deposito,
        tarifa_detalle: {
          total,
          deposito: tipo.deposito,
          moneda: 'PEN',
          modo: 'rango',
          detalle: [{ concepto: `${e.noches} noche(s) · ${tipo.nombre}`, monto: total }],
        },
        estado: 'cerrada',
        created_at: e.hora_entrada,
      };
    })
  );

  if (eCerradas) morir('estadías cerradas', eCerradas);
  console.log(`  Histórico de estadías: ${cerradas.length} cerradas en 14 días (2 hoy).`);

  // --- reservas -------------------------------------------------------------

  const reservas = construirReservas({ ahora });

  const { error: eReservas } = await admin.from('reservas').insert(
    reservas.map((r) => ({
      tenant_id: tenantId,
      nombre_contacto: r.contacto,
      telefono: r.telefono,
      tipo_id: idDeTipo[r.tipo],
      fecha_entrada: r.entrada,
      fecha_salida: r.salida,
      personas: r.personas,
      estado: r.estado,
      origen: r.origen,
      notas: r.notas,
    }))
  );

  if (eReservas) morir('reservas', eReservas);
  console.log(`  Reservas: ${reservas.length}, en sus cuatro estados (una vencida sin resolver).`);
}

// ---------------------------------------------------------------- resultado

const listaAcceso = [
  ...nuevos.map((p) => `    ${p.dni}  PIN ${p.pin}   ${p.nombre} · ${p.rol}`),
  ...yaExistian.map((p) => `    ${p.dni}  PIN (el que ya tenía)   ${p.nombre} · ${p.rol}`),
].join('\n');

console.log(`
Listo. La base tiene lo mismo que mostraba el prototipo.

  Entra con cualquiera de estos (el PIN es el de 4 dígitos del mockup + "00"):
${listaAcceso}

  Libres o listas: 101, 103, 205        Ocupadas: 102, 201, 301
  Para inspeccionar: 105                En limpieza: 203        Check-out: 204

Prueba el asistente (abre turno primero desde Caja):

  "Llegó una pareja, matrimonial, 2 noches, efectivo"
  "A la 203, 2 toallas"
  "2 aguas a la 101, con yape"
  "¿La 205 está lista?"
`);
