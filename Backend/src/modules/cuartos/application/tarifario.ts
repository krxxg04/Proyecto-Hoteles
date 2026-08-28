'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { exigirSesion, exigirRol, ROLES_ADMIN } from '@/shared/sesion';
import { exito, fallo, traducirError, type Resultado } from '@/shared/resultado';
import type { CuartoSugerido, TipoCuarto } from '../domain/tipos';
import type { DetalleTarifa, ModoEstadia } from '@/modules/estadias/domain/tipos';
import { TipoCuartoSchema } from '../domain/esquemas';
import * as repo from '../infrastructure/repositorio';

/** Cuánto costaría una estadía. El precio lo calcula la base leyendo el tarifario. */
export async function cotizarEstadia(params: {
  cuarto_id: string;
  modo: ModoEstadia;
  horas?: number | null;
  noches?: number | null;
  fecha_entrada?: string;
}): Promise<Resultado<DetalleTarifa>> {
  await exigirSesion();

  const { data, error } = await repo.calcularTarifa({
    cuarto_id: params.cuarto_id,
    modo: params.modo,
    horas: params.horas ?? null,
    noches: params.noches ?? null,
    fecha_entrada: params.fecha_entrada ?? new Date().toISOString().slice(0, 10),
  });

  if (error) return fallo(traducirError(error));
  return exito(data as DetalleTarifa);
}

/** Cuartos libres que aguantan N personas, ordenados por qué tanto encajan. */
export async function sugerirCuarto(
  personas = 1,
  caracteristicas: string[] = []
): Promise<Resultado<CuartoSugerido[]>> {
  await exigirSesion();

  const { data, error } = await repo.sugerir(personas, caracteristicas);
  if (error) return fallo(traducirError(error));
  return exito((data ?? []) as CuartoSugerido[]);
}

export async function listarTiposCuarto(): Promise<Resultado<TipoCuarto[]>> {
  await exigirSesion();

  const { data, error } = await repo.buscarTiposCuarto();
  if (error) return fallo(traducirError(error));
  return exito((data ?? []) as TipoCuarto[]);
}

/** Cambiar el tarifario es cosa del administrador. El RLS también lo exige. */
export async function guardarTipoCuarto(
  entrada: z.input<typeof TipoCuartoSchema>,
  id?: string
): Promise<Resultado<TipoCuarto>> {
  const parsed = TipoCuartoSchema.safeParse(entrada);
  if (!parsed.success) {
    const p = parsed.error.issues[0];
    return fallo(p.message, String(p.path[0]));
  }

  const sesion = await exigirRol(...ROLES_ADMIN);

  const { data, error } = await repo.guardarTipo(parsed.data, sesion.tenantId, id);
  if (error) return fallo(traducirError(error));

  revalidatePath('/admin/tarifas');
  return exito(data as TipoCuarto);
}
