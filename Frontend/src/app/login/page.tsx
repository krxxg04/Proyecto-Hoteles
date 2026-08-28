import { redirect } from 'next/navigation';
import { miSesion } from '@/modules/auth/infrastructure/lecturas';
import { FormularioLogin } from '@/modules/auth/ui/FormularioLogin';
import { INICIO_POR_ROL } from '@/shared/ui/navegacion';

export default async function Login() {
  const sesion = await miSesion();
  if (sesion) redirect(INICIO_POR_ROL[sesion.rol] ?? '/');

  return <FormularioLogin />;
}
