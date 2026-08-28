import { pedir } from '@/shared/api/servidor';
import type { Resultado } from '@/shared/api/contrato';
import type { EstadoCaja, Incidencia, ResumenVentas } from '../domain/tipos';

export async function estadoCaja(): Promise<Resultado<EstadoCaja>> {
  return pedir<EstadoCaja>('/api/turno');
}

export async function resumenVentasTurno(): Promise<Resultado<ResumenVentas>> {
  return pedir<ResumenVentas>('/api/ventas?resumen=1');
}

export async function listarIncidencias(todas = false): Promise<Resultado<Incidencia[]>> {
  return pedir<Incidencia[]>(`/api/incidencias${todas ? '?todas=1' : ''}`);
}
