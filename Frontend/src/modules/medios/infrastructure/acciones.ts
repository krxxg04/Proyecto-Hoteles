import { pedirCliente } from '@/shared/api/navegador';
import type { Resultado } from '@/shared/api/contrato';
import type { PermisoDeSubida, TipoMedio } from '../domain/tipos';

/**
 * Pipeline de fotos de `ai-media.md`: comprimir a ~150 KB y subir a R2 con URL firmada.
 *
 * La compresión ocurre AQUÍ, en el navegador, no en el servidor. Una foto de móvil son
 * 4 MB; subirla entera por el wifi del hostal para encogerla después sería pagar el
 * ancho de banda dos veces y hacer esperar a quien está en el mostrador.
 */

/** ai-media.md: ~150 KB. Es un objetivo, no un límite duro: se baja calidad hasta acercarse. */
const OBJETIVO_BYTES = 150 * 1024;

/** Suficiente para leer un DNI o ver que falta una toalla. Más solo pesa. */
const LADO_MAXIMO = 1600;

const CALIDADES = [0.82, 0.7, 0.58, 0.45, 0.34];

async function aBitmap(archivo: File): Promise<ImageBitmap> {
  // `createImageBitmap` respeta la orientación EXIF; sin eso, las fotos de móvil salen tumbadas.
  return createImageBitmap(archivo, { imageOrientation: 'from-image' });
}

function aBlob(lienzo: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((resolver) => lienzo.toBlob(resolver, tipo, calidad));
}

/**
 * Reduce la foto hasta acercarse al objetivo. Devuelve el mejor intento aunque no llegue:
 * una foto de 200 KB sirve; no tener foto, no.
 */
export async function comprimir(archivo: File): Promise<{ blob: Blob; mime: string }> {
  const bitmap = await aBitmap(archivo);

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;

  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no pudo procesar la imagen.');
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  // WebP pesa bastante menos que JPEG a la misma calidad y lo entienden todos los navegadores
  // que soportan PWA. Si fallara, queda JPEG.
  const mime = lienzo.toDataURL('image/webp').startsWith('data:image/webp')
    ? 'image/webp'
    : 'image/jpeg';

  let mejor: Blob | null = null;

  for (const calidad of CALIDADES) {
    const blob = await aBlob(lienzo, mime, calidad);
    if (!blob) continue;
    mejor = blob;
    if (blob.size <= OBJETIVO_BYTES) break;
  }

  if (!mejor) throw new Error('No se pudo comprimir la imagen.');
  return { blob: mejor, mime };
}

async function pedirPermiso(entrada: {
  tipo: TipoMedio;
  mime: string;
  bytes: number;
  huesped_id?: string | null;
  estadia_id?: string | null;
  consentimiento?: string;
}): Promise<Resultado<PermisoDeSubida>> {
  return pedirCliente<PermisoDeSubida>('/api/medios', { metodo: 'POST', cuerpo: entrada });
}

/**
 * Comprime, pide el permiso y sube directo a R2.
 *
 * El PUT va al bucket, no al backend: por eso este `fetch` es el único de la app que no
 * pasa por `pedirCliente`. Sin `credentials`, que mandaría la cookie de sesión a
 * Cloudflare sin ninguna razón.
 */
export async function subirFoto(
  archivo: File,
  datos: {
    tipo: TipoMedio;
    huesped_id?: string | null;
    estadia_id?: string | null;
    consentimiento?: string;
  }
): Promise<Resultado<{ medio_id: string }>> {
  let comprimida: { blob: Blob; mime: string };
  try {
    comprimida = await comprimir(archivo);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo preparar la imagen.' };
  }

  const permiso = await pedirPermiso({
    ...datos,
    mime: comprimida.mime,
    bytes: comprimida.blob.size,
  });
  if (!permiso.ok) return permiso;

  /**
   * La fila en `medios` ya existe: se crea antes de firmar, porque la llave del objeto
   * sale de ella. Si el PUT falla, hay que retirarla o queda apuntando a un archivo que
   * nunca llegó a existir.
   */
  const deshacer = async () => {
    await pedirCliente('/api/medios', { metodo: 'DELETE', cuerpo: { id: permiso.datos.medio_id } });
  };

  try {
    const r = await fetch(permiso.datos.url, {
      method: permiso.datos.metodo,
      headers: permiso.datos.cabeceras,
      body: comprimida.blob,
    });
    if (!r.ok) {
      await deshacer();
      return { ok: false, error: `El almacenamiento rechazó la subida (${r.status}).` };
    }
  } catch {
    await deshacer();
    return { ok: false, error: 'No se pudo subir la foto. Revisa la conexión e inténtalo de nuevo.' };
  }

  return { ok: true, datos: { medio_id: permiso.datos.medio_id } };
}

/** URL firmada para ver una foto. Caduca en minutos: no vale guardarla. */
export async function urlDeFoto(
  medioId: string
): Promise<Resultado<{ url: string; expira_en_segundos: number; tipo: string }>> {
  return pedirCliente(`/api/medios?id=${medioId}`);
}
