import { listarAseoPendiente, enviarAAseo, marcarAseoListo } from '@/modules/inventario/application/aseo';
import { intentar, cuerpo } from '@/shared/http';

/** GET /api/aseo -> lo que está en lavandería. */
export async function GET() {
  return intentar(() => listarAseoPendiente());
}

/** POST /api/aseo -> { producto_id, cantidad?, cuarto_id? } manda a lavar. */
export async function POST(request: Request) {
  const body = await cuerpo(request);
  return intentar(() =>
    enviarAAseo(
      String(body.producto_id),
      Number(body.cantidad ?? 1),
      body.cuarto_id ? String(body.cuarto_id) : undefined
    )
  );
}

/** PATCH /api/aseo -> { aseo_id } volvió de lavandería. */
export async function PATCH(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => marcarAseoListo(String(body.aseo_id)));
}
