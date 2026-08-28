import { listarCuartos } from '@/modules/cuartos/infrastructure/lecturas';
import { historialInspecciones, plantillaInspeccion } from '@/modules/estadias/infrastructure/lecturas';
import { VistaInspeccion } from '@/modules/estadias/ui/VistaInspeccion';
import { ErrorCaja } from '@/shared/ui/primitivos';
import { exigirSeccion } from '@/shared/ui/guardia';

/** `?cuarto=<id>` abre el checklist. Sin él, la lista de lo que hay por revisar. */
export default async function Inspeccion({
  searchParams,
}: {
  searchParams: Promise<{ cuarto?: string }>;
}) {
  await exigirSeccion('inspeccion');

  const { cuarto } = await searchParams;

  const [cuartos, historial, plantilla] = await Promise.all([
    listarCuartos(),
    historialInspecciones(),
    cuarto ? plantillaInspeccion(cuarto) : Promise.resolve(null),
  ]);

  if (!cuartos.ok) return <ErrorCaja mensaje={cuartos.error} />;
  if (plantilla && !plantilla.ok) return <ErrorCaja mensaje={plantilla.error} />;

  return (
    <VistaInspeccion
      cuartos={cuartos.datos}
      plantilla={plantilla?.ok ? plantilla.datos : null}
      historial={historial.ok ? historial.datos : []}
    />
  );
}
