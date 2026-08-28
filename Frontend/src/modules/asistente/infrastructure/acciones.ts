import { pedirCliente } from '@/shared/api/navegador';
import type { Resultado } from '@/shared/api/contrato';
import type { ContextoConversacion, Interpretacion, TarjetaAccion } from '../domain/tipos';

export async function interpretar(
  texto: string,
  contexto?: ContextoConversacion
): Promise<Resultado<Interpretacion>> {
  return pedirCliente<Interpretacion>('/api/asistente', {
    metodo: 'POST',
    cuerpo: { texto, contexto },
  });
}

/** Ejecuta una tarjeta que una persona confirmó. El backend la revalida entera. */
export async function ejecutar(tarjeta: TarjetaAccion): Promise<Resultado<unknown>> {
  return pedirCliente<unknown>('/api/asistente', { metodo: 'PUT', cuerpo: { tarjeta } });
}
