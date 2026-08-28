import { pedirCliente } from '@/shared/api/navegador';
import type { Resultado } from '@/shared/api/contrato';
import type { Rol } from '@/shared/dominio/tipos';

/** El PIN nunca se guarda en la tabla: vive cifrado en Supabase Auth. */
export async function crearPersona(entrada: {
  dni: string;
  nombre: string;
  rol: Rol;
  telefono?: string;
  pin: string;
}): Promise<Resultado<{ id: string; dni: string }>> {
  return pedirCliente<{ id: string; dni: string }>('/api/personal', {
    metodo: 'POST',
    cuerpo: entrada,
  });
}

/** Baja lógica: hay turnos y ventas firmados por esta persona. */
export async function desactivarPersona(persona_id: string): Promise<Resultado<null>> {
  return pedirCliente<null>('/api/personal', { metodo: 'DELETE', cuerpo: { persona_id } });
}
