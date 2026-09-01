import {
  listarCuartos,
  conteoPorEstado,
  cambiarEstadoCuarto,
  obtenerCuarto,
  guardarCuarto,
  desactivarCuarto,
  habilitarCuarto,
} from '@/modules/cuartos/application/cuartos';
import {
  listarTiposCuarto,
  sugerirCuarto,
  guardarTipoCuarto,
  cambiarActivoTipoCuarto,
} from '@/modules/cuartos/application/tarifario';
import { intentar, cuerpo } from '@/shared/http';
import type { EstadoCuarto } from '@/modules/cuartos/domain/tipos';

/** GET /api/cuartos?id=&estado=&conteo=1&tipos=1&sugerir=1&personas=2&inactivos=1 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const inactivos = !!url.searchParams.get('inactivos');

  const id = url.searchParams.get('id');
  if (id) return intentar(() => obtenerCuarto(id));
  if (url.searchParams.get('tipos')) return intentar(() => listarTiposCuarto(inactivos));
  if (url.searchParams.get('sugerir')) {
    const personas = Number(url.searchParams.get('personas') ?? 1);
    const caracteristicas = (url.searchParams.get('caracteristicas') ?? '')
      .split(',')
      .filter(Boolean);
    return intentar(() => sugerirCuarto(personas, caracteristicas));
  }
  if (url.searchParams.get('conteo')) return intentar(() => conteoPorEstado());
  const estado = url.searchParams.get('estado') as EstadoCuarto | null;
  return intentar(() => listarCuartos(estado ?? undefined, inactivos));
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

/** POST /api/cuartos -> alta o edición de un cuarto. Con `id` edita; sin `id` crea. */
export async function POST(request: Request) {
  const body = await cuerpo(request);
  const { id, ...resto } = body as { id?: string };
  return intentar(() => guardarCuarto(resto as never, id));
}

/**
 * DELETE /api/cuartos -> baja o alta lógica. Nada se borra: hay estadías y auditoría detrás.
 *
 *   { id }               baja un cuarto        { id, activo: true }        lo devuelve al servicio
 *   { tipo_id }          baja un tipo          { tipo_id, activo: true }   lo devuelve al tarifario
 */
export async function DELETE(request: Request) {
  const body = await cuerpo(request);
  const activo = body.activo === true;

  if (body.tipo_id) return intentar(() => cambiarActivoTipoCuarto(String(body.tipo_id), activo));
  if (activo) return intentar(() => habilitarCuarto(String(body.id)));
  return intentar(() => desactivarCuarto(String(body.id)));
}
