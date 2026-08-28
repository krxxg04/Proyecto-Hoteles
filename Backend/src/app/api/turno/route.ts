import { estadoCaja, abrirTurno, cerrarTurno, conteoEsperado } from '@/modules/caja/application/turnos';
import { intentar, cuerpo } from '@/shared/http';

/** GET /api/turno?conteo=1 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('conteo')) return intentar(() => conteoEsperado());
  return intentar(() => estadoCaja());
}

/** POST /api/turno -> { efectivo_contado, justificacion? } */
export async function POST(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => abrirTurno(body as never));
}

/** PUT /api/turno -> { conteos[], sencillo_dejar, ajuste_monto?, ajuste_razon? } */
export async function PUT(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => cerrarTurno(body as never));
}
