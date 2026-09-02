import { redirect } from 'next/navigation';
import { miSesion } from '@/modules/auth/infrastructure/lecturas';
import { FormularioCambioPin } from '@/modules/auth/ui/FormularioCambioPin';
import { INICIO_POR_ROL } from '@/shared/ui/navegacion';

/**
 * Fuera del grupo `(sesion)` a propósito: ese layout redirige aquí cuando el PIN es
 * temporal, y dentro se redirigiría a sí misma para siempre. Igual que `/login`.
 */
export default async function CambiarPin() {
  const sesion = await miSesion();
  if (!sesion) redirect('/login');

  return (
    <FormularioCambioPin
      obligatorio={!!sesion.pinTemporal}
      destino={INICIO_POR_ROL[sesion.rol] ?? '/'}
    />
  );
}
