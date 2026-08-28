import { listarIncidencias, revisarIncidencia } from '@/modules/caja/application/incidencias';
import { intentar, cuerpo } from '@/shared/http';

/** GET /api/incidencias?todas=1 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  return intentar(() => listarIncidencias(!url.searchParams.get('todas')));
}

/** PATCH /api/incidencias -> { incidencia_id } marca como revisada. */
export async function PATCH(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => revisarIncidencia(String(body.incidencia_id)));
}
