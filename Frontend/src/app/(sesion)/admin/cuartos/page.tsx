import {
  listarCaracteristicas,
  listarCuartos,
  listarTiposCuarto,
} from '@/modules/cuartos/infrastructure/lecturas';
import { VistaCuartosAdmin } from '@/modules/cuartos/ui/VistaCuartosAdmin';
import { ErrorCaja } from '@/shared/ui/primitivos';

export default async function AdminCuartos() {
  const [cuartos, tipos, caracteristicas] = await Promise.all([
    listarCuartos(),
    listarTiposCuarto(),
    listarCaracteristicas(),
  ]);
  if (!cuartos.ok) return <ErrorCaja mensaje={cuartos.error} />;

  return (
    <VistaCuartosAdmin
      cuartos={cuartos.datos}
      tipos={tipos.ok ? tipos.datos : []}
      caracteristicas={caracteristicas.ok ? caracteristicas.datos : []}
    />
  );
}
