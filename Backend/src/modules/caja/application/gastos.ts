'use server';

import { z } from 'zod';
import { uno } from '@/shared/supabase/embebido';
import { revalidatePath } from 'next/cache';
import { exigirRol, exigirSesion, ROLES_CAJA, ROLES_ADMIN } from '@/shared/sesion';
import { exito, fallo, traducirError, type Resultado } from '@/shared/resultado';
import type { Alerta, Gasto } from '../domain/tipos';
import { GastoSchema } from '../domain/esquemas';
import * as repo from '../infrastructure/repositorio';

/**
 * Registrar un gasto de la caja.
 *
 * Un gasto `fijo` es la compra de un producto del catálogo: descuenta de la caja y llena
 * el inventario en la misma operación. Un `justificable` es cualquier otra cosa, exige
 * razón y siempre deja alerta. Las dos reglas viven en `registrar_gasto()`, no aquí.
 */
export async function registrarGasto(
  entrada: z.input<typeof GastoSchema>
): Promise<Resultado<{ gasto_id: string }>> {
  const parsed = GastoSchema.safeParse(entrada);
  if (!parsed.success) {
    const p = parsed.error.issues[0];
    return fallo(p.message, String(p.path[0]));
  }

  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.registrarGasto({
    categoria: parsed.data.categoria,
    concepto: parsed.data.concepto ?? '',
    monto: parsed.data.monto,
    medio: parsed.data.medio,
    producto_id: parsed.data.producto_id ?? null,
    cantidad: parsed.data.cantidad ?? null,
    justificacion: parsed.data.justificacion ?? null,
  });
  if (error) return fallo(traducirError(error));

  revalidatePath('/caja');
  revalidatePath('/inventario');
  revalidatePath('/alertas');
  return exito({ gasto_id: data as string });
}

/** Los gastos del turno abierto. Sin turno, los últimos registrados. */
export async function listarGastos(soloDelTurno = true): Promise<Resultado<Gasto[]>> {
  await exigirRol(...ROLES_CAJA);

  let turnoId: string | null = null;
  if (soloDelTurno) {
    const { data } = await repo.idTurnoAbierto();
    turnoId = (data as string) ?? null;
  }

  const { data, error } = await repo.buscarGastos(turnoId);
  if (error) return fallo(traducirError(error));
  return exito((data ?? []) as unknown as Gasto[]);
}

/**
 * Las alertas del sistema.
 *
 * La tabla existía desde el primer esquema y nadie la leía: `cerrar_turno` escribía en
 * ella y ahí se quedaba. Los gastos justificables y los sobreprecios entran por aquí.
 */
export async function listarAlertas(soloAbiertas = true): Promise<Resultado<Alerta[]>> {
  await exigirSesion();

  const { data, error } = await repo.buscarAlertas(soloAbiertas);
  if (error) return fallo(traducirError(error));

  /**
   * El perfil viene incrustado y Supabase lo tipa como arreglo aunque sea 1:1 — para eso
   * está `uno()`. Se aplana aquí para que la pantalla reciba un nombre y no una relación.
   */
  const filas = (data ?? []) as Array<Record<string, unknown>>;

  // Qué alertas son en realidad "este gasto se repitió 5 veces" — una consulta aparte
  // porque `gastos_patrones` no tiene una FK que PostgREST pueda seguir hacia `alertas`.
  const ids = filas.map((a) => a.id as string);
  const { data: patrones } = await repo.buscarPatronesPorAlerta(ids);
  const patronPorAlerta = new Map(
    ((patrones ?? []) as Array<{ id: string; alerta_id: string }>).map((p) => [p.alerta_id, p.id])
  );

  return exito(
    filas.map(({ profiles, ...a }) => ({
      ...a,
      atendida_por_nombre: uno(profiles as { nombre: string } | null)?.nombre ?? null,
      patron_id: patronPorAlerta.get(a.id as string) ?? null,
    })) as Alerta[]
  );
}

/** «Atendida» significa que una persona la miró y decidió, no que se resolviera sola. */
export async function atenderAlerta(id: string): Promise<Resultado<null>> {
  await exigirRol(...ROLES_CAJA);

  const { error } = await repo.atenderAlerta(id);
  if (error) return fallo(traducirError(error));

  revalidatePath('/alertas');
  return exito(null);
}

/**
 * Un "otro gasto" que se repitió 5 veces con el mismo texto. Solo el administrador
 * decide si de verdad pasa a recurrente — reclasifica también lo ya registrado, no
 * solo lo que se cargue de ahora en adelante.
 */
export async function aprobarGastoRecurrente(patronId: string): Promise<Resultado<null>> {
  await exigirRol(...ROLES_ADMIN);

  const { error } = await repo.aprobarGastoRecurrente(patronId);
  if (error) return fallo(traducirError(error));

  revalidatePath('/caja');
  revalidatePath('/alertas');
  return exito(null);
}

export async function descartarGastoRecurrente(patronId: string): Promise<Resultado<null>> {
  await exigirRol(...ROLES_ADMIN);

  const { error } = await repo.descartarGastoRecurrente(patronId);
  if (error) return fallo(traducirError(error));

  revalidatePath('/alertas');
  return exito(null);
}
