import { pedirCliente } from '@/shared/api/navegador';
import type { Resultado } from '@/shared/api/contrato';
import type { MedioPago } from '@/shared/dominio/tipos';
import type { CategoriaGasto, LineaConteo, ResumenCierre } from '../domain/tipos';

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

/**
 * Un descuadre sin justificar aborta el cierre entero: lo impone la función SQL, y ahora
 * también vale para el dinero, no solo para el inventario.
 */
export async function cerrarTurno(entrada: {
  conteos: Array<{ producto_id: string; contado: number; justificacion?: string }>;
  efectivo_contado: number;
  justificacion_caja?: string | null;
}): Promise<Resultado<ResumenCierre>> {
  return pedirCliente<ResumenCierre>('/api/turno', { metodo: 'PUT', cuerpo: entrada });
}

export async function revisarIncidencia(incidencia_id: string): Promise<Resultado<null>> {
  return pedirCliente<null>('/api/incidencias', { metodo: 'PATCH', cuerpo: { incidencia_id } });
}

/**
 * Un gasto de la caja.
 *
 *   fijo         + producto_id + cantidad     descuenta de la caja Y llena el inventario
 *   justificable + concepto + justificacion   descuenta de la caja y deja alerta
 */
export async function registrarGasto(entrada: {
  categoria: CategoriaGasto;
  concepto?: string;
  monto: number;
  medio?: MedioPago;
  producto_id?: string | null;
  cantidad?: number | null;
  justificacion?: string | null;
}): Promise<Resultado<{ gasto_id: string }>> {
  return pedirCliente('/api/gastos', { metodo: 'POST', cuerpo: entrada });
}

/** «Atendida» significa que una persona la miró y decidió. */
export async function atenderAlerta(id: string): Promise<Resultado<null>> {
  return pedirCliente<null>('/api/alertas', { metodo: 'PATCH', cuerpo: { id } });
}
