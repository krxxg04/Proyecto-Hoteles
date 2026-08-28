import {
  permisoDeSubida,
  urlFirmada,
  listarMediosDe,
  borrarMedio,
} from '@/modules/medios/application/medios';
import { intentar, cuerpo } from '@/shared/http';
import { fallo } from '@/shared/resultado';

/** GET /api/medios?id=...  o  ?huesped_id=...  o  ?estadia_id=... */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;

  const id = q.get('id');
  if (id) return intentar(() => urlFirmada(id));

  const huesped = q.get('huesped_id');
  if (huesped) return intentar(() => listarMediosDe('huesped_id', huesped));

  const estadia = q.get('estadia_id');
  if (estadia) return intentar(() => listarMediosDe('estadia_id', estadia));

  return intentar(async () => fallo('Indica id, huesped_id o estadia_id.'));
}

/**
 * POST /api/medios -> { tipo, mime, bytes, huesped_id?, estadia_id?, consentimiento? }
 *
 * Devuelve un permiso de subida. El archivo NO pasa por aquí: el navegador hace el PUT
 * directo a R2 con la URL firmada.
 */
export async function POST(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => permisoDeSubida(body as never));
}

/** DELETE /api/medios -> { id }. Borra el objeto y la fila (derecho de supresión). */
export async function DELETE(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => borrarMedio(String(body.id)));
}
