/**
 * Aplica las migraciones de `Database/` y deja constancia de cuáles ya corrieron.
 *
 * Hasta ahora los cuatro SQL se pegaban a mano en el editor de Supabase: nadie sabía
 * con certeza qué versión tenía la base. `backend.md` pide migraciones versionadas.
 *
 * Cada archivo se aplica dentro de una transacción y se registra en `_migraciones`
 * con su sha256. Si un archivo ya aplicado cambia de contenido, el runner se planta:
 * editar una migración vieja es lo que rompe las bases de los demás.
 *
 * Uso:
 *   node --env-file=.env.local scripts/migrar.mjs             aplica lo pendiente
 *   node --env-file=.env.local scripts/migrar.mjs --estado    solo informa
 *   node --env-file=.env.local scripts/migrar.mjs --forzar    reaplica aunque el sha no cuadre
 *   node --env-file=.env.local scripts/migrar.mjs --baseline --hasta 04
 *
 * `--baseline` es para adoptar el runner en una base que ya se construyó a mano:
 * registra los archivos sin ejecutarlos. `--hasta NN` limita hasta dónde llega esa
 * amnistía, porque lo que viene después sí tiene que correr de verdad.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const AQUI = dirname(fileURLToPath(import.meta.url));
const CARPETA = join(AQUI, '..', '..', 'Database');

const argv = process.argv.slice(2);
const args = new Set(argv);
const soloEstado = args.has('--estado');
const baseline = args.has('--baseline');
const forzar = args.has('--forzar');
/** Prefijo numérico máximo que cubre el baseline. Sin `--hasta`, cubre todo. */
const hasta = argv.includes('--hasta') ? argv[argv.indexOf('--hasta') + 1] : null;

const cadena = process.env.DATABASE_URL;
if (!cadena) {
  console.error('\nFalta DATABASE_URL en el entorno.');
  console.error('Corre con: node --env-file=.env.local scripts/migrar.mjs\n');
  process.exit(1);
}

// --------------------------------------------------------------- migraciones

/** Solo `NN_nombre.sql`. `Supabase.txt` y cualquier borrador quedan fuera a propósito. */
function migracionesEnDisco() {
  return readdirSync(CARPETA)
    .filter((f) => /^\d{2,}_.+\.sql$/.test(f))
    .sort()
    .map((archivo) => {
      const sql = readFileSync(join(CARPETA, archivo), 'utf8');
      return {
        version: archivo.replace(/\.sql$/, ''),
        archivo,
        sql,
        sha: createHash('sha256').update(sql).digest('hex'),
      };
    });
}

const enDisco = migracionesEnDisco();

if (enDisco.length === 0) {
  console.error(`\nNo hay migraciones en ${CARPETA}.\n`);
  process.exit(1);
}

// ------------------------------------------------------------------- cliente

const cliente = new pg.Client({
  connectionString: cadena,
  ssl: { rejectUnauthorized: false },
  application_name: 'hostal-migrar',
});

// Los `raise notice` de los SQL son la única señal de que el script hizo lo suyo.
cliente.on('notice', (n) => {
  if (n.message) console.log(`     ${n.message}`);
});

await cliente.connect();

await cliente.query(`
  create table if not exists public._migraciones (
    version      text primary key,
    sha256       text        not null,
    aplicada_en  timestamptz not null default now(),
    duracion_ms  integer,
    baseline     boolean     not null default false
  )
`);
// Es metadatos de despliegue, no datos de hostal: nadie la toca desde la aplicación.
await cliente.query('alter table public._migraciones enable row level security');
await cliente.query('revoke all on public._migraciones from anon, authenticated');

const { rows: aplicadas } = await cliente.query(
  'select version, sha256, aplicada_en, baseline from public._migraciones'
);
const yaEsta = new Map(aplicadas.map((r) => [r.version, r]));

// ------------------------------------------------------------------ informe

console.log(`\nMigraciones en ${CARPETA}\n`);

const pendientes = [];
const alteradas = [];

