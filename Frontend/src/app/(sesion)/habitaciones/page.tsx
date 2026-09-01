import { listarCuartos } from '@/modules/cuartos/infrastructure/lecturas';
import { listarProductos } from '@/modules/inventario/infrastructure/lecturas';
import { VistaHabitaciones } from '@/modules/cuartos/ui/VistaHabitaciones';
import { VistaHabitacionesPiso } from '@/modules/cuartos/ui/VistaHabitacionesPiso';
import { ErrorCaja } from '@/shared/ui/primitivos';
import { exigirSeccion } from '@/shared/ui/guardia';
import { esDeCaja } from '@/shared/ui/navegacion';

/**
 * Dos vistas, no una.
 *
 * Recepción y administración necesitan poder corregir cualquier estado, así que ven la
 * rejilla completa con el panel de la habitación. Limpieza y mantenimiento ven su lista
 * de trabajo con un solo botón: el paso siguiente (`plan.md` línea 42).
 */
export default async function Habitaciones() {
  const sesion = await exigirSeccion('habitaciones');

  const cuartos = await listarCuartos();
  if (!cuartos.ok) return <ErrorCaja mensaje={cuartos.error} />;

  if (!esDeCaja(sesion.rol)) return <VistaHabitacionesPiso cuartos={cuartos.datos} />;

  // El catálogo solo hace falta para las acciones rápidas del panel, que son de caja.
  const productos = await listarProductos();

  return (
    <VistaHabitaciones
      cuartos={cuartos.datos}
      rol={sesion.rol}
      productos={productos.ok ? productos.datos : []}
    />
  );
}
