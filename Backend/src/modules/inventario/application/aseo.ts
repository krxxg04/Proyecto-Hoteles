'use server';

import { revalidatePath } from 'next/cache';
import { exigirSesion } from '@/shared/sesion';
import { exito, fallo, traducirError, type Resultado } from '@/shared/resultado';
import * as repo from '../infrastructure/repositorio';

/** Manda un no descartable a lavar. Sale del stock disponible. */
export async function enviarAAseo(
  producto_id: string,
  cantidad = 1,
  cuarto_id?: string
): Promise<Resultado<null>> {
  await exigirSesion();

  const { error } = await repo.enviarAseo(producto_id, cantidad, cuarto_id ?? null);
  if (error) return fallo(traducirError(error));

  revalidatePath('/limpieza');
  return exito(null);
}

/** Volvió de lavandería: reingresa al stock. */
export async function marcarAseoListo(aseoId: string): Promise<Resultado<null>> {
  await exigirSesion();

  const { error } = await repo.aseoListo(aseoId);
  if (error) return fallo(traducirError(error));

  revalidatePath('/limpieza');
  return exito(null);
}

export async function listarAseoPendiente() {
  await exigirSesion();

  const { data, error } = await repo.buscarAseoPendiente();
  if (error) return fallo(traducirError(error));
  return exito(data ?? []);
}
