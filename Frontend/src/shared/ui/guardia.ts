import 'server-only';
import { redirect } from 'next/navigation';
import { miSesion } from '@/modules/auth/infrastructure/lecturas';
import { INICIO_POR_ROL, puedeVer } from './navegacion';
import type { Sesion } from '@/shared/dominio/tipos';

/**
 * Corta el paso a una sección que el rol no tiene.
 *
 * El menú ya no la muestra, pero escribiendo la URL se llegaba igual y salía una
 * pantalla a medias con un "no tienes permiso" del backend. Esto es cortesía, no
 * seguridad: quien de verdad protege es el RLS.
 */
export async function exigirSeccion(clave: string): Promise<Sesion> {
  const sesion = await miSesion();
  if (!sesion) redirect('/login');
  if (!puedeVer(sesion.rol, clave)) redirect(INICIO_POR_ROL[sesion.rol]);
  return sesion;
}
