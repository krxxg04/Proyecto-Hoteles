import { pedir } from '@/shared/api/servidor';
import type { Resultado } from '@/shared/api/contrato';
import type { Alerta, EstadoCaja, Gasto, Incidencia, ResumenVentas } from '../domain/tipos';

export async function estadoCaja(): Promise<Resultado<EstadoCaja>> {
  return pedir<EstadoCaja>('/api/turno');
}

export async function resumenVentasTurno(): Promise<Resultado<ResumenVentas>> {
  return pedir<ResumenVentas>('/api/ventas?resumen=1');
}

export async function listarIncidencias(todas = false): Promise<Resultado<Incidencia[]>> {
  return pedir<Incidencia[]>(`/api/incidencias${todas ? '?todas=1' : ''}`);
}

/** Los gastos del turno abierto. `todos` trae el histórico. */
export async function listarGastos(todos = false): Promise<Resultado<Gasto[]>> {
  return pedir<Gasto[]>(`/api/gastos${todos ? '?todos=1' : ''}`);
}

/** Las alertas del sistema. La tabla existía desde el principio y nadie la leía. */
export async function listarAlertas(todas = false): Promise<Resultado<Alerta[]>> {
  return pedir<Alerta[]>(`/api/alertas${todas ? '?todas=1' : ''}`);
}
