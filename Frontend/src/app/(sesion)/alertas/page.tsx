import { listarIncidencias } from '@/modules/caja/infrastructure/lecturas';
import { resumenPanel } from '@/modules/reportes/infrastructure/lecturas';
import { VistaIncidencias } from '@/modules/caja/ui/VistaIncidencias';
import { ErrorCaja } from '@/shared/ui/primitivos';
import { exigirSeccion } from '@/shared/ui/guardia';

export default async function Alertas() {
  await exigirSeccion('alertas');

  const [incidencias, resumen] = await Promise.all([listarIncidencias(true), resumenPanel()]);
  if (!incidencias.ok) return <ErrorCaja mensaje={incidencias.error} />;

  return (
    <VistaIncidencias
      incidencias={incidencias.datos}
      bajoMinimo={resumen.ok ? resumen.datos.bajoMinimo : []}
    />
  );
}
