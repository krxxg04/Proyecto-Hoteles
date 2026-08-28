import type { EstadoCuarto } from '../domain/tipos';

/**
 * Cómo se pinta cada estado. Portado del mockup (`STATE` en index.html), traducido a los
 * estados reales del esquema: el prototipo usaba 'Lista'/'Libre' capitalizados.
 */
export const ESTILO_ESTADO: Record<
  EstadoCuarto,
  { etiqueta: string; color: string; fondo: string; icono: string }
> = {
  lista: { etiqueta: 'Lista', color: '#22C55E', fondo: 'rgba(34,197,94,.14)', icono: 'check' },
  limpieza: { etiqueta: 'En limpieza', color: '#3B82F6', fondo: 'rgba(59,130,246,.14)', icono: 'brush' },
  inspeccion: { etiqueta: 'Inspección', color: '#F59E0B', fondo: 'rgba(245,158,11,.14)', icono: 'clipboard' },
  ocupada: { etiqueta: 'Ocupada', color: '#A8ADB3', fondo: 'rgba(168,173,179,.12)', icono: 'user' },
  checkout: { etiqueta: 'Check-out', color: '#EF4444', fondo: 'rgba(239,68,68,.14)', icono: 'logout' },
  libre: { etiqueta: 'Disponible', color: '#747B84', fondo: 'rgba(116,123,132,.14)', icono: 'bed' },
  mantenimiento: { etiqueta: 'Mantenimiento', color: '#8B5CF6', fondo: 'rgba(139,92,246,.16)', icono: 'wrench' },
};

/** Orden operativo típico de un hostal, del mockup (`ESTADOS_FLUJO`). */
export const FLUJO_ESTADOS: EstadoCuarto[] = [
  'libre', 'ocupada', 'checkout', 'limpieza', 'inspeccion', 'lista', 'mantenimiento',
];
