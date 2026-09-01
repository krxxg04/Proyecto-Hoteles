import { catalogos } from '@/modules/estadias/infrastructure/lecturas';
import { estadoCaja } from '@/modules/caja/infrastructure/lecturas';
import { VistaCheckin } from '@/modules/estadias/ui/VistaCheckin';
import { ErrorCaja } from '@/shared/ui/primitivos';
import { exigirSeccion } from '@/shared/ui/guardia';

export default async function Checkin() {
  await exigirSeccion('checkin');

  const [cat, caja] = await Promise.all([catalogos(), estadoCaja()]);
  if (!cat.ok) return <ErrorCaja mensaje={cat.error} />;

  return (
    <VistaCheckin
      catalogos={cat.datos}
      turnoAbierto={caja.ok && caja.datos.turno?.estado === 'abierto'}
    />
  );
}
