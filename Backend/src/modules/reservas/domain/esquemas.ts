import { z } from 'zod';
import { ESTADOS_RESERVA } from './tipos';

/**
 * Lo mínimo para apuntar una reserva: cuándo llega y a nombre de quién.
 *
 * El cuarto concreto es opcional a propósito. En un hostal se reserva «una matrimonial
 * para el viernes», no la 205; asignar el número el mismo día es lo que deja margen
 * para cuadrar el tablero.
 */
export const ReservaSchema = z
  .object({
    nombre_contacto: z.string().trim().min(2, 'Pon a nombre de quién viene').max(160),
    telefono: z.string().trim().max(30).optional().or(z.literal('')),
    huesped_id: z.string().uuid().optional().nullable(),
    tipo_id: z.string().uuid('Elige un tipo de habitación').optional().nullable(),
    cuarto_id: z.string().uuid().optional().nullable(),
    fecha_entrada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Falta la fecha de entrada'),
    fecha_salida: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de salida inválida')
      .optional()
      .nullable(),
    personas: z.coerce.number().int().min(1).max(12).default(1),
    origen: z.string().trim().max(40).default('directo'),
    notas: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .refine((d) => !d.fecha_salida || d.fecha_salida >= d.fecha_entrada, {
    message: 'La salida no puede ser antes de la entrada',
    path: ['fecha_salida'],
  });

export const CambioEstadoReservaSchema = z.object({
  reserva_id: z.string().uuid(),
  estado: z.enum(ESTADOS_RESERVA),
});
