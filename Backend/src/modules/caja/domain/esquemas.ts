import { MEDIOS_PAGO } from '@/shared/dominio/pago';
import { CATEGORIAS_GASTO } from './tipos';
import { z } from 'zod';

export const AperturaSchema = z.object({
  efectivo_contado: z.coerce.number().min(0, 'El efectivo no puede ser negativo'),
  justificacion: z.string().trim().max(500).optional(),
});

export const CierreSchema = z
  .object({
    conteos: z
      .array(
        z.object({
          producto_id: z.string().uuid(),
          contado: z.coerce.number().min(0, 'El conteo no puede ser negativo'),
          justificacion: z.string().trim().max(500).optional(),
        })
      )
      .min(1, 'Falta contar el inventario'),
    efectivo_contado: z.coerce.number().min(0, 'El efectivo no puede ser negativo'),
    justificacion_caja: z.string().trim().max(500).optional().nullable(),
    ajuste_monto: z.coerce.number().positive().optional().nullable(),
    ajuste_razon: z.string().trim().max(500).optional().nullable(),
  })
  .refine((d) => !d.ajuste_monto || !!d.ajuste_razon?.trim(), {
    message: 'Indica la razón del ajuste de caja',
    path: ['ajuste_razon'],
  });

/**
 * Un gasto. El resto de las reglas están en `registrar_gasto()`: que un fijo lleve producto
 * y cantidad, que un justificable lleve razón, y que sin turno abierto no se registre nada.
 */
export const GastoSchema = z
  .object({
    categoria: z.enum(CATEGORIAS_GASTO),
    concepto: z.string().trim().max(200).optional().default(''),
    monto: z.coerce.number().positive('El monto tiene que ser mayor que cero'),
    medio: z.enum(MEDIOS_PAGO).default('efectivo'),
    producto_id: z.string().uuid().optional().nullable(),
    cantidad: z.coerce.number().positive().optional().nullable(),
    justificacion: z.string().trim().max(500).optional().nullable(),
  })
  .refine((d) => d.categoria !== 'fijo' || (!!d.producto_id && !!d.cantidad), {
    message: 'Elige el producto y cuánto compraste',
    path: ['producto_id'],
  })
  .refine(
    (d) => d.categoria !== 'justificable' || (d.justificacion?.trim().length ?? 0) >= 3,
    { message: 'Explica en qué se gastó y por qué', path: ['justificacion'] }
  )
  .refine((d) => d.categoria !== 'justificable' || !!d.concepto?.trim(), {
    message: 'Dile un nombre al gasto',
    path: ['concepto'],
  });
