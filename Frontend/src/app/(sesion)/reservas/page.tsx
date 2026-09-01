import { listarReservas } from '@/modules/reservas/infrastructure/lecturas';
import { listarTiposCuarto } from '@/modules/cuartos/infrastructure/lecturas';
import { VistaReservas } from '@/modules/reservas/ui/VistaReservas';
import { ErrorCaja } from '@/shared/ui/primitivos';
import { exigirSeccion } from '@/shared/ui/guardia';

export default async function Reservas() {
  await exigirSeccion('reservas');

  const [reservas, tipos] = await Promise.all([listarReservas(true), listarTiposCuarto()]);
  if (!reservas.ok) return <ErrorCaja mensaje={reservas.error} />;

  return <VistaReservas reservas={reservas.datos} tipos={tipos.ok ? tipos.datos : []} />;
}
