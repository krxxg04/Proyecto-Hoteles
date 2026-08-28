'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { exigirRol, ROLES_CAJA } from '@/shared/sesion';
import { exito, fallo, traducirError, type Resultado } from '@/shared/resultado';
import { CambioEstadoReservaSchema, ReservaSchema } from '../domain/esquemas';
import type { Reserva } from '../domain/tipos';
import * as repo from '../infrastructure/repositorio';

/**
 * Reservas del hostal.
 *
 * Solo administración y recepción: el RLS de la tabla ya lo impone
 * (`aplicar_rls('reservas', r_recepcion(), r_recepcion())`), esto solo da un mensaje
 * claro antes de llegar a Postgres.
 */

export async function listarReservas(incluirCerradas = false): Promise<Resultado<Reserva[]>> {
  await exigirRol(...ROLES_CAJA);

  // Desde ayer: una reserva de anoche que no se ha cerrado sigue necesitando una decisión.
  const desde = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await repo.buscarReservas(desde, incluirCerradas);
  if (error) return fallo(traducirError(error));
  return exito((data ?? []) as unknown as Reserva[]);
}

export async function guardarReserva(
  entrada: z.input<typeof ReservaSchema>,
  id?: string
): Promise<Resultado<Reserva>> {
  const parsed = ReservaSchema.safeParse(entrada);
  if (!parsed.success) {
    const p = parsed.error.issues[0];
    return fallo(p.message, String(p.path[0]));
  }

  const sesion = await exigirRol(...ROLES_CAJA);
  const d = parsed.data;

  const { data, error } = await repo.guardar(
    {
      nombre_contacto: d.nombre_contacto,
      telefono: d.telefono || null,
      huesped_id: d.huesped_id ?? null,
      tipo_id: d.tipo_id ?? null,
      cuarto_id: d.cuarto_id ?? null,
      fecha_entrada: d.fecha_entrada,
      fecha_salida: d.fecha_salida ?? null,
      personas: d.personas,
      origen: d.origen,
      notas: d.notas || null,
    },
    sesion.tenantId,
    id
  );

  if (error) return fallo(traducirError(error));

  revalidatePath('/reservas');
  return exito(data as unknown as Reserva);
}

/**
 * Confirmar, cancelar o marcar que no se presentó.
 *
 * `convertida` no se pone a mano: la pone el check-in cuando la reserva se convierte en
 * una estadía de verdad. Dejar que se marque desde aquí sería poder decir «ya entró»
 * sin que nadie haya entrado ni pagado.
 */
export async function cambiarEstadoReserva(
  entrada: z.input<typeof CambioEstadoReservaSchema>
): Promise<Resultado<null>> {
  const parsed = CambioEstadoReservaSchema.safeParse(entrada);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  await exigirRol(...ROLES_CAJA);

  if (parsed.data.estado === 'convertida') {
    return fallo('Una reserva se marca como entrada haciendo el check-in, no a mano.');
  }

  const { error } = await repo.cambiarEstado(parsed.data.reserva_id, parsed.data.estado);
  if (error) return fallo(traducirError(error));

  revalidatePath('/reservas');
  return exito(null);
}
