/**
 * GATE #1 de CLAUDE.md: comprobar que el RLS aísla de verdad un hostal de otro.
 *
 * Hasta ahora "el RLS aísla" era una afirmación sin probar: solo había un hostal en la
 * base, así que cualquier consulta devolvía lo correcto por casualidad.
 *
 * Lo que hace:
 *   1. Crea un segundo hostal de prueba y lo llena con datos en TODAS las tablas con
 *      `tenant_id`. Sin esto la prueba sería vacía: "no veo nada del otro" es trivial
 *      cuando el otro no tiene nada.
 *   2. Entra como administrador de cada hostal con la clave pública — el mismo camino
 *      que usa la aplicación: anon key + JWT, con el RLS activo.
 *   3. Intenta leer, escribir, borrar y llamar funciones sobre los datos del otro.
 *   4. Comprueba además la matriz de roles dentro de un mismo hostal, que `anon` (sin
 *      sesión) no ve nada, y que la auditoría distingue el origen de cada escritura.
 *
 * Sale con código 1 si pasa algo que no debería. Eso es lo que puede colgarse de CI.
 *
 * Uso:
 *   node --env-file=.env.local scripts/prueba-aislamiento.mjs
 *   node --env-file=.env.local scripts/prueba-aislamiento.mjs --slug aurora --dni 40123456 --pin 123456
 *   node --env-file=.env.local scripts/prueba-aislamiento.mjs --limpiar   borra el hostal de prueba
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ESQUEMA = join(AQUI, '..', '..', 'Database', '01_schema.sql');

// --------------------------------------------------------------- argumentos

const argv = process.argv.slice(2);
const arg = (n, def) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : def);
const flag = (n) => argv.includes(`--${n}`);

const A = {
  slug: arg('slug', 'aurora'),
  dni: arg('dni', '40123456'),
  pin: arg('pin', '123456'),
};

/** El hostal desechable. Nombre feo a propósito: que nadie lo confunda con uno real. */
const B = {
  slug: 'zz-prueba-aislamiento',
  nombre: 'Hostal Prueba de Aislamiento',
  dni: '99000001',
  pin: '990001',
  dniLimpieza: '99000002',
  pinLimpieza: '990002',
};

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_SB || !ANON || !SERVICE) {
  console.error('\nFaltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Corre con: node --env-file=.env.local scripts/prueba-aislamiento.mjs\n');
  process.exit(1);
}

const admin = createClient(URL_SB, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const correo = (dni, slug) => `${dni.toLowerCase()}@${slug}.hostal.local`;

// ------------------------------------------------------------------ limpieza

if (flag('limpiar')) {
  const { data: t } = await admin.from('tenants').select('id').eq('slug', B.slug).maybeSingle();
  if (t) {
    const { data: usuarios } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of usuarios?.users ?? []) {
      if (u.email?.endsWith(`@${B.slug}.hostal.local`)) await admin.auth.admin.deleteUser(u.id);
    }
    await admin.from('tenants').delete().eq('id', t.id);
    console.log(`\nHostal de prueba "${B.slug}" borrado.\n`);
  } else {
    console.log('\nNo había nada que borrar.\n');
  }
  process.exit(0);
}

// -------------------------------------------------------- tablas bajo prueba

/**
 * Toda tabla de `public` con `tenant_id`. La lista está escrita a mano y se contrasta
 * contra `01_schema.sql` más abajo: si alguien agrega una tabla y no la agrega aquí,
 * la prueba avisa en vez de dar un falso verde.
 */
const TABLAS = [
  'profiles', 'tipos_cuarto', 'cuartos', 'cuarto_estado_log', 'productos',
  'movimientos_inventario', 'aseo', 'huespedes', 'estadias', 'acompanantes',
  'reservas', 'inspecciones', 'caja_estado', 'turnos', 'turno_conteos',
  'incidencias', 'ventas', 'cierres_caja', 'tipo_cambio', 'alertas',
  'integraciones', 'medios', 'consentimientos', 'audit_log',
];

/** Sin `tenant_id`: `tenants` se filtra por `id` y los catálogos son globales a propósito. */
const SIN_TENANT = ['tenants', 'caracteristicas', 'bancos'];

