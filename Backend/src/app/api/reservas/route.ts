import {
  listarReservas,
  guardarReserva,
  cambiarEstadoReserva,
} from '@/modules/reservas/application/reservas';
import { intentar, cuerpo } from '@/shared/http';

/** GET /api/reservas?todas=1 -> las próximas; con `todas`, también las cerradas. */
export async function GET(request: Request) {
  const todas = new URL(request.url).searchParams.get('todas');
  return intentar(() => listarReservas(!!todas));
}

/** POST /api/reservas -> alta o edición si viene `id`. */
export async function POST(request: Request) {
  const body = await cuerpo(request);
  const { id, ...resto } = body as { id?: string };
  return intentar(() => guardarReserva(resto as never, id));
}

/** PATCH /api/reservas -> { reserva_id, estado } confirmar, cancelar o no-show. */
export async function PATCH(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => cambiarEstadoReserva(body as never));
}
