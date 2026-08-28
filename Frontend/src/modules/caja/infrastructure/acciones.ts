import { pedirCliente } from '@/shared/api/navegador';
import type { Resultado } from '@/shared/api/contrato';
import type { LineaConteo, ResumenCierre } from '../domain/tipos';

export async function abrirTurno(entrada: {
  efectivo_contado: number;
  justificacion?: string;
}): Promise<Resultado<{ turno_id: string }>> {
  return pedirCliente<{ turno_id: string }>('/api/turno', { metodo: 'POST', cuerpo: entrada });
}

/** Lo que debería haber, para contrastarlo con el conteo real. */
export async function conteoEsperado(): Promise<Resultado<LineaConteo[]>> {
  return pedirCliente<LineaConteo[]>('/api/turno?conteo=1');
}

/** Un descuadre sin justificar aborta el cierre entero: lo impone la función SQL. */
export async function cerrarTurno(entrada: {
  conteos: Array<{ producto_id: string; contado: number; justificacion?: string }>;
  sencillo_dejar: number;
}): Promise<Resultado<ResumenCierre>> {
  return pedirCliente<ResumenCierre>('/api/turno', { metodo: 'PUT', cuerpo: entrada });
}

export async function revisarIncidencia(incidencia_id: string): Promise<Resultado<null>> {
  return pedirCliente<null>('/api/incidencias', { metodo: 'PATCH', cuerpo: { incidencia_id } });
}
