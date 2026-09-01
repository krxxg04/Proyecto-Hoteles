import {
  listarCaracteristicas,
  listarCuartos,
  listarTiposCuarto,
} from '@/modules/cuartos/infrastructure/lecturas';
import { VistaCuartosAdmin } from '@/modules/cuartos/ui/VistaCuartosAdmin';
import { ErrorCaja } from '@/shared/ui/primitivos';

export default async function AdminCuartos() {
  // Con inactivos: esta es la única pantalla donde se vuelven a habilitar.
  const [cuartos, tipos, caracteristicas] = await Promise.all([
    listarCuartos(true),
    listarTiposCuarto(true),
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
