import {
  plantillaInspeccion,
  listarInspecciones,
  guardarInspeccion,
} from '@/modules/estadias/application/inspecciones';
import { intentar, cuerpo } from '@/shared/http';

/** GET /api/inspecciones?cuarto_id=...&plantilla=1 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cuartoId = url.searchParams.get('cuarto_id');

  if (url.searchParams.get('plantilla')) {
    if (!cuartoId) return intentar(async () => ({ ok: false, error: 'Falta cuarto_id.' }));
    return intentar(() => plantillaInspeccion(cuartoId));
  }

  return intentar(() => listarInspecciones(cuartoId ?? undefined));
}

/** POST /api/inspecciones -> { cuarto_id, estadia_id?, resultado[], nota?, pasar_a_limpieza? } */
export async function POST(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => guardarInspeccion(body as never));
}
