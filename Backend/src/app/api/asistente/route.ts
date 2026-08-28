import { interpretar, ejecutar } from '@/modules/asistente/application/asistente';
import { intentar, cuerpo } from '@/shared/http';
import type { ContextoConversacion, TarjetaAccion } from '@/modules/asistente/domain/tarjeta';

/** POST /api/asistente -> { texto, contexto? } interpreta; devuelve tarjeta o pregunta. */
export async function POST(request: Request) {
  const body = await cuerpo(request);
  return intentar(() =>
    interpretar(String(body.texto ?? ''), body.contexto as ContextoConversacion | undefined)
  );
}

/** PUT /api/asistente -> ejecuta una tarjeta ya confirmada por una persona. */
export async function PUT(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => ejecutar(body.tarjeta as TarjetaAccion));
}
