import {
  estadoCaja,
  listarGastos,
  resumenVentasTurno,
} from '@/modules/caja/infrastructure/lecturas';
import { listarProductos } from '@/modules/inventario/infrastructure/lecturas';
import { VistaCaja } from '@/modules/caja/ui/VistaCaja';
import { ErrorCaja } from '@/shared/ui/primitivos';
import { exigirSeccion } from '@/shared/ui/guardia';

export default async function Caja() {
  await exigirSeccion('caja');

  const [caja, ventas, gastos, productos] = await Promise.all([
    estadoCaja(),
    resumenVentasTurno(),
    listarGastos(),
    listarProductos(),
  ]);
  if (!caja.ok) return <ErrorCaja mensaje={caja.error} />;

  return (
    <VistaCaja
      caja={caja.datos}
      ventas={ventas.ok ? ventas.datos : { total: 0, por_medio: {}, cantidad: 0 }}
      gastos={gastos.ok ? gastos.datos : []}
      productos={productos.ok ? productos.datos : []}
    />
  );
}
