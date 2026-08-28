import { listarVentas, registrarVenta, resumenVentasTurno } from '@/modules/ventas/application/ventas';
import { intentar, cuerpo } from '@/shared/http';

/** GET /api/ventas?resumen=1 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('resumen')) return intentar(() => resumenVentasTurno());
  return intentar(() => listarVentas(url.searchParams.get('turno') ?? undefined));
}

/** POST /api/ventas -> { producto_id, cantidad, cuarto_id?, medio, banco? } */
export async function POST(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => registrarVenta(body as never));
}
