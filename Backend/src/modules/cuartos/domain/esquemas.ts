import { z } from 'zod';
import { ESTADOS_CUARTO } from './tipos';

export const CambioEstadoSchema = z.object({
  cuarto_id: z.string().uuid(),
  estado: z.enum(ESTADOS_CUARTO),
  nota: z.string().trim().max(300).optional(),
});

export const TipoCuartoSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es obligatorio').max(80),
  aforo: z.coerce.number().int().min(1).max(12),
  costo: z.coerce.number().min(0, 'El precio no puede ser negativo'),
  horas_lj: z.coerce.number().int().min(1).max(24),
  horas_vd: z.coerce.number().int().min(1).max(24),
  hora_extra: z.coerce.number().min(0),
  amanecida: z.coerce.number().min(0),
  amanecida_vd: z.coerce.number().min(0),
  deposito: z.coerce.number().min(0),
});

export const CuartoSchema = z.object({
  numero: z.string().trim().min(1, 'El número es obligatorio').max(10),
  tipo_id: z.string().uuid('Elige un tipo de cuarto'),
  aforo: z.coerce.number().int().min(1).max(12),
  caracteristicas: z.array(z.string()).default([]),
  nota: z.string().trim().max(300).optional().or(z.literal('')),
  tarifa_costo: z.coerce.number().min(0).optional().nullable(),
  tarifa_amanecida: z.coerce.number().min(0).optional().nullable(),
});
