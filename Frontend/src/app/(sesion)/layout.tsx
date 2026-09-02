import { redirect } from 'next/navigation';
import { miSesion } from '@/modules/auth/infrastructure/lecturas';
import { resumenPanel } from '@/modules/reportes/infrastructure/lecturas';
import { listarAlertas } from '@/modules/caja/infrastructure/lecturas';
import { Chasis } from '@/shared/ui/Chasis';

/** Todo lo de dentro exige sesión. El proxy ya corta antes, esto es la segunda red. */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sesion = await miSesion();
  if (!sesion) redirect('/login');

  /**
   * Con un PIN que puso otra persona no se entra a la app.
   *
   * El PIN que el proveedor entrega al dar de alta un hostal, o el que un administrador
   * reinicia, lo conoce quien lo puso. En un sistema que guarda la caja del negocio eso
   * no puede quedarse así: se cambia antes de tocar nada. Migración 14.
   */
  if (sesion.pinTemporal) redirect('/cambiar-pin');

  // Solo para el punto de la campana. Si falla, sale sin punto y ya.
  const [resumen, alertas] = await Promise.all([resumenPanel(), listarAlertas()]);

  /**
   * Las tres cosas que se atienden desde Alertas, en un solo número: descuadres sin
   * revisar, productos bajo su mínimo y movimientos raros de caja. Contar solo dos dejaba
   * un gasto justificable visible en la pantalla pero sin encender la campana.
   */
  const porAtender =
    (resumen.ok ? resumen.datos.incidenciasAbiertas + resumen.datos.bajoMinimo.length : 0) +
    (alertas.ok ? alertas.datos.length : 0);

  return (
    <Chasis sesion={sesion} incidenciasAbiertas={porAtender}>
      {children}
    </Chasis>
  );
}
