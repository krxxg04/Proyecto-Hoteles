import type { EstadoCuarto } from '../domain/tipos';

/**
 * El flujo operativo de una habitación y cómo se le llama a cada paso.
 *
 * Vive aquí y no dentro de una vista porque hay dos pantallas que lo enseñan —
 * Habitaciones y Limpieza — y estaban usando verbos distintos para la misma acción
 * («Terminé de limpiar» en una, «Marcar inspección» en la otra). La misma persona ve
 * las dos en la misma jornada.
 *
 * El verbo está escrito desde quien lo pulsa, no desde la base de datos: quien limpia
 * no piensa «marcar inspección», piensa «ya terminé».
 */
export const SIGUIENTE_PASO: Partial<
  Record<EstadoCuarto, { estado: EstadoCuarto; verbo: string; icono: string }>
> = {
  checkout: { estado: 'limpieza', verbo: 'Empezar a limpiar', icono: 'BrushCleaning' },
  limpieza: { estado: 'inspeccion', verbo: 'Terminé de limpiar', icono: 'ClipboardList' },
  inspeccion: { estado: 'lista', verbo: 'Marcar como lista', icono: 'CheckCheck' },
  mantenimiento: { estado: 'limpieza', verbo: 'Ya está arreglada', icono: 'BrushCleaning' },
};

/** Lo que hay por atender, en orden de flujo y no de número. */
export const ORDEN_TRABAJO: EstadoCuarto[] = ['checkout', 'limpieza', 'inspeccion', 'mantenimiento'];

export function ordenarPorTrabajo<T extends { estado: EstadoCuarto; numero: string }>(
  cuartos: T[]
): T[] {
  return [...cuartos].sort(
    (a, b) =>
      ORDEN_TRABAJO.indexOf(a.estado) - ORDEN_TRABAJO.indexOf(b.estado) ||
      a.numero.localeCompare(b.numero)
  );
}
