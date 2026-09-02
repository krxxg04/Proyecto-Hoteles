import {
  listarPersonal,
  crearPersona,
  desactivarPersona,
  reiniciarPin,
} from '@/modules/personal/application/personal';
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

/**
 * PATCH /api/personal -> { persona_id, pin } reinicia el PIN de alguien.
 *
 * `reiniciarPin` existía sin ruta, así que un administrador no podía reiniciarle el PIN a
 * nadie desde la app. Queda marcado como temporal: la persona lo cambia al entrar.
 */
export async function PATCH(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => reiniciarPin(String(body.persona_id), String(body.pin)));
}

/** DELETE /api/personal -> { persona_id } baja lógica. */
export async function DELETE(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => desactivarPersona(String(body.persona_id)));
}
