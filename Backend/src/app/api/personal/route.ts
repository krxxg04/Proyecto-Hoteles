import { listarPersonal, crearPersona, desactivarPersona } from '@/modules/personal/application/personal';
import { intentar, cuerpo } from '@/shared/http';

/** GET /api/personal -> el equipo del hostal (solo administrador). */
export async function GET() {
  return intentar(() => listarPersonal());
}

/** POST /api/personal -> alta de una persona con DNI, rol y PIN. */
export async function POST(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => crearPersona(body as never));
}

/** DELETE /api/personal -> { persona_id } baja lógica. */
export async function DELETE(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => desactivarPersona(String(body.persona_id)));
}
