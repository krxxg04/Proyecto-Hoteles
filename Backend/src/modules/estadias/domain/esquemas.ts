import { z } from 'zod';
import { MEDIOS_PAGO } from '@/shared/dominio/pago';
import { TIPOS_DOC } from '@/shared/dominio/documento';
import { MODOS_ESTADIA } from './tipos';

export const CheckinSchema = z
  .object({
    cuarto_id: z.string().uuid('Elige una habitación'),
    modo: z.enum(MODOS_ESTADIA),
    horas: z.coerce.number().int().positive().max(24).optional().nullable(),
    noches: z.coerce.number().int().positive().max(60).optional().nullable(),
    fecha_entrada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').optional(),
    personas: z.coerce.number().int().min(1).max(12).default(1),

    nombre: z.string().trim().min(2, 'El nombre del huésped es obligatorio').max(160),
    tipo_doc: z.enum(TIPOS_DOC).default('DNI'),
    num_doc: z.string().trim().min(6, 'El documento es obligatorio').max(20),
    telefono: z.string().trim().max(30).optional().or(z.literal('')),

    medio: z.enum(MEDIOS_PAGO),
    banco: z.string().trim().max(40).optional().nullable(),

    acompanantes: z
      .array(
        z.object({
          nombre: z.string().trim().min(2, 'Falta el nombre de un acompañante'),
          tipo_doc: z.string().trim().max(30).optional(),
          num_doc: z.string().trim().max(20).optional(),
        })
      )
      .default([]),
  })
  .refine((d) => d.modo !== 'horas' || (d.horas ?? 0) > 0, {
    message: 'Indica cuántas horas',
    path: ['horas'],
  })
  .refine((d) => d.modo !== 'rango' || (d.noches ?? 0) > 0, {
    message: 'Indica cuántas noches',
    path: ['noches'],
  })
  .refine((d) => d.medio !== 'tarjeta' || !!d.banco, {
    message: 'Indica el banco de la tarjeta',
    path: ['banco'],
  })
  .refine((d) => d.acompanantes.length <= d.personas - 1, {
    message: 'Hay más acompañantes que personas declaradas',
    path: ['acompanantes'],
  });

export const InspeccionSchema = z.object({
  cuarto_id: z.string().uuid(),
  estadia_id: z.string().uuid().optional().nullable(),
  resultado: z
    .array(
      z.object({
        item: z.string().trim().min(1),
        icono: z.string().trim().max(40).optional(),
        esperado: z.coerce.number().int().min(0),
        confirmado: z.coerce.number().int().min(0),
        nota: z.string().trim().max(300).optional(),
      })
    )
    .min(1, 'La inspección no puede ir vacía'),
  nota: z.string().trim().max(1000).optional(),
  /** Foto de la inspección, ya subida a R2. Se guarda el id del medio, no la llave. */
  medio_id: z.string().uuid().optional().nullable(),
  /** El paso siguiente del flujo. Se pide explícito para no mover cuartos sin querer. */
  pasar_a_limpieza: z.boolean().default(false),
});
