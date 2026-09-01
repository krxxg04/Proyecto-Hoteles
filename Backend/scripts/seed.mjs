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
 */

import { createClient } from '@supabase/supabase-js';

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
const CAJA = { sencillo: 100, caja_chica: 0 };

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
      return { ...p, tenant_id: tenantId };
    }),
    { onConflict: 'tenant_id,nombre' }
  )
  .select('id, nombre, stock');

if (eProductos) morir('catálogo', eProductos);

const idDeProducto = Object.fromEntries(productos.map((p) => [p.nombre, p.id]));
console.log(`  Catálogo: ${productos.length} productos.`);

// 4 · Huéspedes -------------------------------------------------------------

const { data: huespedes, error: eHuespedes } = await admin
  .from('huespedes')
  .upsert(
    HUESPEDES.map((h) => ({ ...h, tenant_id: tenantId })),
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
const APERTURA = new Date(ahora - 3 * 24 * 3600 * 1000).toISOString();

const yaSembrado = productos.some((p) => Number(p.stock) > 0);

if (yaSembrado) {
  console.log('  Stock: los productos ya tenían movimientos, no se tocan.');
  console.log('    Para rehacerlo desde cero: --limpiar');
} else {
  const vendidoDe = (nombre) =>
    VENTAS.filter((v) => v.producto === nombre).reduce((s, v) => s + v.cantidad, 0);

  const compras = PRODUCTOS.map((p) => ({
    tenant_id: tenantId,
    producto_id: idDeProducto[p.nombre],
    tipo: 'compra',
    cantidad: p.stock_actual + vendidoDe(p.nombre),
    motivo: 'Carga inicial (datos del prototipo)',
    created_at: APERTURA,
  })).filter((m) => m.cantidad > 0);

  const { error: eCompras } = await admin.from('movimientos_inventario').insert(compras);
  if (eCompras) morir('stock inicial', eCompras);

  const salidas = VENTAS.map((v) => ({
    tenant_id: tenantId,
    producto_id: idDeProducto[v.producto],
    tipo: 'venta',
    cantidad: -v.cantidad,
    cuarto_id: idDeCuarto[v.cuarto] ?? null,
    motivo: 'Venta (datos del prototipo)',
    created_at: CUANDO[v.dia],
  }));

  const { error: eSalidas } = await admin.from('movimientos_inventario').insert(salidas);
  if (eSalidas) morir('movimientos de venta', eSalidas);

  const { error: eVentas } = await admin.from('ventas').insert(
    VENTAS.map((v) => ({
      tenant_id: tenantId,
      concepto: v.producto,
      producto_id: idDeProducto[v.producto],
      cantidad: v.cantidad,
      cuarto_id: idDeCuarto[v.cuarto] ?? null,
      monto: v.monto,
      medio: v.medio,
      // `turno_id` va nulo: en el prototipo TURNO arranca en null y aquí también.
      created_at: CUANDO[v.dia],
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

  console.log(`  Stock e histórico: ${compras.length} compras y ${VENTAS.length} ventas del mockup.`);
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

const { error: eCaja } = await admin
  .from('caja_estado')
  .upsert({ tenant_id: tenantId, ...CAJA }, { onConflict: 'tenant_id' });

if (eCaja) morir('caja', eCaja);
console.log(`  Caja: sencillo S/ ${CAJA.sencillo.toFixed(2)}, caja chica S/ ${CAJA.caja_chica.toFixed(2)}.`);

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
