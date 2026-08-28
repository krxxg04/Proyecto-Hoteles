/**
 * Crea el primer hostal y su primer administrador.
 *
 * Es el problema del huevo y la gallina: para dar de alta personal hace falta
 * ser administrador, y todavía no existe ninguno. Este script lo resuelve
 * usando `service_role` desde la terminal — que es exactamente el caso de uso
 * legítimo de esa clave (el ADR lo dice: "alta de tenants solo desde el
 * servidor").
 *
 * Se corre UNA vez por hostal. Después, el personal se da de alta desde la
 * aplicación con `crearPersona()`.
 *
 * Uso:
 *   node --env-file=.env.local scripts/bootstrap.mjs \
 *     --hostal "Hostal Aurora" --slug aurora --ciudad Lima \
 *     --dni 40123456 --nombre "Ana Torres" --pin 123456
 */

import { createClient } from '@supabase/supabase-js';

// --------------------------------------------------------------- argumentos

function leerArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const clave = argv[i].slice(2);
      const valor = argv[i + 1];
      if (!valor || valor.startsWith('--')) {
        throw new Error(`Falta el valor de --${clave}`);
      }
      args[clave] = valor;
      i++;
    }
  }
  return args;
}

const args = leerArgs();
const faltan = ['hostal', 'slug', 'dni', 'nombre', 'pin'].filter((k) => !args[k]);

if (faltan.length) {
  console.error(`\nFaltan argumentos: ${faltan.map((f) => '--' + f).join(', ')}\n`);
  console.error('Ejemplo:');
  console.error('  node --env-file=.env.local scripts/bootstrap.mjs \\');
  console.error('    --hostal "Hostal Aurora" --slug aurora --ciudad Lima \\');
  console.error('    --dni 40123456 --nombre "Ana Torres" --pin 123456\n');
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(args.slug)) {
  console.error('El slug solo puede tener minúsculas, números y guiones.');
  console.error('Se usa para el login interno: <dni>@<slug>.hostal.local');
  process.exit(1);
}

if (!/^[0-9]{4,}$/.test(args.pin)) {
  console.error('El PIN debe tener al menos 4 dígitos y solo números.');
  process.exit(1);
}

if (args.pin.length < 6) {
  console.warn(
    '\nAviso: Supabase exige contraseñas de 6+ caracteres por defecto.\n' +
      'Si falla, baja el mínimo en Authentication > Providers > Email\n' +
      'o usa un PIN de 6 dígitos.\n'
  );
}

// ------------------------------------------------------------------ cliente

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !clave) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Corre el script con: node --env-file=.env.local scripts/bootstrap.mjs ...');
  process.exit(1);
}

const admin = createClient(url, clave, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// -------------------------------------------------------------------- pasos

console.log(`\nCreando "${args.hostal}"...\n`);

// 1. El hostal
const { data: existente } = await admin
  .from('tenants')
  .select('id, nombre')
  .eq('slug', args.slug)
  .maybeSingle();

let tenantId;

if (existente) {
  console.log(`  El hostal "${existente.nombre}" ya existía. Se reutiliza.`);
  tenantId = existente.id;
} else {
  const { data, error } = await admin
    .from('tenants')
    .insert({
      slug: args.slug,
      nombre: args.hostal,
      ciudad: args.ciudad ?? 'Lima',
      ruc: args.ruc ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('  No se pudo crear el hostal:', error.message);
    process.exit(1);
  }
  tenantId = data.id;
  console.log(`  Hostal creado.`);
}

// 2. Caja en cero
await admin.from('caja_estado').upsert({ tenant_id: tenantId, sencillo: 0, caja_chica: 0 });

// 3. Catálogos globales (características de cuarto y bancos)
await admin.from('caracteristicas').upsert([
  { clave: 'tv', label: 'TV', icono: 'tv', orden: 1 },
  { clave: 'calle', label: 'Vista a la calle', icono: 'eye', orden: 2 },
  { clave: 'jacuzzi', label: 'Jacuzzi', icono: 'bath', orden: 3 },
  { clave: 'agua_caliente', label: 'Agua caliente', icono: 'flame', orden: 4 },
  { clave: 'wifi', label: 'WiFi', icono: 'wifi', orden: 5 },
  { clave: 'aire', label: 'Aire acondicionado', icono: 'wind', orden: 6 },
  { clave: 'balcon', label: 'Balcón', icono: 'door-open', orden: 7 },
  { clave: 'escritorio', label: 'Escritorio', icono: 'lamp-desk', orden: 8 },
]);

await admin.from('bancos').upsert([
  { clave: 'BCP', label: 'BCP', orden: 1 },
  { clave: 'BBVA', label: 'BBVA', orden: 2 },
  { clave: 'Scotiabank', label: 'Scotiabank', orden: 3 },
  { clave: 'Interbank', label: 'Interbank', orden: 4 },
]);

console.log('  Catálogos listos.');

// 4. El administrador
const email = `${args.dni.toLowerCase()}@${args.slug}.hostal.local`;

const { data: usuario, error: errorUsuario } = await admin.auth.admin.createUser({
  email,
  password: args.pin,
  email_confirm: true,
  user_metadata: {
    tenant_id: tenantId,
    dni: args.dni,
    nombre: args.nombre,
    rol: 'administrador',
    telefono: args.telefono ?? null,
  },
});

if (errorUsuario) {
  if (errorUsuario.message?.includes('already been registered')) {
    console.log('  Ese DNI ya estaba registrado en este hostal.');
  } else {
    console.error('  No se pudo crear el administrador:', errorUsuario.message);
    process.exit(1);
  }
} else {
  console.log('  Administrador creado.');

  // El trigger `auth_crear_profile` debería haberlo hecho solo. Se verifica,
  // porque si el trigger no está la persona no podría entrar nunca.
  const { data: perfil } = await admin
    .from('profiles')
    .select('id, rol')
    .eq('id', usuario.user.id)
    .maybeSingle();

  if (!perfil) {
    console.error(
      '\n  El perfil no se creó automáticamente.\n' +
        '  Falta aplicar Database/02_auth_y_auditoria.sql en el SQL Editor.\n'
    );
    process.exit(1);
  }
}

console.log(`
Listo.

  Hostal:  ${args.hostal}  (slug: ${args.slug})
  Entra con:
    DNI  ${args.dni}
    PIN  ${args.pin}

Pruébalo:
  curl -X POST http://localhost:3000/api/auth \\
    -H "Content-Type: application/json" \\
    -d '{"dni":"${args.dni}","pin":"${args.pin}"}'
`);