function revisarCobertura() {
  let sql;
  try {
    sql = readFileSync(ESQUEMA, 'utf8');
  } catch {
    return ['no se pudo leer 01_schema.sql para contrastar la lista'];
  }
  const enEsquema = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
  const cubiertas = new Set([...TABLAS, ...SIN_TENANT]);
  return enEsquema.filter((t) => !cubiertas.has(t)).map((t) => `la tabla "${t}" no está cubierta`);
}

// ------------------------------------------------------------------ fixture

console.log('\nPreparando el segundo hostal...\n');

async function tenantDe(slug) {
  const { data } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle();
  return data?.id ?? null;
}

const tenantA = await tenantDe(A.slug);
if (!tenantA) {
  console.error(`No existe el hostal "${A.slug}". Créalo con scripts/bootstrap.mjs.\n`);
  process.exit(1);
}

let tenantB = await tenantDe(B.slug);
if (!tenantB) {
  const { data, error } = await admin
    .from('tenants')
    .insert({ slug: B.slug, nombre: B.nombre, ciudad: 'Lima' })
    .select('id')
    .single();
  if (error) {
    console.error('No se pudo crear el hostal de prueba:', error.message);
    process.exit(1);
  }
  tenantB = data.id;
}

/** Crea el usuario si no existe y devuelve su id. */
async function asegurarUsuario({ dni, pin, nombre, rol }) {
  const email = correo(dni, B.slug);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
    user_metadata: { tenant_id: tenantB, dni, nombre, rol },
  });
  if (!error) return data.user.id;
  if (!error.message?.includes('already been registered')) {
    console.error(`No se pudo crear ${email}: ${error.message}`);
    process.exit(1);
  }
  const { data: perfil } = await admin
    .from('profiles')
    .select('id')
    .eq('dni', dni)
    .eq('tenant_id', tenantB)
    .maybeSingle();
  return perfil?.id ?? null;
}

const usuarioBAdmin = await asegurarUsuario({
  dni: B.dni, pin: B.pin, nombre: 'Admin de prueba', rol: 'administrador',
});
const usuarioBLimpieza = await asegurarUsuario({
  dni: B.dniLimpieza, pin: B.pinLimpieza, nombre: 'Limpieza de prueba', rol: 'limpieza',
});

/**
 * Datos de B en todas las tablas con tenant_id. Se escriben con `service_role`, que
 * salta el RLS: es el único modo de sembrar un hostal ajeno sin tener sesión suya.
 */
