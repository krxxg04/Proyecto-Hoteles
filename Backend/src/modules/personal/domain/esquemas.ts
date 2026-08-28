import { z } from 'zod';
import { ROLES } from '@/shared/dominio/rol';

export const PersonaSchema = z.object({
  dni: z
    .string()
    .trim()
    .min(6, 'El DNI debe tener al menos 6 dígitos')
    .max(20)
    .regex(/^[0-9A-Za-z-]+$/, 'El DNI solo puede tener números y letras'),
  nombre: z.string().trim().min(2, 'El nombre es obligatorio').max(160),
  rol: z.enum(ROLES),
  telefono: z.string().trim().max(30).optional().or(z.literal('')),
  pin: z
    .string()
    .min(4, 'El PIN debe tener al menos 4 dígitos')
    .max(64)
    .regex(/^[0-9]+$/, 'El PIN solo puede tener números'),
});

export const ActualizarPersonaSchema = PersonaSchema.omit({ pin: true, dni: true });
