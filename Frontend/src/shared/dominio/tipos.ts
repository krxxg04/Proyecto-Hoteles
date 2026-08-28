/**
 * Tipos del dominio, espejo de lo que devuelve el backend.
 *
 * Se duplican a propósito: son dos apps. El contrato que las mantiene honestas es
 * `/api/openapi` — si una ruta cambia allí y aquí no, se nota al compilar o al probar.
 */

export const ROLES = ['administrador', 'recepcion', 'limpieza', 'mantenimiento'] as const;
export type Rol = (typeof ROLES)[number];

export const ETIQUETA_ROL: Record<Rol, string> = {
  administrador: 'Administrador',
  recepcion: 'Recepción',
  limpieza: 'Limpieza',
  mantenimiento: 'Mantenimiento',
};

export const MEDIOS_PAGO = ['efectivo', 'yape', 'plin', 'tarjeta'] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];

export const ETIQUETA_MEDIO: Record<MedioPago, string> = {
  efectivo: 'Efectivo',
  yape: 'Yape',
  plin: 'Plin',
  tarjeta: 'Tarjeta',
};

export type Sesion = {
  usuarioId: string;
  tenantId: string;
  rol: Rol;
  nombre: string;
  dni: string;
  /** Nombre y plan del hostal. Los rellena `GET /api/auth`. */
  hostal?: string;
  plan?: 'base' | 'premium';
};
