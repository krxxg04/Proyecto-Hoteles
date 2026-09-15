import { listarPersonal, obtenerConfiguracionPersonal } from '@/modules/personal/infrastructure/lecturas';
import { VistaPersonal } from '@/modules/personal/ui/VistaPersonal';
import { ErrorCaja } from '@/shared/ui/primitivos';

export default async function AdminPersonas() {
  const [r, config] = await Promise.all([listarPersonal(), obtenerConfiguracionPersonal()]);
  if (!r.ok) return <ErrorCaja mensaje={r.error} />;

  return (
    <VistaPersonal
      personal={r.datos}
      limpiezaHabilitada={config.ok ? config.datos.limpiezaHabilitada : true}
    />
  );
}
