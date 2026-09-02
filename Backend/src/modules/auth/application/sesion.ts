'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { sesionActual, type Sesion } from '@/shared/sesion';
import { exito, fallo, traducirError, type Resultado } from '@/shared/resultado';
import { LoginSchema, CambioPinSchema } from '../domain/esquemas';
import * as repo from '../infrastructure/repositorio';

/** Login con DNI + PIN: por detrás es `<dni>@<slug>.hostal.local`, que el personal nunca ve. */
export async function iniciarSesion(
  entrada: z.input<typeof LoginSchema>
): Promise<Resultado<Sesion>> {
  const parsed = LoginSchema.safeParse(entrada);
  if (!parsed.success) {
    const primero = parsed.error.issues[0];
    return fallo(primero.message, String(primero.path[0]));
  }

  const { dni, pin, hostal } = parsed.data;

  const { data: coincidencias, error: errorResolver } = await repo.resolverLogin(dni, hostal);
  if (errorResolver) return fallo('No se pudo verificar tus datos. Inténtalo de nuevo.');

  // Mismo mensaje si el DNI no existe o si el PIN está mal: distinguirlos revelaría qué DNI
  // trabaja en el hostal.
  const credencialesInvalidas = 'DNI o PIN incorrectos.';
  const encontradas = coincidencias ?? [];
  if (encontradas.length === 0) return fallo(credencialesInvalidas);

  /**
   * El mismo DNI puede estar en varios hostales: `profiles` es único por `(tenant_id, dni)`,
   * a propósito, porque una persona puede trabajar en dos. Antes se resolvía con `limit 1`
   * y la del segundo hostal no entraba nunca. Ahora se pide el hostal.
   */
  if (encontradas.length > 1) {
    return fallo('Ese DNI está en más de un hostal. Indica en cuál quieres entrar.', 'hostal');
  }

  const { error: errorLogin } = await repo.entrar(encontradas[0].email, pin);
  if (errorLogin) return fallo(credencialesInvalidas);

  const sesion = await sesionActual();
  if (!sesion) return fallo('No se pudo cargar tu perfil. Avisa al administrador.');

  revalidatePath('/', 'layout');
  return exito(sesion);
}

export async function cerrarSesion(): Promise<Resultado<null>> {
  const { error } = await repo.salir();
  if (error) return fallo(traducirError(error));

  revalidatePath('/', 'layout');
  return exito(null);
}

/**
 * Quién está conectado, con el nombre de su hostal.
 *
 * El nombre no viaja en el JWT, así que cuesta una consulta. Se paga aquí y no en
 * `sesionActual()` porque esa se llama en cada caso de uso y solo necesita el id.
 */
export async function miSesion(): Promise<Sesion | null> {
  const sesion = await sesionActual();
  if (!sesion) return null;

  const [{ data: hostal }, { data: perfil }] = await Promise.all([
    repo.miHostal(),
    repo.miPerfilPin(sesion.usuarioId),
  ]);

  return {
    ...sesion,
    hostal: hostal?.nombre,
    plan: hostal?.plan,
    pinTemporal: perfil?.pin_temporal ?? false,
  };
}

/** Exige el PIN actual: sin eso, una sesión abierta en la tablet bastaría para secuestrar la cuenta. */
export async function cambiarMiPin(
  entrada: z.input<typeof CambioPinSchema>
): Promise<Resultado<null>> {
  const parsed = CambioPinSchema.safeParse(entrada);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const sesion = await sesionActual();
  if (!sesion) return fallo('Tu sesión expiró. Vuelve a iniciar sesión.');

  /**
   * Con sesión abierta el hostal ya se sabe, y hay que pasarlo: el mismo DNI puede estar
   * en varios, y sin el slug la resolución sería ambigua otra vez. El RLS de `tenants`
   * limita esta consulta a la propia fila.
   */
  const { data: hostal } = await repo.miHostal();
  if (!hostal?.slug) return fallo('No se pudo verificar tu identidad.');

  const { data: coincidencias } = await repo.resolverLogin(sesion.dni, hostal.slug);
  const yo = (coincidencias ?? [])[0];
  if (!yo) return fallo('No se pudo verificar tu identidad.');

  const { error: errorVerificar } = await repo.entrar(yo.email, parsed.data.pinActual);
  if (errorVerificar) return fallo('El PIN actual no es correcto.', 'pinActual');

  const { error } = await repo.cambiarPin(parsed.data.pinNuevo);
  if (error) return fallo(traducirError(error));

  // El PIN ya es suyo: la app deja de exigirle cambiarlo. Va después a propósito — si la
  // contraseña no cambió, la bandera se queda arriba.
  await repo.marcarPinPropio();

  return exito(null);
}
