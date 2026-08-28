import {
  listarCuartos,
  conteoPorEstado,
  cambiarEstadoCuarto,
  obtenerCuarto,
} from '@/modules/cuartos/application/cuartos';
import {
  listarTiposCuarto,
  sugerirCuarto,
  guardarTipoCuarto,
} from '@/modules/cuartos/application/tarifario';
import { intentar, cuerpo } from '@/shared/http';
import type { EstadoCuarto } from '@/modules/cuartos/domain/tipos';

/** GET /api/cuartos?id=...&estado=lista&conteo=1&tipos=1&sugerir=1&personas=2 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  const id = url.searchParams.get('id');
  if (id) return intentar(() => obtenerCuarto(id));
  if (url.searchParams.get('tipos')) return intentar(() => listarTiposCuarto());
  if (url.searchParams.get('sugerir')) {
    const personas = Number(url.searchParams.get('personas') ?? 1);
    const caracteristicas = (url.searchParams.get('caracteristicas') ?? '')
      .split(',')
      .filter(Boolean);
    return intentar(() => sugerirCuarto(personas, caracteristicas));
  }
  if (url.searchParams.get('conteo')) return intentar(() => conteoPorEstado());
  const estado = url.searchParams.get('estado') as EstadoCuarto | null;
  return intentar(() => listarCuartos(estado ?? undefined));
}

/** PATCH /api/cuartos -> { cuarto_id, estado, nota? } */
export async function PATCH(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => cambiarEstadoCuarto(body as never));
}

/**
 * PUT /api/cuartos -> guardar un tipo de cuarto (el tarifario).
 *
 * Va aquí y no en una ruta propia porque el tarifario es la tarifa DE los cuartos: la
 * misma pantalla los edita. Solo administrador; el RLS de `tipos_cuarto` lo impone.
 */
export async function PUT(request: Request) {
  const body = await cuerpo(request);
  const { id, ...resto } = body as { id?: string };
  return intentar(() => guardarTipoCuarto(resto as never, id));
}
