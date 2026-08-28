import { z } from 'zod';
import { CATEGORIAS_PRODUCTO, CLASES_PRODUCTO } from './tipos';

export const ProductoSchema = z
  .object({
    nombre: z.string().trim().min(2, 'El nombre es obligatorio').max(120),
    icono: z.string().trim().max(40).default('package'),
    unidad: z.string().trim().min(1, 'Indica la unidad (unid., rollos, juegos...)').max(20),
    stock_max: z.coerce.number().positive('El máximo debe ser mayor que cero'),
    categoria: z.enum(CATEGORIAS_PRODUCTO),
    clase: z.enum(CLASES_PRODUCTO),
    precio: z.coerce.number().min(0, 'El precio no puede ser negativo'),
  })
  .refine((d) => d.categoria !== 'vendible' || d.precio > 0, {
    message: 'Un producto vendible necesita precio',
    path: ['precio'],
  });

export const MovimientoSchema = z.object({
  producto_id: z.string().uuid(),
  cantidad: z.coerce.number().positive('La cantidad debe ser mayor que cero'),
  cuarto_id: z.string().uuid().optional().nullable(),
  motivo: z.string().trim().max(300).optional(),
});

export const AjusteSchema = z.object({
  producto_id: z.string().uuid(),
  cantidad: z.coerce.number().refine((n) => n !== 0, 'La cantidad no puede ser cero'),
  tipo: z.enum(['danio', 'perdida', 'ajuste', 'devolucion']),
  motivo: z.string().trim().min(3, 'Explica el motivo del ajuste'),
});
