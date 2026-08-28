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

  const { dni, pin } = parsed.data;

  const { data: resuelto, error: errorResolver } = await repo.resolverLogin(dni);
  if (errorResolver) return fallo(traducirError(errorResolver));

  // Mismo mensaje si el DNI no existe o si el PIN está mal: distinguirlos revelaría qué DNI
  // trabaja en el hostal.
  const credencialesInvalidas = 'DNI o PIN incorrectos.';
  if (!resuelto) return fallo(credencialesInvalidas);

  const { error: errorLogin } = await repo.entrar(resuelto.email, pin);
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

  const { data: hostal } = await repo.miHostal();
  return { ...sesion, hostal: hostal?.nombre, plan: hostal?.plan };
}

/** Exige el PIN actual: sin eso, una sesión abierta en la tablet bastaría para secuestrar la cuenta. */
export async function cambiarMiPin(
  entrada: z.input<typeof CambioPinSchema>
): Promise<Resultado<null>> {
  const parsed = CambioPinSchema.safeParse(entrada);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const sesion = await sesionActual();
  if (!sesion) return fallo('Tu sesión expiró. Vuelve a iniciar sesión.');

  const { data: resuelto } = await repo.resolverLogin(sesion.dni);
  if (!resuelto) return fallo('No se pudo verificar tu identidad.');

  const { error: errorVerificar } = await repo.entrar(resuelto.email, parsed.data.pinActual);
  if (errorVerificar) return fallo('El PIN actual no es correcto.', 'pinActual');

  const { error } = await repo.cambiarPin(parsed.data.pinNuevo);
  if (error) return fallo(traducirError(error));

  return exito(null);
}
