'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { exigirSesion, exigirRol, ROLES_CAJA } from '@/shared/sesion';
import { exito, fallo, traducirError, type Resultado } from '@/shared/resultado';
import type { MasVendido, ResumenVentas, Venta } from '../domain/tipos';
import { VentaSchema } from '../domain/esquemas';
import * as repo from '../infrastructure/repositorio';

/** Solo viajan producto y cantidad. El monto sale del catálogo, dentro de la misma transacción. */
export async function registrarVenta(
  entrada: z.input<typeof VentaSchema>
): Promise<Resultado<{ venta_id: string }>> {
  const parsed = VentaSchema.safeParse(entrada);
  if (!parsed.success) {
    const p = parsed.error.issues[0];
    return fallo(p.message, String(p.path[0]));
  }

  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.registrar({
    producto_id: parsed.data.producto_id,
    cantidad: parsed.data.cantidad,
    cuarto_id: parsed.data.cuarto_id ?? null,
    medio: parsed.data.medio,
    banco: parsed.data.medio === 'tarjeta' ? parsed.data.banco ?? null : null,
  });

  if (error) return fallo(traducirError(error));

  revalidatePath('/caja');
  revalidatePath('/inventario');
  return exito({ venta_id: data as string });
}

/** Ventas de un turno; sin turno, las de hoy. */
export async function listarVentas(turnoId?: string): Promise<Resultado<Venta[]>> {
  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.buscarVentas(turnoId);
  if (error) return fallo(traducirError(error));
  return exito((data ?? []) as Venta[]);
}

/** Totales del turno abierto, para la barra de caja. */
export async function resumenVentasTurno(): Promise<Resultado<ResumenVentas>> {
  await exigirRol(...ROLES_CAJA);

  const { data: turnoId } = await repo.turnoAbierto();
  if (!turnoId) return exito({ total: 0, por_medio: {}, cantidad: 0 });

  const { data, error } = await repo.buscarMontosDelTurno(turnoId as string);
  if (error) return fallo(traducirError(error));

  const filas = (data ?? []) as Array<{ monto: number; medio: string }>;
  const por_medio: Record<string, number> = {};
  let total = 0;

  for (const v of filas) {
    total += Number(v.monto);
    por_medio[v.medio] = (por_medio[v.medio] ?? 0) + Number(v.monto);
  }

  return exito({ total, por_medio, cantidad: filas.length });
}

/** Lo más vendido en un rango. */
export async function masVendidos(
  desde: string,
  hasta: string
): Promise<Resultado<MasVendido[]>> {
  await exigirRol(...ROLES_CAJA);

  const { data, error } = await repo.buscarVentasConProducto(desde, hasta);
  if (error) return fallo(traducirError(error));

  const acumulado = new Map<string, MasVendido>();

  for (const fila of data ?? []) {
    const v = fila as unknown as {
      producto_id: string;
      cantidad: number | null;
      monto: number;
      productos: { nombre: string } | { nombre: string }[] | null;
    };
    const prod = Array.isArray(v.productos) ? v.productos[0] : v.productos;
    const actual = acumulado.get(v.producto_id) ?? {
      nombre: prod?.nombre ?? 'Sin nombre',
      unidades: 0,
      total: 0,
    };
    actual.unidades += Number(v.cantidad ?? 0);
    actual.total += Number(v.monto);
    acumulado.set(v.producto_id, actual);
  }

  return exito([...acumulado.values()].sort((a, b) => b.total - a.total));
}

/** Los bancos que acepta el cobro con tarjeta. */
export async function listarBancos(): Promise<Resultado<Array<{ clave: string; label: string }>>> {
  await exigirSesion();

  const { data, error } = await repo.buscarBancos();
  if (error) return fallo(traducirError(error));
  return exito(data ?? []);
}
