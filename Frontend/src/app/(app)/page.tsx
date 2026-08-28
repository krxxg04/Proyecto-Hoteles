import { resumenPanel } from '@/modules/reportes/infrastructure/lecturas';
import { listarCuartos } from '@/modules/cuartos/infrastructure/lecturas';
import { miSesion } from '@/modules/auth/infrastructure/lecturas';
import { Panel } from '@/modules/reportes/ui/Panel';
import { ErrorCaja } from '@/shared/ui/primitivos';
import { exigirSeccion } from '@/shared/ui/guardia';

export default async function Inicio() {
  await exigirSeccion('inicio');

  const [resumen, cuartos, sesion] = await Promise.all([
    resumenPanel(),
    listarCuartos(),
    miSesion(),
  ]);

  if (!resumen.ok) return <ErrorCaja mensaje={resumen.error} />;

  return (
    <Panel
      resumen={resumen.datos}
      cuartos={cuartos.ok ? cuartos.datos : []}
      nombre={sesion?.nombre ?? ''}
    />
  );
}
