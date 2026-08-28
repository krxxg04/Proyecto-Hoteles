import { listarProductos, guardarProducto } from '@/modules/inventario/application/catalogo';
import { intentar, cuerpo } from '@/shared/http';

/** GET /api/productos?vendibles=1 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  return intentar(() => listarProductos(!!url.searchParams.get('vendibles')));
}

/** POST /api/productos -> alta de producto (solo administrador) */
export async function POST(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => guardarProducto(body as never));
}
