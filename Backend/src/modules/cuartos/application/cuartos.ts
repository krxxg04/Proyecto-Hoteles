'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { exigirSesion, exigirRol, ROLES_ADMIN } from '@/shared/sesion';
import { exito, fallo, traducirError, type Resultado } from '@/shared/resultado';
import {
  ESTADOS_CUARTO,
  type Cuarto,
  type CuartoConTipo,
  type DetalleCuarto,
  type EstadoCuarto,
} from '../domain/tipos';
import { CambioEstadoSchema, CuartoSchema } from '../domain/esquemas';
import * as repo from '../infrastructure/repositorio';

export async function listarCuartos(estado?: EstadoCuarto): Promise<Resultado<CuartoConTipo[]>> {
  await exigirSesion();

  const { data, error } = await repo.buscarCuartos(estado);
  if (error) return fallo(traducirError(error));

  // Supabase infiere las relaciones como arreglo aunque sean 1:1; se normalizan las dos formas.
  const cuartos = (data ?? []).map((fila) => {
    const { tipos_cuarto, ...resto } = fila as unknown as Cuarto & {
      tipos_cuarto: { nombre: string } | { nombre: string }[] | null;
    };
    const tipo = Array.isArray(tipos_cuarto) ? tipos_cuarto[0] : tipos_cuarto;
    return { ...resto, tipo: tipo?.nombre ?? '' };
  });

  return exito(cuartos);
}

/** Conteo por estado, para las píldoras de filtro. */
export async function conteoPorEstado(): Promise<Resultado<Record<string, number>>> {
  await exigirSesion();

  const { data, error } = await repo.buscarEstados();
  if (error) return fallo(traducirError(error));

  const conteo: Record<string, number> = { total: data?.length ?? 0 };
  for (const e of ESTADOS_CUARTO) conteo[e] = 0;
  for (const fila of data ?? []) conteo[(fila as { estado: EstadoCuarto }).estado] += 1;

  return exito(conteo);
}

/**
 * Todo lo que hace falta para abrir el panel de una habitación, en un viaje.
 *
 * El mockup lo enseñaba con datos inventados («Hoy · 09:40»). Aquí sale de donde tiene
 * que salir: la estadía activa, el historial de estados y la tabla de reservas. Lo que
 * no existe se dice, no se rellena con un valor bonito.
 */
export async function obtenerCuarto(id: string): Promise<Resultado<DetalleCuarto>> {
  await exigirSesion();

  const { data, error } = await repo.buscarCuarto(id);
  if (error) return fallo(traducirError(error));

  const [limpieza, reserva] = await Promise.all([
    repo.buscarUltimaLimpieza(id),
    repo.buscarProximaReserva(id),
  ]);

  const fila = data as Record<string, unknown>;
  const estadias = (fila.estadias ?? []) as Array<{ estado: string }>;

  return exito({
    ...(fila as unknown as DetalleCuarto),
    // Solo interesa la que está en curso; el resto es historia del cuarto.
    estadia: (estadias.find((e) => e.estado === 'activa') ?? null) as DetalleCuarto['estadia'],
    ultima_limpieza: (limpieza.data ?? null) as DetalleCuarto['ultima_limpieza'],
    proxima_reserva: (reserva.data ?? null) as DetalleCuarto['proxima_reserva'],
  });
}

/** Va por función SQL, no por UPDATE: un trigger deja el historial de quién y cuándo. */
export async function cambiarEstadoCuarto(
  entrada: z.input<typeof CambioEstadoSchema>
): Promise<Resultado<null>> {
  const parsed = CambioEstadoSchema.safeParse(entrada);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  await exigirSesion(); // limpieza y mantenimiento también cambian estados
  const { error } = await repo.cambiarEstado(
    parsed.data.cuarto_id,
    parsed.data.estado,
    parsed.data.nota ?? null
  );
  if (error) return fallo(traducirError(error));

  revalidatePath('/cuartos');
  return exito(null);
}

export async function historialEstados(cuartoId: string) {
  await exigirSesion();

  const { data, error } = await repo.buscarHistorialEstados(cuartoId);
  if (error) return fallo(traducirError(error));
  return exito(data ?? []);
}

export async function guardarCuarto(
  entrada: z.input<typeof CuartoSchema>,
  id?: string
): Promise<Resultado<Cuarto>> {
  const parsed = CuartoSchema.safeParse(entrada);
  if (!parsed.success) {
    const p = parsed.error.issues[0];
    return fallo(p.message, String(p.path[0]));
  }

  const sesion = await exigirRol(...ROLES_ADMIN);

  const valores = {
    ...parsed.data,
    nota: parsed.data.nota || null,
    tarifa_costo: parsed.data.tarifa_costo ?? null,
    tarifa_amanecida: parsed.data.tarifa_amanecida ?? null,
  };

  const { data, error } = await repo.guardar(valores, sesion.tenantId, id);
  if (error) return fallo(traducirError(error));

  revalidatePath('/cuartos');
  return exito(data as Cuarto);
}

/** Baja lógica: hay estadías, ventas y auditoría apuntando al cuarto. */
export async function desactivarCuarto(id: string): Promise<Resultado<null>> {
  await exigirRol(...ROLES_ADMIN);

  const { data: ocupado } = await repo.estadiaActivaDe(id);
  if (ocupado) return fallo('El cuarto tiene una estadía activa. Haz el check-out primero.');

  const { error } = await repo.desactivar(id);
  if (error) return fallo(traducirError(error));

  revalidatePath('/cuartos');
  return exito(null);
}

export async function listarCaracteristicas() {
  await exigirSesion();

  const { data, error } = await repo.buscarCaracteristicas();
  if (error) return fallo(traducirError(error));
  return exito(data ?? []);
}
