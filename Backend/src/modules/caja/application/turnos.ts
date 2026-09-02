'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { exigirRol, ROLES_CAJA } from '@/shared/sesion';
import { exito, fallo, traducirError, type Resultado } from '@/shared/resultado';
import type { EstadoCaja, LineaConteo, ResumenCierre, Turno } from '../domain/tipos';
import { AperturaSchema, CierreSchema } from '../domain/esquemas';
import * as repo from '../infrastructure/repositorio';

export async function abrirTurno(
  entrada: z.input<typeof AperturaSchema>
): Promise<Resultado<{ turno_id: string }>> {
  const parsed = AperturaSchema.safeParse(entrada);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.abrir(
    parsed.data.efectivo_contado,
    parsed.data.justificacion ?? null
  );
  if (error) return fallo(traducirError(error));

  revalidatePath('/caja');
  return exito({ turno_id: data as string });
}

export async function estadoCaja(): Promise<Resultado<EstadoCaja>> {
  const sesion = await exigirRol(...ROLES_CAJA);

  const { data: caja } = await repo.buscarEstadoCaja();
  const { data: turno, error } = await repo.buscarTurnoAbierto();
  if (error) return fallo(traducirError(error));

  const t = turno as (Turno & { profiles: { nombre: string } | null }) | null;

  // Lo que debería haber en la caja ahora mismo. Sin turno abierto es el saldo, sin más.
  const saldo = Number(caja?.saldo ?? 0);
  let esperado = saldo;
  let gastos = 0;

  if (t) {
    const { data: efectivo } = await repo.efectivoEsperado(t.id);
    esperado = Number(efectivo ?? 0);

    const { data: filas } = await repo.buscarGastos(t.id);
    gastos = (filas ?? []).reduce((suma, g) => suma + Number((g as { monto: number }).monto), 0);
  }

  return exito({
    turno: t ? ({ ...t, profiles: undefined } as unknown as Turno) : null,
    saldo,
    efectivo_esperado: esperado,
    gastos_turno: gastos,
    usuario: t?.profiles?.nombre ?? null,
    es_de_otro: !!t && t.usuario_id !== sesion.usuarioId,
  });
}

/** Qué debería haber al cerrar: snapshot de apertura más los movimientos reales del turno. */
export async function conteoEsperado(): Promise<Resultado<LineaConteo[]>> {
  await exigirRol(...ROLES_CAJA);

  const { data: turnoId } = await repo.idTurnoAbierto();
  if (!turnoId) return fallo('No hay ningún turno abierto.');

  const { data, error } = await repo.esperadoCierre(turnoId as string);
  if (error) return fallo(traducirError(error));
  return exito((data ?? []) as LineaConteo[]);
}

/** Conteo de inventario y caja en una transacción: un descuadre sin justificar aborta todo. */
export async function cerrarTurno(
  entrada: z.input<typeof CierreSchema>
): Promise<Resultado<ResumenCierre>> {
  const parsed = CierreSchema.safeParse(entrada);
  if (!parsed.success) {
    const p = parsed.error.issues[0];
    return fallo(p.message, String(p.path[0]));
  }

  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.cerrar({
    conteos: parsed.data.conteos,
    efectivo_contado: parsed.data.efectivo_contado,
    justificacion_caja: parsed.data.justificacion_caja ?? null,
    ajuste_monto: parsed.data.ajuste_monto ?? null,
    ajuste_razon: parsed.data.ajuste_razon ?? null,
  });

  if (error) return fallo(traducirError(error));

  revalidatePath('/caja');
  revalidatePath('/inventario');
  return exito(data as ResumenCierre);
}

export async function historialCierres(limite = 30) {
  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.buscarCierres(limite);
  if (error) return fallo(traducirError(error));
  return exito(data ?? []);
}
