import { clienteServidor } from '@/shared/supabase/servidor';

export const CAMPOS =
  'id, nombre, icono, unidad, stock, stock_max, categoria, clase, precio, activo';

export async function buscarProductos(soloVendibles: boolean) {
  const supabase = await clienteServidor();

  let query = supabase.from('productos').select(CAMPOS).eq('activo', true).order('nombre');
  if (soloVendibles) query = query.eq('categoria', 'vendible');

  return query;
}

/** Salidas de los últimos 14 días, para estimar cobertura sin inventarse el número. */
export async function consumoReciente() {
  const supabase = await clienteServidor();
  const desde = new Date(Date.now() - 14 * 86_400_000).toISOString();

  return supabase
    .from('movimientos_inventario')
    .select('producto_id, cantidad')
    .lt('cantidad', 0)
    .in('tipo', ['venta', 'entrega', 'danio', 'perdida'])
    .gte('created_at', desde);
}

export async function guardar(valores: object, tenantId: string, id?: string) {
  const supabase = await clienteServidor();
  const query = id
    ? supabase.from('productos').update(valores).eq('id', id)
    : supabase.from('productos').insert({ ...valores, tenant_id: tenantId, stock: 0 });
  return query.select(CAMPOS).single();
}

export async function desactivar(id: string) {
  const supabase = await clienteServidor();
  return supabase.from('productos').update({ activo: false }).eq('id', id);
}

export async function registrarCompraEn(productoId: string, cantidad: number, motivo: string | null) {
  const supabase = await clienteServidor();
  return supabase.rpc('registrar_compra', {
    p_producto_id: productoId,
    p_cantidad: cantidad,
    p_motivo: motivo,
  });
}

export async function entregar(productoId: string, cantidad: number, cuartoId: string) {
  const supabase = await clienteServidor();
  return supabase.rpc('entregar_a_cuarto', {
    p_producto_id: productoId,
    p_cantidad: cantidad,
    p_cuarto_id: cuartoId,
  });
}

export async function registrarMovimiento(
  productoId: string,
  tipo: string,
  cantidad: number,
  motivo: string
) {
  const supabase = await clienteServidor();
  return supabase.rpc('registrar_movimiento', {
    p_producto_id: productoId,
    p_tipo: tipo,
    p_cantidad: cantidad,
    p_cuarto_id: null,
    p_motivo: motivo,
  });
}

export async function buscarMovimientos(productoId: string | undefined, limite: number) {
  const supabase = await clienteServidor();

  let query = supabase
    .from('movimientos_inventario')
    .select(
      'id, tipo, cantidad, motivo, created_at, productos(nombre, unidad), cuartos(numero), profiles(nombre)'
    )
    .order('created_at', { ascending: false })
    .limit(limite);

  if (productoId) query = query.eq('producto_id', productoId);
  return query;
}

export async function enviarAseo(productoId: string, cantidad: number, cuartoId: string | null) {
  const supabase = await clienteServidor();
  return supabase.rpc('enviar_a_aseo', {
    p_producto_id: productoId,
    p_cantidad: cantidad,
    p_cuarto_id: cuartoId,
  });
}

export async function aseoListo(aseoId: string) {
  const supabase = await clienteServidor();
  return supabase.rpc('aseo_listo', { p_aseo_id: aseoId });
}

export async function buscarAseoPendiente() {
  const supabase = await clienteServidor();
  return supabase
    .from('aseo')
    .select('id, cantidad, enviado_at, productos(nombre, unidad), cuartos(numero), profiles(nombre)')
    .eq('estado', 'pendiente')
    .order('enviado_at', { ascending: false });
}
