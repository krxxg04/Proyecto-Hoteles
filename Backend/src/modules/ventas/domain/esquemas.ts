import { z } from 'zod';
import { MEDIOS_PAGO } from '@/shared/dominio/pago';

/** No hay campo `monto`: el precio sale del catálogo dentro de la base. */
export const VentaSchema = z
  .object({
    producto_id: z.string().uuid('Elige un producto'),
    cantidad: z.coerce.number().positive('La cantidad debe ser mayor que cero'),
    cuarto_id: z.string().uuid().optional().nullable(),
    medio: z.enum(MEDIOS_PAGO),
    banco: z.string().trim().max(40).optional().nullable(),
  })
  .refine((d) => d.medio !== 'tarjeta' || !!d.banco, {
    message: 'Indica el banco de la tarjeta',
    path: ['banco'],
  });
