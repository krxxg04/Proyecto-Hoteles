import { registrarGasto, listarGastos } from '@/modules/caja/application/gastos';
import { intentar, cuerpo } from '@/shared/http';

/** GET /api/gastos -> los del turno abierto. `?todos=1` para el histórico. */
export async function GET(request: Request) {
  const todos = !!new URL(request.url).searchParams.get('todos');
  return intentar(() => listarGastos(!todos));
}

/**
 * POST /api/gastos -> { categoria, monto, medio, ... }
 *
 *   fijo         + producto_id + cantidad          descuenta de caja y llena inventario
 *   justificable + concepto + justificacion        descuenta de caja y deja alerta
 */
export async function POST(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => registrarGasto(body as never));
}
