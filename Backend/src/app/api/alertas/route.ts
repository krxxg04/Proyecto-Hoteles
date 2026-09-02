import { listarAlertas, atenderAlerta } from '@/modules/caja/application/gastos';
import { intentar, cuerpo } from '@/shared/http';

/** GET /api/alertas -> las sin atender. `?todas=1` incluye las ya atendidas. */
export async function GET(request: Request) {
  const todas = !!new URL(request.url).searchParams.get('todas');
  return intentar(() => listarAlertas(!todas));
}

/** PATCH /api/alertas -> { id }. Marca que una persona la revisó. */
export async function PATCH(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => atenderAlerta(String(body.id)));
}
