import { z } from 'zod';

export const LoginSchema = z.object({
  dni: z
    .string()
    .trim()
    .min(6, 'El DNI debe tener al menos 6 dígitos')
    .max(20, 'DNI demasiado largo')
    .regex(/^[0-9A-Za-z-]+$/, 'El DNI solo puede tener números y letras'),
  pin: z.string().min(4, 'El PIN debe tener al menos 4 dígitos').max(64),
  /** Solo hace falta si el mismo DNI trabaja en más de un hostal. */
  hostal: z.string().trim().max(60).optional(),
});

export const CambioPinSchema = z.object({
  pinActual: z.string().min(4),
  pinNuevo: z.string().min(4, 'El PIN nuevo debe tener al menos 4 dígitos').max(64),
});
