/**
 * Borra las fotos cuya fecha de retención ya pasó.
 *
 * La Ley 29733 no pide solo consentimiento: pide conservar el dato el tiempo necesario
 * y borrarlo después. Guardar la foto del DNI de alguien que estuvo dos noches hace tres
 * años no tiene defensa posible.
 *
 * Cada tipo tiene su plazo en `src/modules/medios/domain/tipos.ts`; la fecha ya viene
 * calculada en `medios.retener_hasta` desde que se sube.
 *
 * Pensado para correr una vez al día (cron de Cloudflare, tarea programada, lo que sea).
 *
 * Uso:
 *   node --env-file=.env.local scripts/purgar-medios.mjs
 *   node --env-file=.env.local scripts/purgar-medios.mjs --simular   solo dice qué borraría
 *
 * Usa `service_role` a propósito: el barrido es de TODOS los hostales, así que no puede
 * pasar por el RLS de ninguno. Por eso vive en la terminal y nunca en una ruta HTTP.
 */

import { createClient } from '@supabase/supabase-js';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

const simular = process.argv.includes('--simular');

const { NEXT_PUBLIC_SUPABASE_URL: URL_SB, SUPABASE_SERVICE_ROLE_KEY: SERVICE } = process.env;
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;

if (!URL_SB || !SERVICE) {
  console.error('\nFaltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n');
  process.exit(1);
}

if (!simular && !(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY)) {
  console.error('\nFaltan las claves de Cloudflare R2. Con --simular puedes ver qué se borraría.\n');
  process.exit(1);
}

const admin = createClient(URL_SB, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { 'x-origen': 'sistema' } },
});

const { data: vencidos, error } = await admin
  .from('medios')
  .select('id, object_key, tipo, retener_hasta')
  .lt('retener_hasta', new Date().toISOString())
  .limit(1000);

if (error) {
  console.error('No se pudo consultar los medios:', error.message);
  process.exit(1);
}

if (!vencidos.length) {
  console.log('\nNada vencido. Todo lo guardado sigue dentro de su plazo.\n');
  process.exit(0);
}

console.log(`\n${vencidos.length} archivo(s) pasaron su fecha de retención.\n`);

if (simular) {
  for (const m of vencidos) {
    console.log(`  ${m.tipo.padEnd(11)} ${m.object_key}  (vencía ${m.retener_hasta.slice(0, 10)})`);
  }
  console.log('\nSimulación: no se borró nada.\n');
  process.exit(0);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const BUCKET = process.env.R2_BUCKET ?? 'hostal-privado';

let borrados = 0;

for (const m of vencidos) {
  try {
    // Primero el archivo. Si falla, la fila se queda y el siguiente barrido lo reintenta;
    // al revés quedaría un archivo que nadie sabe que existe.
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: m.object_key }));
  } catch (e) {
    console.error(`  no se pudo borrar ${m.object_key}: ${e.message}`);
    continue;
  }

  const { error: errorFila } = await admin.from('medios').delete().eq('id', m.id);
  if (errorFila) {
    console.error(`  archivo borrado pero la fila quedó: ${m.id} (${errorFila.message})`);
    continue;
  }
  borrados++;
}

console.log(`\n${borrados} de ${vencidos.length} borrados.\n`);
process.exit(borrados === vencidos.length ? 0 : 1);