async function sembrarB() {
  const hoy = new Date().toISOString().slice(0, 10);

  const poner = async (tabla, fila, conflicto) => {
    const q = conflicto
      ? admin.from(tabla).upsert({ tenant_id: tenantB, ...fila }, { onConflict: conflicto })
      : admin.from(tabla).insert({ tenant_id: tenantB, ...fila });
    const { data, error } = await q.select().limit(1);
    if (error) throw new Error(`sembrando ${tabla}: ${error.message}`);
    return data?.[0] ?? null;
  };

  const yaHay = async (tabla) => {
    const { data } = await admin.from(tabla).select('*').eq('tenant_id', tenantB).limit(1);
    return data?.[0] ?? null;
  };

  const tipo = (await yaHay('tipos_cuarto')) ?? (await poner('tipos_cuarto', {
    nombre: 'Doble prueba', aforo: 2, costo: 50, amanecida: 90, deposito: 20,
  }, 'tenant_id,nombre'));

  const cuarto = (await yaHay('cuartos')) ?? (await poner('cuartos', {
    numero: 'B-901', tipo_id: tipo.id, estado: 'lista', aforo: 2, caracteristicas: ['tv'],
  }, 'tenant_id,numero'));

  const producto = (await yaHay('productos')) ?? (await poner('productos', {
    nombre: 'Agua de prueba', unidad: 'unid.', stock: 10, stock_max: 20,
    categoria: 'vendible', clase: 'descartable', precio: 3,
  }, 'tenant_id,nombre'));

  const huesped = (await yaHay('huespedes')) ?? (await poner('huespedes', {
    nombre: 'Huésped de prueba', tipo_doc: 'DNI', num_doc: '88000001', telefono: '900000000',
  }, 'tenant_id,tipo_doc,num_doc'));

  const estadia = (await yaHay('estadias')) ?? (await poner('estadias', {
    huesped_id: huesped.id, cuarto_id: cuarto.id, modo: 'rango', noches: 1,
    fecha_entrada: hoy, personas: 1, tarifa_total: 90,
  }));

  const turno = (await yaHay('turnos')) ?? (await poner('turnos', {
    usuario_id: usuarioBAdmin, estado: 'cerrado', sencillo_apertura: 50,
    cerrado_at: new Date().toISOString(),
  }));

  const resto = [
    ['acompanantes', { estadia_id: estadia.id, nombre: 'Acompañante de prueba' }],
    ['reservas', { nombre_contacto: 'Reserva de prueba', fecha_entrada: hoy, personas: 1 }],
    ['inspecciones', { cuarto_id: cuarto.id, resultado: [{ item: 'Toalla', esperado: 2, confirmado: 2 }] }],
    ['caja_estado', { sencillo: 50, caja_chica: 100 }, 'tenant_id'],
    ['movimientos_inventario', { producto_id: producto.id, tipo: 'compra', cantidad: 10, motivo: 'Prueba' }],
    ['aseo', { producto_id: producto.id, cantidad: 1, cuarto_id: cuarto.id, estado: 'pendiente' }],
    ['turno_conteos', { turno_id: turno.id, producto_id: producto.id, apertura: 10, esperado: 10, contado: 9 }],
    ['incidencias', {
      turno_id: turno.id, producto_id: producto.id, concepto: 'Faltante de prueba',
      esperado: 10, contado: 9, diferencia: 1, justificacion: 'Prueba de aislamiento',
    }],
    ['ventas', {
      turno_id: turno.id, concepto: 'Agua de prueba', producto_id: producto.id,
      cantidad: 1, monto: 3, medio: 'efectivo',
    }],
    ['cierres_caja', {
      turno_id: turno.id, usuario_id: usuarioBAdmin, recaudado: 3,
      efectivo_en_caja: 53, sencillo_dejado: 50,
    }],
    ['tipo_cambio', { moneda: 'USD', valor: 3.75 }],
    ['alertas', { severidad: 'info', titulo: 'Alerta de prueba', origen: 'sistema' }],
    ['integraciones', { clave: 'prueba', nombre: 'Integración de prueba' }, 'tenant_id,clave'],
    ['medios', { object_key: `prueba/${tenantB}.jpg`, tipo: 'inspeccion', huesped_id: huesped.id }, 'bucket,object_key'],
    ['consentimientos', { huesped_id: huesped.id, finalidad: 'Prueba de aislamiento', otorgado: true }],
  ];

  for (const [tabla, fila, conflicto] of resto) {
    if (!(await yaHay(tabla))) await poner(tabla, fila, conflicto);
  }

  // `cuarto_estado_log` y `audit_log` los llenan los triggers: basta con tocar el cuarto.
  await admin.from('cuartos').update({ estado: 'limpieza' }).eq('id', cuarto.id);
  await admin.from('cuartos').update({ estado: 'lista' }).eq('id', cuarto.id);

  return { tipo, cuarto: { ...cuarto, estado: 'lista' }, producto, huesped, estadia, turno };
}

let fixtureB;
try {
  fixtureB = await sembrarB();
} catch (e) {
  console.error('No se pudo sembrar el hostal de prueba:', e.message);
  process.exit(1);
}

console.log(`  A · ${A.slug}  ${tenantA}`);
console.log(`  B · ${B.slug}  ${tenantB}`);

// ------------------------------------------------------------------ sesiones

async function entrar(dni, slug, pin, cabeceras) {
  const cliente = createClient(URL_SB, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(cabeceras ? { global: { headers: cabeceras } } : {}),
  });
  const { error } = await cliente.auth.signInWithPassword({
    email: correo(dni, slug),
    password: pin,
  });
  if (error) {
    console.error(`\nNo se pudo entrar como ${dni}@${slug}: ${error.message}\n`);
    process.exit(1);
  }
  return cliente;
}

