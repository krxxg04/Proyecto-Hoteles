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
 * no piensa «marcar como lista», piensa «ya terminé».
 *
 * El flujo es `ocupada -> inspeccion -> limpieza -> lista` desde
 * `15_sin_estado_checkout.sql`: la revisión de salida va ANTES de limpiar, no después.
 * `inspeccion` no aparece en la vista de piso porque solo recepción la mueve — quien
 * limpia entra en el flujo cuando el cuarto ya está revisado.
 */
export const SIGUIENTE_PASO: Partial<
  Record<EstadoCuarto, { estado: EstadoCuarto; verbo: string; icono: string }>
> = {
  inspeccion: { estado: 'limpieza', verbo: 'Revisado, a limpiar', icono: 'BrushCleaning' },
  limpieza: { estado: 'lista', verbo: 'Terminé de limpiar', icono: 'CheckCheck' },
  mantenimiento: { estado: 'limpieza', verbo: 'Ya está arreglada', icono: 'BrushCleaning' },
};

/** Lo que hay por atender, en orden de flujo y no de número. */
export const ORDEN_TRABAJO: EstadoCuarto[] = ['inspeccion', 'limpieza', 'mantenimiento'];

export function ordenarPorTrabajo<T extends { estado: EstadoCuarto; numero: string }>(
  cuartos: T[]
): T[] {
  return [...cuartos].sort(
    (a, b) =>
      ORDEN_TRABAJO.indexOf(a.estado) - ORDEN_TRABAJO.indexOf(b.estado) ||
      a.numero.localeCompare(b.numero)
  );
}
