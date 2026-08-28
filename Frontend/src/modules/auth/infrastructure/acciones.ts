import { pedirCliente } from '@/shared/api/navegador';
import type { Resultado } from '@/shared/api/contrato';
import type { Sesion } from '@/shared/dominio/tipos';

export async function iniciarSesion(entrada: {
  dni: string;
  pin: string;
}): Promise<Resultado<Sesion>> {
  return pedirCliente<Sesion>('/api/auth', { metodo: 'POST', cuerpo: entrada });
}
