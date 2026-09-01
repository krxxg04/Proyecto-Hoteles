import { redirect } from 'next/navigation';
import { miSesion } from '@/modules/auth/infrastructure/lecturas';
import { INICIO_POR_ROL } from '@/shared/ui/navegacion';

/**
 * Administración solo para el administrador.
 *
 * El menú ya no muestra estas secciones a los demás, pero el menú no es una puerta:
 * escribiendo la URL se llegaba igual. El RLS impide escribir, y eso sigue siendo lo
 * que de verdad protege — esto es para que nadie vea una pantalla que no le toca.
 */
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const sesion = await miSesion();
  if (!sesion) redirect('/login');
  if (sesion.rol !== 'administrador') redirect(INICIO_POR_ROL[sesion.rol]);

  return <>{children}</>;
}
