import { pedirCliente } from '@/shared/api/navegador';
import type { Resultado } from '@/shared/api/contrato';
import type {
  CuartoSugerido,
  DetalleTarifa,
  EntradaCheckin,
  ItemInspeccion,
  ModoEstadia,
  ResultadoCheckin,
} from '../domain/tipos';

/** Acciones desde el navegador. */

export async function registrarCheckin(entrada: EntradaCheckin): Promise<Resultado<ResultadoCheckin>> {
  return pedirCliente<ResultadoCheckin>('/api/checkin', { metodo: 'POST', cuerpo: entrada });
}

export async function registrarCheckout(estadiaId: string): Promise<Resultado<null>> {
  return pedirCliente<null>('/api/checkin', { metodo: 'DELETE', cuerpo: { estadia_id: estadiaId } });
}

/**
 * Cuánto costaría. Es solo para mostrar: al ejecutar el check-in, la base vuelve a
 * calcular el precio desde el tarifario y ese es el que se cobra.
 */
export async function cotizar(params: {
  cuarto_id: string;
  modo: ModoEstadia;
  horas?: number | null;
  noches?: number | null;
  fecha_entrada?: string;
}): Promise<Resultado<DetalleTarifa>> {
  const q = new URLSearchParams({ cuarto_id: params.cuarto_id, modo: params.modo });
  if (params.horas) q.set('horas', String(params.horas));
  if (params.noches) q.set('noches', String(params.noches));
  if (params.fecha_entrada) q.set('fecha_entrada', params.fecha_entrada);

  return pedirCliente<DetalleTarifa>(`/api/tarifa?${q}`);
}

export async function sugerirCuartos(
  personas: number,
  caracteristicas: string[] = []
): Promise<Resultado<CuartoSugerido[]>> {
  const q = new URLSearchParams({ sugerir: '1', personas: String(personas) });
  if (caracteristicas.length) q.set('caracteristicas', caracteristicas.join(','));

  return pedirCliente<CuartoSugerido[]>(`/api/cuartos?${q}`);
}

export async function guardarInspeccion(entrada: {
  cuarto_id: string;
  estadia_id?: string | null;
  resultado: ItemInspeccion[];
  nota?: string;
  medio_id?: string | null;
  pasar_a_limpieza?: boolean;
}): Promise<Resultado<{ id: string; faltantes: number }>> {
  return pedirCliente<{ id: string; faltantes: number }>('/api/inspecciones', {
    metodo: 'POST',
    cuerpo: entrada,
  });
}
