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
    sencillo_dejar: z.coerce.number().min(0, 'El sencillo no puede ser negativo'),
    ajuste_monto: z.coerce.number().positive().optional().nullable(),
    ajuste_razon: z.string().trim().max(500).optional().nullable(),
  })
  .refine((d) => !d.ajuste_monto || !!d.ajuste_razon?.trim(), {
    message: 'Indica la razón del ajuste de caja',
    path: ['ajuste_razon'],
  });