for (const m of enDisco) {
  const previa = yaEsta.get(m.version);
  if (!previa) {
    pendientes.push(m);
    console.log(`  pendiente   ${m.version}`);
  } else if (previa.sha256 !== m.sha) {
    alteradas.push(m);
    console.log(`  ALTERADA    ${m.version}  (el archivo cambió después de aplicarse)`);
  } else {
    const marca = previa.baseline ? 'baseline  ' : 'aplicada  ';
    console.log(`  ${marca}  ${m.version}`);
  }
}

const huerfanas = [...yaEsta.keys()].filter((v) => !enDisco.some((m) => m.version === v));
for (const v of huerfanas) console.log(`  HUÉRFANA    ${v}  (registrada, pero el archivo ya no está)`);

if (soloEstado) {
  console.log(`\n${pendientes.length} pendiente(s), ${alteradas.length} alterada(s).\n`);
  await cliente.end();
  process.exit(alteradas.length > 0 ? 1 : 0);
}

if (alteradas.length > 0 && !forzar && !baseline) {
  console.error(
    '\nHay migraciones ya aplicadas cuyo archivo cambió.\n' +
      'Lo correcto es crear una migración nueva, no editar una vieja.\n' +
      'Si sabes lo que haces y el SQL es idempotente: --forzar\n'
  );
  await cliente.end();
  process.exit(1);
}

// ------------------------------------------------------------------ baseline

if (baseline) {
  const cubiertas = hasta
    ? enDisco.filter((m) => m.version.slice(0, hasta.length) <= hasta)
    : enDisco;

  for (const m of cubiertas) {
    await cliente.query(
      `insert into public._migraciones (version, sha256, duracion_ms, baseline)
       values ($1, $2, 0, true)
       on conflict (version) do update set sha256 = excluded.sha256, baseline = true`,
      [m.version, m.sha]
    );
  }
  const restantes = enDisco.length - cubiertas.length;
  console.log(`\n${cubiertas.length} migración(es) marcadas como aplicadas SIN ejecutarlas.`);
  if (restantes > 0) {
    console.log(`Quedan ${restantes} por aplicar de verdad: corre el script otra vez sin --baseline.`);
  } else {
    console.log('A partir de ahora solo corre lo que agregues nuevo.');
  }
  console.log('');
  await cliente.end();
  process.exit(0);
}

// ------------------------------------------------------------------- aplicar

const aCorrer = forzar ? [...pendientes, ...alteradas].sort((a, b) => a.version.localeCompare(b.version)) : pendientes;

if (aCorrer.length === 0) {
  console.log('\nNada que aplicar: la base está al día.\n');
  await cliente.end();
  process.exit(0);
}

console.log('');

for (const m of aCorrer) {
  process.stdout.write(`  aplicando   ${m.version} ... \n`);
  const inicio = process.hrtime.bigint();

  try {
    await cliente.query('begin');
    await cliente.query(m.sql);
    const ms = Number((process.hrtime.bigint() - inicio) / 1000000n);
    await cliente.query(
      `insert into public._migraciones (version, sha256, duracion_ms, baseline)
       values ($1, $2, $3, false)
       on conflict (version) do update
         set sha256 = excluded.sha256, duracion_ms = excluded.duracion_ms,
             aplicada_en = now(), baseline = false`,
      [m.version, m.sha, ms]
    );
    await cliente.query('commit');
    console.log(`     listo (${ms} ms)`);
  } catch (e) {
    await cliente.query('rollback');
    console.error(`\n  ${m.version} falló y se deshizo entera:\n    ${e.message}\n`);
    if (e.position) {
      const previo = m.sql.slice(0, Number(e.position));
      console.error(`    (línea ${previo.split('\n').length} del archivo)\n`);
    }
    await cliente.end();
    process.exit(1);
  }
}

// PostgREST cachea el esquema: sin esto, una función nueva da 404 hasta que se recarga sola.
await cliente.query("notify pgrst, 'reload schema'");

console.log(`\n${aCorrer.length} migración(es) aplicadas. Esquema de la API recargado.\n`);
await cliente.end();
