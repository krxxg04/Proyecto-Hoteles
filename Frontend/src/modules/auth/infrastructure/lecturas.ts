import { cache } from 'react';
import { pedir } from '@/shared/api/servidor';
import type { Sesion } from '@/shared/dominio/tipos';

/**
 * Quién está conectado. `null` si nadie.
 *
 * `cache()` la memoiza dentro de una misma petición: el layout, la guardia de sección y
 * la propia página la piden, y sin esto serían tres viajes al backend para pintar una
 * pantalla. Entre peticiones no se guarda nada.
 */
export const miSesion = cache(async (): Promise<Sesion | null> => {
  const r = await pedir<Sesion | null>('/api/auth');
  return r.ok ? r.datos : null;
});