const clienteA = await entrar(A.dni, A.slug, A.pin);
const clienteB = await entrar(B.dni, B.slug, B.pin);
const clienteLimpiezaB = await entrar(B.dniLimpieza, B.slug, B.pinLimpieza);
const clienteAnon = createClient(URL_SB, ANON, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --------------------------------------------------------------- aserciones

const fallos = [];
const avisos = [];
let bloqueActual = '';

function bloque(titulo) {
  bloqueActual = titulo;
  console.log(`\n${titulo}`);
}

function comprobar(nombre, ok, detalle = '') {
  if (ok) {
    console.log(`  ok     ${nombre}`);
    return;
  }
  console.log(`  FALLA  ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  fallos.push(`[${bloqueActual}] ${nombre}${detalle ? ` — ${detalle}` : ''}`);
}

// --------------------------------------------------------- 0 · cobertura

bloque('0 · Cobertura de la prueba');

const sueltas = revisarCobertura();
comprobar(`las ${TABLAS.length} tablas con tenant_id están cubiertas`, sueltas.length === 0, sueltas.join('; '));

// --------------------------------------------------------- 1 · identidad

bloque('1 · Identidad de cada sesión');

const { data: tidA } = await clienteA.rpc('current_tenant_id');
const { data: tidB } = await clienteB.rpc('current_tenant_id');
comprobar('A se identifica con su propio hostal', tidA === tenantA, `devolvió ${tidA}`);
comprobar('B se identifica con su propio hostal', tidB === tenantB, `devolvió ${tidB}`);
comprobar('los dos hostales son distintos', tenantA !== tenantB);

// --------------------------------------------------------- 2 · lectura

bloque('2 · Lectura — A no ve una sola fila de B');

for (const tabla of TABLAS) {
  const { data: deB } = await admin.from(tabla).select('tenant_id').eq('tenant_id', tenantB).limit(1);
  const hayQueVer = (deB?.length ?? 0) > 0;
  if (!hayQueVer) avisos.push(`"${tabla}" no tiene filas de B: esa comprobación queda vacía`);

  const { data, error } = await clienteA.from(tabla).select('tenant_id').limit(500);
  if (error) {
    comprobar(tabla, false, `A no pudo ni consultar: ${error.message}`);
    continue;
  }

  const ajenas = (data ?? []).filter((f) => f.tenant_id !== tenantA).length;
  const { data: forzado } = await clienteA.from(tabla).select('tenant_id').eq('tenant_id', tenantB);
  const filtradas = forzado?.length ?? 0;

  comprobar(
    `${tabla}${hayQueVer ? '' : '  (B sin datos aquí)'}`,
    ajenas === 0 && filtradas === 0,
    ajenas ? `${ajenas} filas ajenas` : `${filtradas} filas al filtrar por el tenant de B`
  );
}

bloque('2b · Lectura — lo que no se filtra por tenant_id');

const { data: tenantsVistos } = await clienteA.from('tenants').select('id');
comprobar(
  'A solo ve su propio hostal en `tenants`',
  tenantsVistos?.length === 1 && tenantsVistos[0].id === tenantA,
  `vio ${tenantsVistos?.length ?? 0}`
);

const { data: cuartoAjeno } = await clienteA.from('cuartos').select('id').eq('id', fixtureB.cuarto.id);
comprobar('A no puede leer un cuarto de B pidiéndolo por id', (cuartoAjeno?.length ?? 0) === 0);

const { data: perfilesVistos } = await clienteA.from('profiles').select('id, tenant_id');
comprobar(
  'A no ve al personal de B',
  !(perfilesVistos ?? []).some((p) => p.tenant_id === tenantB),
  'aparecen perfiles de otro hostal'
);

// --------------------------------------------------------- 3 · escritura

bloque('3 · Escritura — A no puede tocar nada de B');

const estadoAntes = fixtureB.cuarto.estado;

const upd = await clienteA.from('cuartos').update({ estado: 'mantenimiento' }).eq('id', fixtureB.cuarto.id).select();
const { data: cuartoDespues } = await admin.from('cuartos').select('estado').eq('id', fixtureB.cuarto.id).single();
comprobar(
  'UPDATE sobre un cuarto de B no cambia nada',
  (upd.data?.length ?? 0) === 0 && cuartoDespues.estado === estadoAntes,
  `quedó en "${cuartoDespues.estado}"`
);

const ins = await clienteA.from('cuartos').insert({
  tenant_id: tenantB, numero: 'X-999', tipo_id: fixtureB.tipo.id, estado: 'libre', aforo: 2,
}).select();
comprobar('INSERT con el tenant_id de B es rechazado', !!ins.error, ins.error ? '' : 'la fila entró');
if (!ins.error) await admin.from('cuartos').delete().eq('numero', 'X-999').eq('tenant_id', tenantB);

const del = await clienteA.from('productos').delete().eq('id', fixtureB.producto.id).select();
const { data: productoSigue } = await admin.from('productos').select('id').eq('id', fixtureB.producto.id).maybeSingle();
comprobar('DELETE sobre un producto de B no borra nada', (del.data?.length ?? 0) === 0 && !!productoSigue);

const { data: cuartoA } = await admin.from('cuartos').select('id').eq('tenant_id', tenantA).limit(1).single();
await clienteA.from('cuartos').update({ tenant_id: tenantB }).eq('id', cuartoA.id).select();
const { data: mudado } = await admin.from('cuartos').select('tenant_id').eq('id', cuartoA.id).single();
comprobar(
  'A no puede mudar un cuarto suyo al hostal de B',
  mudado.tenant_id === tenantA,
  'el WITH CHECK de la policy de UPDATE no está haciendo su trabajo'
);
if (mudado.tenant_id !== tenantA) await admin.from('cuartos').update({ tenant_id: tenantA }).eq('id', cuartoA.id);

const updPerfil = await clienteA.from('profiles').update({ nombre: 'Intruso' }).eq('id', usuarioBAdmin).select();
const { data: perfilB } = await admin.from('profiles').select('nombre').eq('id', usuarioBAdmin).single();
comprobar(
  'A no puede editar el perfil del admin de B',
  (updPerfil.data?.length ?? 0) === 0 && perfilB.nombre !== 'Intruso'
);

// --------------------------------------------------------- 4 · funciones

bloque('4 · Funciones de negocio — el hostal sale del JWT, no del parámetro');

const rpcEstado = await clienteA.rpc('cambiar_estado_cuarto', {
  p_cuarto_id: fixtureB.cuarto.id,
  p_estado: 'mantenimiento',
});
const { data: trasRpc } = await admin.from('cuartos').select('estado').eq('id', fixtureB.cuarto.id).single();
comprobar(
  'cambiar_estado_cuarto() rechaza un cuarto de B',
  !!rpcEstado.error && trasRpc.estado === estadoAntes,
  rpcEstado.error ? '' : 'la función lo dejó pasar'
);

const rpcVenta = await clienteA.rpc('registrar_venta', {
  p_producto_id: fixtureB.producto.id,
  p_cantidad: 1,
  p_medio: 'efectivo',
  p_cuarto_id: null,
});
comprobar('registrar_venta() rechaza un producto de B', !!rpcVenta.error, rpcVenta.error ? '' : 'vendió stock ajeno');

// --------------------------------------------------------- 5 · sin sesión

bloque('5 · Sin sesión — `anon` no ve nada');

for (const tabla of ['cuartos', 'productos', 'huespedes', 'ventas', 'audit_log', 'profiles', 'tenants']) {
  const { data, error } = await clienteAnon.from(tabla).select('*').limit(1);
  comprobar(`anon no lee ${tabla}`, !!error || (data?.length ?? 0) === 0, 'devolvió filas');
}

/** Sin sesión no se ejecuta nada de `public` salvo el propio login. */
const FUNCIONES_CERRADAS = [
  ['current_tenant_id', {}],
  ['current_rol', {}],
  ['is_admin', {}],
  ['turno_abierto', {}],
  ['cambiar_estado_cuarto', { p_cuarto_id: fixtureB.cuarto.id, p_estado: 'libre' }],
  ['registrar_venta', { p_producto_id: fixtureB.producto.id, p_cantidad: 1, p_medio: 'efectivo', p_cuarto_id: null }],
];

for (const [fn, params] of FUNCIONES_CERRADAS) {
  const { error } = await clienteAnon.rpc(fn, params);
  comprobar(`anon no puede llamar ${fn}()`, !!error, 'la ejecutó');
}

const { data: login, error: errorLogin } = await clienteAnon.rpc('resolver_login', { p_dni: A.dni });
comprobar(
  'anon sí puede resolver el login (si no, nadie entraría)',
  !errorLogin && (login?.length ?? 0) > 0,
  errorLogin?.message ?? 'no devolvió el hostal'
);

// --------------------------------------------------------- 6 · roles

bloque('6 · Matriz de roles dentro del mismo hostal (limpieza en B)');

for (const tabla of ['ventas', 'turnos', 'huespedes', 'estadias', 'cierres_caja', 'audit_log']) {
  const { data: hay } = await admin.from(tabla).select('tenant_id').eq('tenant_id', tenantB).limit(1);
  const { data, error } = await clienteLimpiezaB.from(tabla).select('*').limit(5);
  comprobar(
    `limpieza no ve ${tabla}${(hay?.length ?? 0) ? '' : '  (sin datos: comprobación vacía)'}`,
    !!error || (data?.length ?? 0) === 0,
    `devolvió ${data?.length ?? 0} filas`
  );
}

const { data: cuartosLimpieza } = await clienteLimpiezaB.from('cuartos').select('id');
comprobar('limpieza sí ve los cuartos de su hostal', (cuartosLimpieza?.length ?? 0) > 0);

await clienteLimpiezaB.from('tipos_cuarto').update({ costo: 1 }).eq('id', fixtureB.tipo.id).select();
const { data: tarifaDespues } = await admin.from('tipos_cuarto').select('costo').eq('id', fixtureB.tipo.id).single();
comprobar('limpieza no puede cambiar el tarifario', Number(tarifaDespues.costo) !== 1, `quedó en ${tarifaDespues.costo}`);

await clienteLimpiezaB.from('profiles').update({ rol: 'administrador' }).eq('id', usuarioBLimpieza).select();
const { data: perfilLimpieza } = await admin.from('profiles').select('rol').eq('id', usuarioBLimpieza).single();
comprobar(
  'limpieza no puede ascenderse sola a administrador',
  perfilLimpieza.rol === 'limpieza',
  `quedó como ${perfilLimpieza.rol}`
);

/**
 * Lo que cierra `08_acciones_por_rol.sql`.
 *
 * Antes esto solo se limitaba escondiendo el botón, y un botón escondido no es una
 * restricción: se esquiva con una llamada directa a la API.
 */
const { data: cuartoB } = await admin
  .from('cuartos').select('id, estado').eq('tenant_id', tenantB).limit(1).single();

for (const estado of ['ocupada', 'libre', 'checkout']) {
  const { error } = await clienteLimpiezaB.rpc('cambiar_estado_cuarto', {
    p_cuarto_id: cuartoB.id,
    p_estado: estado,
  });
  comprobar(`limpieza no puede poner un cuarto en "${estado}"`, !!error, 'lo cambió');
}

// La función es SECURITY DEFINER: si el UPDATE directo pasa, la comprobación no vale nada.
await clienteLimpiezaB.from('cuartos').update({ estado: 'ocupada' }).eq('id', cuartoB.id).select();
const { data: trasUpdate } = await admin
  .from('cuartos').select('estado').eq('id', cuartoB.id).single();
comprobar(
  'ni esquivándolo con un UPDATE directo sobre `cuartos`',
  trasUpdate.estado !== 'ocupada',
  `quedó en "${trasUpdate.estado}"`
);
if (trasUpdate.estado !== cuartoB.estado) {
  await admin.from('cuartos').update({ estado: cuartoB.estado }).eq('id', cuartoB.id);
}

const { data: productoB } = await admin
  .from('productos').select('id, stock').eq('tenant_id', tenantB).limit(1).single();

for (const tipo of ['compra', 'ajuste']) {
  const { error } = await clienteLimpiezaB.rpc('registrar_movimiento', {
    p_producto_id: productoB.id,
    p_tipo: tipo,
    p_cantidad: 5,
    p_motivo: 'prueba',
  });
  comprobar(`limpieza no puede registrar un movimiento de tipo "${tipo}"`, !!error, 'lo registró');
}

const { error: errorEntrega } = await clienteLimpiezaB.rpc('registrar_movimiento', {
  p_producto_id: productoB.id,
  p_tipo: 'entrega',
  p_cantidad: -1,
  p_cuarto_id: cuartoB.id,
});
comprobar(
  'limpieza SÍ puede entregar a un cuarto (es su trabajo)',
  !errorEntrega,
  errorEntrega?.message ?? ''
);
await admin.from('productos').update({ stock: productoB.stock }).eq('id', productoB.id);

// --------------------------------------------------------- 7 · realtime

bloque('7 · Realtime — el socket también filtra por hostal');

/**
 * Suscribe a `clienteEscucha` a los cambios de `cuartos`, provoca uno en el hostal
 * indicado y devuelve los mensajes QUE TRAÍAN DATOS.
 *
 * Lo que importa no es si llega un mensaje, sino si llega una fila. Cuando el RLS
 * tapa el cambio, Realtime igual manda un sobre, pero vacío y con
 * `errors: ["Error 401: Unauthorized"]`. Contar sobres daría un falso positivo de fuga.
 *
 * Las esperas no son de adorno: el servidor tarda en registrar la suscripción, y
 * cambiar la fila antes de que termine da un falso negativo. Me pasó.
 */
async function escuchar(clienteEscucha, etiqueta, tenantDelCambio) {
  const { data: fila } = await admin
    .from('cuartos').select('id, estado').eq('tenant_id', tenantDelCambio).limit(1).single();

  const conDatos = [];
  const canal = clienteEscucha
    .channel(`aislamiento-${etiqueta}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cuartos' }, (m) => {
      const trajo = Object.keys(m.new ?? {}).length > 0 || Object.keys(m.old ?? {}).length > 0;
      if (trajo) conDatos.push(m);
    })
    .subscribe();

  await new Promise((r) => setTimeout(r, 3000));
  const otro = fila.estado === 'lista' ? 'limpieza' : 'lista';
  await admin.from('cuartos').update({ estado: otro }).eq('id', fila.id);
  await new Promise((r) => setTimeout(r, 4000));
  await admin.from('cuartos').update({ estado: fila.estado }).eq('id', fila.id);

  await clienteEscucha.removeChannel(canal);
  return conDatos;
}

