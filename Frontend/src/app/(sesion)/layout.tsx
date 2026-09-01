import { redirect } from 'next/navigation';
import { miSesion } from '@/modules/auth/infrastructure/lecturas';
import { resumenPanel } from '@/modules/reportes/infrastructure/lecturas';
import { Chasis } from '@/shared/ui/Chasis';

/** Todo lo de dentro exige sesión. El proxy ya corta antes, esto es la segunda red. */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sesion = await miSesion();
  if (!sesion) redirect('/login');

  // Solo para el punto de la campana. Si falla, sale sin punto y ya.
  const resumen = await resumenPanel();

  return (
    <Chasis
      sesion={sesion}
      incidenciasAbiertas={resumen.ok ? resumen.datos.incidenciasAbiertas : 0}
    >
      {children}
    </Chasis>
  );
}
