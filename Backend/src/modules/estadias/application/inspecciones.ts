'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { exigirRol, ROLES_CAJA } from '@/shared/sesion';
import { exito, fallo, traducirError, type Resultado } from '@/shared/resultado';
import { InspeccionSchema } from '../domain/esquemas';
import { CHECKLIST_INSPECCION, type Inspeccion, type PlantillaInspeccion } from '../domain/tipos';
import { cambiarEstadoCuarto } from '@/modules/cuartos/application/cuartos';
import * as repo from '../infrastructure/repositorio';

/**
 * Qué hay que revisar en un cuarto y contra qué estadía.
 *
 * El checklist sale del dominio (`CHECKLIST_INSPECCION`, portado de `INSP` del
 * prototipo). `confirmado` arranca igual a `esperado`: lo normal es que no falte
 * nada, y quien inspecciona corrige lo que sí falta.
 */
export async function plantillaInspeccion(cuartoId: string): Promise<Resultado<PlantillaInspeccion>> {
  await exigirRol(...ROLES_CAJA);

  const { data: cuarto, error } = await repo.buscarCuartoAInspeccionar(cuartoId);
  if (error) return fallo(traducirError(error));

  const { data: estadia } = await repo.buscarUltimaEstadiaDe(cuartoId);

  return exito({
    cuarto: cuarto as PlantillaInspeccion['cuarto'],
    estadia_id: estadia?.id ?? null,
    items: CHECKLIST_INSPECCION.map((i) => ({ ...i, confirmado: i.esperado })),
  });
}

export async function listarInspecciones(cuartoId?: string): Promise<Resultado<Inspeccion[]>> {
  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.buscarInspecciones(cuartoId);
  if (error) return fallo(traducirError(error));
  return exito((data ?? []) as unknown as Inspeccion[]);
}

/** Guardar la inspección NO descuenta inventario: el faltante se registra aparte y con motivo. */
export async function guardarInspeccion(
  entrada: z.input<typeof InspeccionSchema>
): Promise<Resultado<{ id: string; faltantes: number }>> {
  const parsed = InspeccionSchema.safeParse(entrada);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const sesion = await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.guardarInspeccionEn({
    tenant_id: sesion.tenantId,
    cuarto_id: parsed.data.cuarto_id,
    estadia_id: parsed.data.estadia_id ?? null,
    resultado: parsed.data.resultado,
    nota: parsed.data.nota ?? null,
    medio_id: parsed.data.medio_id ?? null,
    actor_id: sesion.usuarioId,
  });

  if (error) return fallo(traducirError(error));

  const faltantes = parsed.data.resultado.filter((r) => r.confirmado < r.esperado).length;

  // Cerrada la inspección, el cuarto sigue su curso. Va aparte y no dentro del insert
  // porque el cambio de estado tiene su propia función SQL, con su historial.
  if (parsed.data.pasar_a_limpieza) {
    await cambiarEstadoCuarto({ cuarto_id: parsed.data.cuarto_id, estado: 'limpieza' });
  }

  revalidatePath('/cuartos');
  return exito({ id: (data as { id: string }).id, faltantes });
}