const propio = await escuchar(clienteB, 'propio', tenantB);
comprobar('B recibe los cambios de su propio hostal', propio.length > 0, 'no llegó ninguna fila');
comprobar(
  'y solo con filas de su hostal',
  propio.every((m) => (m.new?.tenant_id ?? tenantB) === tenantB),
  'llegó una fila con otro tenant_id'
);

const ajeno = await escuchar(clienteB, 'ajeno', tenantA);
comprobar(
  'B NO recibe las filas del hostal A',
  ajeno.length === 0,
  `le llegó un cuarto ajeno (${ajeno[0]?.new?.numero})`
);

const sinSesion = await escuchar(clienteAnon, 'anon', tenantB);
comprobar(
  'sin sesión no llega ninguna fila (solo el sobre vacío con 401)',
  sinSesion.length === 0,
  'el socket entregó datos a quien no tiene sesión'
);

// --------------------------------------------------- 8 · origen en auditoría

bloque('8 · Auditoría — queda registrado de dónde vino la escritura');

const { data: cuartoPropio } = await admin
  .from('cuartos').select('id, estado').eq('tenant_id', tenantB).limit(1).single();
const otroEstado = cuartoPropio.estado === 'lista' ? 'limpieza' : 'lista';

const comoAsistente = await entrar(B.dni, B.slug, B.pin, { 'x-origen': 'asistente' });
await comoAsistente.rpc('cambiar_estado_cuarto', { p_cuarto_id: cuartoPropio.id, p_estado: otroEstado });

