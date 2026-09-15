import {
  listarAlertas,
  atenderAlerta,
  aprobarGastoRecurrente,
  descartarGastoRecurrente,
} from '@/modules/caja/application/gastos';
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

/**
 * POST /api/alertas -> { patron_id, decision: 'aprobar' | 'descartar' }.
 *
 * Solo para la alerta de "este gasto se repitió 5 veces": aprobar reclasifica lo ya
 * registrado como `otro` a `recurrente`; descartar solo cierra la alerta.
 */
export async function POST(request: Request) {
  const body = await cuerpo(request);
  const patronId = String(body.patron_id);

  return intentar(() =>
    body.decision === 'descartar'
      ? descartarGastoRecurrente(patronId)
      : aprobarGastoRecurrente(patronId)
  );
}
