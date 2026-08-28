import { pedir } from '@/shared/api/servidor';
import type { Resultado } from '@/shared/api/contrato';
import type { Reserva } from '../domain/tipos';

export async function listarReservas(todas = false): Promise<Resultado<Reserva[]>> {
  return pedir<Reserva[]>(`/api/reservas${todas ? '?todas=1' : ''}`);
}
