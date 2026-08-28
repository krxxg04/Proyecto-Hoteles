import { pedirCliente } from '@/shared/api/navegador';
import type { Resultado } from '@/shared/api/contrato';
import type { EstadoReserva, Reserva } from '../domain/tipos';

export async function guardarReserva(entrada: Record<string, unknown>): Promise<Resultado<Reserva>> {
  return pedirCliente<Reserva>('/api/reservas', { metodo: 'POST', cuerpo: entrada });
}

export async function cambiarEstadoReserva(
  reserva_id: string,
  estado: EstadoReserva
): Promise<Resultado<null>> {
  return pedirCliente<null>('/api/reservas', {
    metodo: 'PATCH',
    cuerpo: { reserva_id, estado },
  });
}
