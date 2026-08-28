import { listarHuespedes, crearHuesped } from '@/modules/huespedes/application/huespedes';
import { intentar, cuerpo } from '@/shared/http';

/** GET /api/huespedes?q=carlos */
export async function GET(request: Request) {
  const url = new URL(request.url);
  return intentar(() => listarHuespedes(url.searchParams.get('q') ?? undefined));
}

/** POST /api/huespedes -> registro de persona */
export async function POST(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => crearHuesped(body as never));
}
