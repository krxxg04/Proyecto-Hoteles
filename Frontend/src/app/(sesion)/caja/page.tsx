import { estadoCaja, resumenVentasTurno } from '@/modules/caja/infrastructure/lecturas';
import { VistaCaja } from '@/modules/caja/ui/VistaCaja';
import { ErrorCaja } from '@/shared/ui/primitivos';
import { exigirSeccion } from '@/shared/ui/guardia';

export default async function Caja() {
  await exigirSeccion('caja');

  const [caja, ventas] = await Promise.all([estadoCaja(), resumenVentasTurno()]);
  if (!caja.ok) return <ErrorCaja mensaje={caja.error} />;

  return (
    <VistaCaja
      caja={caja.datos}
      ventas={ventas.ok ? ventas.datos : { total: 0, por_medio: {}, cantidad: 0 }}
    />
  );
}
