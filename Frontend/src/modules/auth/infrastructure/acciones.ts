import { pedirCliente } from '@/shared/api/navegador';
import type { Resultado } from '@/shared/api/contrato';
import type { Sesion } from '@/shared/dominio/tipos';

export async function iniciarSesion(entrada: {
  dni: string;
  pin: string;
  /** Solo hace falta si el mismo DNI trabaja en más de un hostal. */
  hostal?: string;
}): Promise<Resultado<Sesion>> {
  return pedirCliente<Sesion>('/api/auth', { metodo: 'POST', cuerpo: entrada });
}

/** Cambiar el PIN propio. Exige el actual: una tablet abierta no basta para secuestrar la cuenta. */
export async function cambiarMiPin(entrada: {
  pinActual: string;
  pinNuevo: string;
}): Promise<Resultado<null>> {
  return pedirCliente<null>('/api/auth', { metodo: 'PATCH', cuerpo: entrada });
}
