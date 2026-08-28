import { z } from 'zod';
import { BYTES_MAXIMOS, MIMES_PERMITIDOS, TIPOS_MEDIO } from './tipos';

/**
 * Lo que el cliente puede pedir subir.
 *
 * El tipo y el tamaño se validan aquí Y se firman en la URL de R2: si solo se validaran
 * aquí, la URL firmada seguiría sirviendo para subir un vídeo de 2 GB.
 */
export const PermisoSubidaSchema = z
  .object({
    tipo: z.enum(TIPOS_MEDIO),
    mime: z.enum(MIMES_PERMITIDOS, { message: 'Solo se aceptan imágenes JPEG, WebP o PNG.' }),
    bytes: z.coerce
      .number()
      .int()
      .positive()
      .max(BYTES_MAXIMOS, `La imagen supera el máximo permitido (${Math.round(BYTES_MAXIMOS / 1024)} KB). Comprímela antes de subirla.`),
    huesped_id: z.string().uuid().optional().nullable(),
    estadia_id: z.string().uuid().optional().nullable(),
    /** Para `dni` y `rostro`: cómo se recogió el consentimiento. */
    consentimiento: z.string().trim().max(300).optional(),
  })
  .refine((d) => !['dni', 'rostro'].includes(d.tipo) || !!d.huesped_id, {
    message: 'Una foto de documento o de rostro tiene que ir asociada a un huésped.',
    path: ['huesped_id'],
  });
