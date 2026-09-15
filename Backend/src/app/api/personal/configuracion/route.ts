import {
  obtenerConfiguracionPersonal,
  establecerLimpiezaHabilitada,
} from '@/modules/personal/application/personal';
import { intentar, cuerpo } from '@/shared/http';

/** GET /api/personal/configuracion -> { limpiezaHabilitada } (solo administrador). */
export async function GET() {
  return intentar(() => obtenerConfiguracionPersonal());
}

/** PATCH /api/personal/configuracion -> { limpiezaHabilitada } prende o apaga el cargo. */
export async function PATCH(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => establecerLimpiezaHabilitada(Boolean(body.limpiezaHabilitada)));
}
