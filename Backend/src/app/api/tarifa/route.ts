import { cotizarEstadia } from '@/modules/cuartos/application/tarifario';
import { intentar } from '@/shared/http';
import { fallo } from '@/shared/resultado';
import type { ModoEstadia } from '@/modules/estadias/domain/tipos';

/**
 * GET /api/tarifa?cuarto_id=...&modo=rango&noches=2 -> cuánto costaría.
 *
 * Solo cotiza: no escribe nada. El precio del check-in lo vuelve a calcular la base
 * al ejecutarlo, así que este número es para mostrar, nunca para cobrar.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const cuartoId = q.get('cuarto_id');
  const modo = q.get('modo') as ModoEstadia | null;

  if (!cuartoId || !modo) return intentar(async () => fallo('Faltan cuarto_id y modo.'));

  const numero = (n: string | null) => (n ? Number(n) : null);

  return intentar(() =>
    cotizarEstadia({
      cuarto_id: cuartoId,
      modo,
      horas: numero(q.get('horas')),
      noches: numero(q.get('noches')),
      fecha_entrada: q.get('fecha_entrada') ?? undefined,
    })
  );
}
