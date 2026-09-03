'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { exigirRol, ROLES_CAJA } from '@/shared/sesion';
import { exito, fallo, traducirError, type Resultado } from '@/shared/resultado';
import type { ResultadoCheckin } from '../domain/tipos';
import { CheckinSchema } from '../domain/esquemas';
import * as repo from '../infrastructure/repositorio';

/** Check-in completo en una transacción: huésped, tarifa, estadía, cuarto y cobro. */
export async function registrarCheckin(
  entrada: z.input<typeof CheckinSchema>
): Promise<Resultado<ResultadoCheckin>> {
  const parsed = CheckinSchema.safeParse(entrada);
  if (!parsed.success) {
    const p = parsed.error.issues[0];
    return fallo(p.message, String(p.path[0]));
  }

  await exigirRol(...ROLES_CAJA);
  const d = parsed.data;

  const { data, error } = await repo.registrar({
    cuarto_id: d.cuarto_id,
    modo: d.modo,
    nombre: d.nombre,
    tipo_doc: d.tipo_doc,
    num_doc: d.num_doc,
    telefono: d.telefono || null,
    horas: d.modo === 'horas' ? d.horas ?? null : null,
    noches: d.modo === 'rango' ? d.noches ?? null : d.modo === 'dia' ? 1 : null,
    fecha_entrada: d.fecha_entrada ?? new Date().toISOString().slice(0, 10),
    personas: d.personas,
    medio: d.medio,
    banco: d.medio === 'tarjeta' ? d.banco ?? null : null,
    acompanantes: d.acompanantes,
  });

  if (error) return fallo(traducirError(error));

  revalidatePath('/cuartos');
  revalidatePath('/caja');
  return exito(data as ResultadoCheckin);
}

/** Deja el cuarto en "inspección", no en disponible: antes van la revisión y la limpieza. */
export async function registrarCheckout(estadiaId: string): Promise<Resultado<null>> {
  await exigirRol(...ROLES_CAJA);

  const { error } = await repo.cerrar(estadiaId);
  if (error) return fallo(traducirError(error));

  revalidatePath('/cuartos');
  return exito(null);
}

export async function estadiasActivas() {
  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.buscarActivas();
  if (error) return fallo(traducirError(error));
  return exito(data ?? []);
}

export async function obtenerEstadia(id: string) {
  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.buscarEstadia(id);
  if (error) return fallo(traducirError(error));
  return exito(data);
}