const ultimoOrigen = async () => {
  const { data } = await admin
    .from('audit_log')
    .select('origen')
    .eq('tenant_id', tenantB)
    .eq('tabla', 'cuartos')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.origen ?? 'sin registro';
};

const origenIA = await ultimoOrigen();
comprobar('una escritura del asistente queda marcada como `asistente`', origenIA === 'asistente', `quedó como "${origenIA}"`);

await clienteB.rpc('cambiar_estado_cuarto', { p_cuarto_id: cuartoPropio.id, p_estado: cuartoPropio.estado });
const origenApp = await ultimoOrigen();
comprobar('una escritura de una persona queda marcada como `app`', origenApp === 'app', `quedó como "${origenApp}"`);

// -------------------------------------------------------------- resultado

console.log('');
for (const a of avisos) console.log(`  aviso · ${a}`);
if (avisos.length) console.log('');

if (fallos.length === 0) {
  console.log('GATE #1 · PASA — ningún hostal ve ni toca los datos del otro.\n');
  console.log('Para borrar el hostal de prueba:');
  console.log('  node --env-file=.env.local scripts/prueba-aislamiento.mjs --limpiar\n');
  process.exit(0);
}

console.log(`GATE #1 · NO PASA — ${fallos.length} comprobación(es) fallaron:\n`);
for (const f of fallos) console.log(`  · ${f}`);
console.log('');
process.exit(1);
