import { listarPersonal } from '@/modules/personal/infrastructure/lecturas';
import { VistaPersonal } from '@/modules/personal/ui/VistaPersonal';
import { ErrorCaja } from '@/shared/ui/primitivos';

export default async function AdminPersonas() {
  const r = await listarPersonal();
  if (!r.ok) return <ErrorCaja mensaje={r.error} />;

  return <VistaPersonal personal={r.datos} />;
}
