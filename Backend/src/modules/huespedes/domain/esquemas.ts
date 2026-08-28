import { z } from 'zod';
import { TIPOS_DOC } from '@/shared/dominio/documento';

export const HuespedSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es obligatorio').max(160),
  tipo_doc: z.enum(TIPOS_DOC).default('DNI'),
  num_doc: z
    .string()
    .trim()
    .min(6, 'El número de documento es obligatorio')
    .max(20)
    .regex(/^[0-9A-Za-z-]+$/, 'El documento solo puede tener números y letras'),
  telefono: z.string().trim().max(30).optional().or(z.literal('')),
  email: z.string().trim().email('Correo inválido').optional().or(z.literal('')),
  nacionalidad: z.string().trim().max(60).optional().or(z.literal('')),
  notas: z.string().trim().max(1000).optional().or(z.literal('')),
});
