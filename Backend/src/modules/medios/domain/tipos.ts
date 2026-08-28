/**
 * Archivos en Cloudflare R2 (ADR-001 §4). El bucket es PRIVADO: la base guarda la
 * llave del objeto, jamás una URL pública, y cada acceso se sirve con una URL firmada
 * que caduca.
 */

/** Para qué es cada archivo. Determina cuánto se conserva y quién puede pedirlo. */
export const TIPOS_MEDIO = ['dni', 'rostro', 'inspeccion', 'incidente', 'clip'] as const;
export type TipoMedio = (typeof TIPOS_MEDIO)[number];

/**
 * Retención por tipo, en días (Ley 29733: conservar solo lo necesario y por el tiempo
 * necesario). `null` = sin caducidad automática; hoy nada la usa a propósito.
 *
 * Los datos sensibles duran lo mínimo: el DNI y el rostro se guardan para poder
 * responder ante un incidente durante la estadía y poco más. Una foto de inspección
 * sirve para discutir un faltante, y un incidente puede acabar en un reclamo.
 */
export const RETENCION_DIAS: Record<TipoMedio, number | null> = {
  dni: 90,
  rostro: 90,
  inspeccion: 180,
  incidente: 365,
  clip: 30,
};

/** Los datos sensibles del §4: exigen consentimiento registrado antes de subir nada. */
export const EXIGE_CONSENTIMIENTO: TipoMedio[] = ['dni', 'rostro'];

/**
 * Lo que se acepta subir. Sin esto, una URL firmada de subida es un agujero: quien la
 * tenga puede poner cualquier cosa en el bucket.
 */
export const MIMES_PERMITIDOS = ['image/jpeg', 'image/webp', 'image/png'] as const;

/** ai-media.md pide comprimir a ~150 KB. Esto es el techo duro del servidor. */
export const BYTES_MAXIMOS = 400 * 1024;

export type Medio = {
  id: string;
  bucket: string;
  object_key: string;
  mime: string | null;
  bytes: number | null;
  tipo: TipoMedio;
  huesped_id: string | null;
  estadia_id: string | null;
  retener_hasta: string | null;
  created_at: string;
};

/** Lo que el navegador necesita para subir el archivo por su cuenta, sin pasar por el backend. */
export type PermisoDeSubida = {
  medio_id: string;
  url: string;
  metodo: 'PUT';
  cabeceras: Record<string, string>;
  expira_en_segundos: number;
};
