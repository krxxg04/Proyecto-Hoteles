import {
  listarProductos,
  guardarProducto,
  desactivarProducto,
} from '@/modules/inventario/application/catalogo';
import { intentar, cuerpo } from '@/shared/http';

/** GET /api/productos?vendibles=1 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  return intentar(() => listarProductos(!!url.searchParams.get('vendibles')));
}

/** POST /api/productos -> alta o edición (solo administrador). Con `id` edita; sin `id` crea. */
export async function POST(request: Request) {
  const body = await cuerpo(request);
  const { id, ...resto } = body as { id?: string };
  return intentar(() => guardarProducto(resto as never, id));
}

/** DELETE /api/productos -> { id }. Baja lógica: el kardex sigue apuntando al producto. */
export async function DELETE(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => desactivarProducto(String(body.id)));
}
