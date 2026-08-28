import { listarCuartos } from '@/modules/cuartos/infrastructure/lecturas';
import { listarAseoPendiente } from '@/modules/inventario/infrastructure/lecturas';
import { VistaLimpieza } from '@/modules/inventario/ui/VistaLimpieza';
import { ErrorCaja } from '@/shared/ui/primitivos';
import { exigirSeccion } from '@/shared/ui/guardia';

export default async function Limpieza() {
  await exigirSeccion('limpieza');

  const [cuartos, aseo] = await Promise.all([listarCuartos(), listarAseoPendiente()]);
  if (!cuartos.ok) return <ErrorCaja mensaje={cuartos.error} />;

  return <VistaLimpieza cuartos={cuartos.datos} aseo={aseo.ok ? aseo.datos : []} />;
}
