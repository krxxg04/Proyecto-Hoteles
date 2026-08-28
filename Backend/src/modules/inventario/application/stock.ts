'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { exigirSesion, exigirRol, ROLES_CAJA } from '@/shared/sesion';
import { exito, fallo, traducirError, type Resultado } from '@/shared/resultado';
import { MovimientoSchema, AjusteSchema } from '../domain/esquemas';
import * as repo from '../infrastructure/repositorio';

/**
 * Todo lo que mueve stock pasa por funciones SQL: el permiso de escritura sobre
 * `movimientos_inventario` está revocado, así que stock y movimiento se escriben juntos o nada.
 */

/** Entrada de mercadería. Suma stock. */
export async function registrarCompra(
  entrada: z.input<typeof MovimientoSchema>
): Promise<Resultado<null>> {
  const parsed = MovimientoSchema.safeParse(entrada);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  await exigirRol(...ROLES_CAJA);

  const { error } = await repo.registrarCompraEn(
    parsed.data.producto_id,
    parsed.data.cantidad,
    parsed.data.motivo ?? null
  );
  if (error) return fallo(traducirError(error));

  revalidatePath('/inventario');
  return exito(null);
}

/** Entrega a una habitación (toallas, papel...). Resta stock, no cobra. */
export async function entregarACuarto(
  entrada: z.input<typeof MovimientoSchema>
): Promise<Resultado<null>> {
  const parsed = MovimientoSchema.safeParse(entrada);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  if (!parsed.data.cuarto_id) return fallo('Indica a qué habitación se entrega', 'cuarto_id');

  await exigirSesion(); // limpieza también entrega insumos

  const { error } = await repo.entregar(
    parsed.data.producto_id,
    parsed.data.cantidad,
    parsed.data.cuarto_id
  );
  if (error) return fallo(traducirError(error));

  revalidatePath('/inventario');
  return exito(null);
}

/** Ajuste manual (daño, pérdida, corrección). Exige motivo siempre. */
export async function ajustarStock(
  entrada: z.input<typeof AjusteSchema>
): Promise<Resultado<null>> {
  const parsed = AjusteSchema.safeParse(entrada);
  if (!parsed.success) {
    const p = parsed.error.issues[0];
    return fallo(p.message, String(p.path[0]));
  }

  await exigirRol(...ROLES_CAJA);

  // Daño y pérdida siempre restan; ajuste puede ir en cualquier dirección.
  const cantidad =
    parsed.data.tipo === 'danio' || parsed.data.tipo === 'perdida'
      ? -Math.abs(parsed.data.cantidad)
      : parsed.data.cantidad;

  const { error } = await repo.registrarMovimiento(
    parsed.data.producto_id,
    parsed.data.tipo === 'devolucion' ? 'ajuste' : parsed.data.tipo,
    cantidad,
    parsed.data.motivo
  );
  if (error) return fallo(traducirError(error));

  revalidatePath('/inventario');
  return exito(null);
}

/** Kardex: los últimos movimientos, con quién y por qué. */
export async function movimientosRecientes(productoId?: string, limite = 100) {
  await exigirSesion();

  const { data, error } = await repo.buscarMovimientos(productoId, limite);
  if (error) return fallo(traducirError(error));
  return exito(data ?? []);
}
