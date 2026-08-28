'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { exigirRol, ROLES_CAJA } from '@/shared/sesion';
import { exito, fallo, traducirError, type Resultado } from '@/shared/resultado';
import type { Huesped } from '../domain/tipos';
import { HuespedSchema } from '../domain/esquemas';
import * as repo from '../infrastructure/repositorio';

export async function listarHuespedes(busqueda?: string): Promise<Resultado<Huesped[]>> {
  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.buscarHuespedes(busqueda);
  if (error) return fallo(traducirError(error));
  return exito((data ?? []) as Huesped[]);
}

export async function obtenerHuesped(id: string): Promise<Resultado<Huesped>> {
  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.buscarHuesped(id);
  if (error) return fallo(traducirError(error));
  return exito(data as Huesped);
}

/** Lo usa el check-in para no duplicar personas. */
export async function buscarPorDocumento(
  tipo_doc: string,
  num_doc: string
): Promise<Resultado<Huesped | null>> {
  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.buscarPorDoc(tipo_doc, num_doc);
  if (error) return fallo(traducirError(error));
  return exito((data ?? null) as Huesped | null);
}

export async function crearHuesped(
  entrada: z.input<typeof HuespedSchema>
): Promise<Resultado<Huesped>> {
  const parsed = HuespedSchema.safeParse(entrada);
  if (!parsed.success) {
    const p = parsed.error.issues[0];
    return fallo(p.message, String(p.path[0]));
  }

  const sesion = await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.crear(parsed.data, sesion.tenantId);
  if (error) return fallo(traducirError(error));

  revalidatePath('/huespedes');
  return exito(data as Huesped);
}

export async function actualizarHuesped(
  id: string,
  entrada: z.input<typeof HuespedSchema>
): Promise<Resultado<Huesped>> {
  const parsed = HuespedSchema.safeParse(entrada);
  if (!parsed.success) {
    const p = parsed.error.issues[0];
    return fallo(p.message, String(p.path[0]));
  }

  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.actualizar(id, parsed.data);
  if (error) return fallo(traducirError(error));

  revalidatePath('/huespedes');
  return exito(data as Huesped);
}

/** Marca neutra que exige evidencia y decisión humana. Nunca es una "lista negra". */
export async function marcarParaRevision(id: string, motivo: string): Promise<Resultado<null>> {
  if (!motivo?.trim()) {
    return fallo('Escribe el motivo. Una marca sin explicación no sirve para decidir.', 'motivo');
  }

  await exigirRol(...ROLES_CAJA);

  const { error } = await repo.marcarRevision(id, motivo.trim());
  if (error) return fallo(traducirError(error));

  revalidatePath('/huespedes');
  return exito(null);
}

export async function quitarRevision(id: string): Promise<Resultado<null>> {
  await exigirRol(...ROLES_CAJA);

  const { error } = await repo.quitarMarca(id);
  if (error) return fallo(traducirError(error));

  revalidatePath('/huespedes');
  return exito(null);
}

export async function historialHuesped(id: string) {
  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.buscarEstadiasDe(id);
  if (error) return fallo(traducirError(error));
  return exito(data ?? []);
}
