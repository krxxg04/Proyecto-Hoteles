import { listarIncidencias } from '@/modules/caja/infrastructure/lecturas';
import { VistaIncidencias } from '@/modules/caja/ui/VistaIncidencias';
import { ErrorCaja } from '@/shared/ui/primitivos';
import { exigirSeccion } from '@/shared/ui/guardia';

export default async function Alertas() {
  await exigirSeccion('alertas');

  const r = await listarIncidencias(true);
  if (!r.ok) return <ErrorCaja mensaje={r.error} />;

  return <VistaIncidencias incidencias={r.datos} />;
}
