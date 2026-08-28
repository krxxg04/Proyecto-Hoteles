import { pedirCliente } from '@/shared/api/navegador';
import type { Resultado } from '@/shared/api/contrato';
import type { DetalleCuarto, EstadoCuarto, TipoCuarto } from '../domain/tipos';

/** Acciones desde el navegador. */
export async function cambiarEstadoCuarto(entrada: {
  cuarto_id: string;
  estado: EstadoCuarto;
  nota?: string;
}): Promise<Resultado<null>> {
  return pedirCliente<null>('/api/cuartos', { metodo: 'PATCH', cuerpo: entrada });
}

/** El detalle que llena el panel lateral. Se pide al abrirlo, no antes. */
export async function detalleCuarto(id: string): Promise<Resultado<DetalleCuarto>> {
  return pedirCliente<DetalleCuarto>(`/api/cuartos?id=${id}`);
}

/** Cambiar el tarifario. Solo administrador: el RLS de `tipos_cuarto` lo impone. */
export async function guardarTipoCuarto(entrada: Partial<TipoCuarto>): Promise<Resultado<TipoCuarto>> {
  return pedirCliente<TipoCuarto>('/api/cuartos', { metodo: 'PUT', cuerpo: entrada });
}
