import { spawn } from 'node:child_process';

const requeridas = [
  'DEMO_HOSTAL_NOMBRE',
  'DEMO_HOSTAL_SLUG',
  'DEMO_ADMIN_DNI',
  'DEMO_ADMIN_NOMBRE',
  'DEMO_ADMIN_PIN',
];

const faltantes = requeridas.filter((clave) => !process.env[clave]);

if (faltantes.length) {
  console.error(
    'Faltan variables para inicializar la demo: ' + faltantes.join(', ')
  );
  process.exit(1);
}

function correr(script, args) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(process.execPath, [script, ...args], {
      stdio: 'inherit',
      env: process.env,
    });

    hijo.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} terminó con código ${code ?? 'desconocido'}`));
    });

    hijo.on('error', reject);
  });
}

const slug = process.env.DEMO_HOSTAL_SLUG;

await correr('scripts/bootstrap.mjs', [
  '--hostal', process.env.DEMO_HOSTAL_NOMBRE,
  '--slug', slug,
  '--ciudad', process.env.DEMO_HOSTAL_CIUDAD ?? 'Lima',
  '--dni', process.env.DEMO_ADMIN_DNI,
  '--nombre', process.env.DEMO_ADMIN_NOMBRE,
  '--pin', process.env.DEMO_ADMIN_PIN,
]);

const seedArgs = ['--slug', slug];
if (process.env.DEMO_RESEED === '1') {
  seedArgs.push('--limpiar');
}

await correr('scripts/seed.mjs', seedArgs);

