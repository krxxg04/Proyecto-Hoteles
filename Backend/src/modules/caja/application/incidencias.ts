'use server';

import { revalidatePath } from 'next/cache';
import { exigirRol, ROLES_CAJA } from '@/shared/sesion';
import { exito, fallo, traducirError, type Resultado } from '@/shared/resultado';
import type { Incidencia } from '../domain/tipos';
import * as repo from '../infrastructure/repositorio';

export async function listarIncidencias(soloAbiertas = true): Promise<Resultado<Incidencia[]>> {
  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.buscarIncidencias(soloAbiertas);
  if (error) return fallo(traducirError(error));
  return exito((data ?? []) as Incidencia[]);
}

/** "Revisada" = una persona la miró y decidió. Nunca se acusa a nadie automáticamente. */
export async function revisarIncidencia(id: string): Promise<Resultado<null>> {
  await exigirRol(...ROLES_CAJA);

  const { error } = await repo.marcarRevisada(id);
  if (error) return fallo(traducirError(error));

  revalidatePath('/alertas');
  return exito(null);
}
