import { registrarCheckin, registrarCheckout, estadiasActivas } from '@/modules/estadias/application/estadias';
import { intentar, cuerpo } from '@/shared/http';

/** GET /api/checkin -> estadías en curso */
export async function GET() {
  return intentar(() => estadiasActivas());
}

/** POST /api/checkin -> asistente de check-in completo */
export async function POST(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => registrarCheckin(body as never));
}

/** DELETE /api/checkin -> { estadia_id } (check-out) */
export async function DELETE(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => registrarCheckout(String(body.estadia_id)));
}
