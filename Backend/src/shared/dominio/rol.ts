export const ROLES = ['administrador', 'recepcion', 'limpieza', 'mantenimiento'] as const;
export type Rol = (typeof ROLES)[number];

export const ETIQUETA_ROL: Record<Rol, string> = {
  administrador: 'Administrador',
  recepcion: 'Recepción',
  limpieza: 'Limpieza',
  mantenimiento: 'Mantenimiento',
};
