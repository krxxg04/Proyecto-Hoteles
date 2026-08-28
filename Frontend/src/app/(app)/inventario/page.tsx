import { listarProductos } from '@/modules/inventario/infrastructure/lecturas';
import { listarCuartos } from '@/modules/cuartos/infrastructure/lecturas';
import { VistaInventario } from '@/modules/inventario/ui/VistaInventario';
import { ErrorCaja } from '@/shared/ui/primitivos';
import { exigirSeccion } from '@/shared/ui/guardia';

export default async function Inventario() {
  const sesion = await exigirSeccion('inventario');

  const [productos, cuartos] = await Promise.all([listarProductos(), listarCuartos()]);
  if (!productos.ok) return <ErrorCaja mensaje={productos.error} />;

  return (
    <VistaInventario
      productos={productos.datos}
      cuartos={cuartos.ok ? cuartos.datos : []}
      rol={sesion.rol}
    />
  );
}
