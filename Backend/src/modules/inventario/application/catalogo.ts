'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { exigirSesion, exigirRol, ROLES_ADMIN } from '@/shared/sesion';
import { exito, fallo, traducirError, type Resultado } from '@/shared/resultado';
import type { Producto, ProductoConCobertura } from '../domain/tipos';
import { conCobertura } from '../domain/cobertura';
import { ProductoSchema } from '../domain/esquemas';
import * as repo from '../infrastructure/repositorio';

export async function listarProductos(
  soloVendibles = false
): Promise<Resultado<ProductoConCobertura[]>> {
  await exigirSesion();

  const { data, error } = await repo.buscarProductos(soloVendibles);
  if (error) return fallo(traducirError(error));

  const { data: movimientos } = await repo.consumoReciente();

  const consumo = new Map<string, number>();
  for (const m of movimientos ?? []) {
    const fila = m as { producto_id: string; cantidad: number };
    consumo.set(fila.producto_id, (consumo.get(fila.producto_id) ?? 0) + Math.abs(fila.cantidad));
  }

  const productos = (data ?? []) as Producto[];
  return exito(productos.map((p) => conCobertura(p, consumo.get(p.id) ?? 0)));
}

/** El stock NO se toca aquí: solo se mueve con movimientos registrados. */
export async function guardarProducto(
  entrada: z.input<typeof ProductoSchema>,
  id?: string
): Promise<Resultado<Producto>> {
  const parsed = ProductoSchema.safeParse(entrada);
  if (!parsed.success) {
    const p = parsed.error.issues[0];
    return fallo(p.message, String(p.path[0]));
  }

  const sesion = await exigirRol(...ROLES_ADMIN);

  const { data, error } = await repo.guardar(parsed.data, sesion.tenantId, id);
  if (error) return fallo(traducirError(error));

  revalidatePath('/inventario');
  return exito(data as Producto);
}

export async function desactivarProducto(id: string): Promise<Resultado<null>> {
  await exigirRol(...ROLES_ADMIN);

  const { error } = await repo.desactivar(id);
  if (error) return fallo(traducirError(error));

  revalidatePath('/inventario');
  return exito(null);
}
