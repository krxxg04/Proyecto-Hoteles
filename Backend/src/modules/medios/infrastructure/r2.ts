import 'server-only';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Cloudflare R2. Es S3-compatible, así que se habla con el SDK de S3 apuntando al
 * endpoint de la cuenta.
 *
 * Gate #3 de CLAUDE.md: **el bucket es privado**. Nada de aquí devuelve una URL
 * permanente — solo URLs firmadas que caducan en minutos. Si algún día alguien
 * necesita una URL fija, la respuesta es no.
 *
 * Las claves viven solo en el servidor: este archivo importa `server-only`, así que
 * el build falla si alguien lo importa desde un componente de cliente.
 */

const CUENTA = process.env.R2_ACCOUNT_ID;
const CLAVE = process.env.R2_ACCESS_KEY_ID;
const SECRETO = process.env.R2_SECRET_ACCESS_KEY;

export const BUCKET = process.env.R2_BUCKET ?? 'hostal-privado';

/** Corta: una URL de subida que dure una hora es una hora de ventana para un tercero. */
export const SEGUNDOS_SUBIDA = 120;
export const SEGUNDOS_LECTURA = 300;

export function r2Configurado(): boolean {
  return !!(CUENTA && CLAVE && SECRETO);
}

let cliente: S3Client | null = null;

function s3(): S3Client {
  if (!r2Configurado()) {
    throw new Error(
      'Falta configurar Cloudflare R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).'
    );
  }

  cliente ??= new S3Client({
    region: 'auto',
    endpoint: `https://${CUENTA}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: CLAVE!, secretAccessKey: SECRETO! },
  });

  return cliente;
}

/**
 * URL firmada para SUBIR un objeto concreto.
 *
 * Se firman también el tipo y el tamaño: sin eso, la URL sirve para subir cualquier
 * cosa de cualquier peso, y el bucket deja de ser nuestro.
 */
export function urlDeSubida(objectKey: string, mime: string, bytes: number) {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
      ContentType: mime,
      ContentLength: bytes,
    }),
    { expiresIn: SEGUNDOS_SUBIDA }
  );
}

/** URL firmada para LEER. Caduca en minutos: no vale para pegarla en un correo. */
export function urlDeLectura(objectKey: string) {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: BUCKET, Key: objectKey }), {
    expiresIn: SEGUNDOS_LECTURA,
  });
}

/** Borrado real del objeto. Lo exige el derecho de supresión de la Ley 29733. */
export async function borrarObjeto(objectKey: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: objectKey }));
}
