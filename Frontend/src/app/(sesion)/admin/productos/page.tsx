import { listarProductos } from '@/modules/inventario/infrastructure/lecturas';
import { VistaProductosAdmin } from '@/modules/inventario/ui/VistaProductosAdmin';
import { ErrorCaja } from '@/shared/ui/primitivos';

export default async function AdminProductos() {
  const r = await listarProductos();
  if (!r.ok) return <ErrorCaja mensaje={r.error} />;

  return <VistaProductosAdmin productos={r.datos} />;
}
