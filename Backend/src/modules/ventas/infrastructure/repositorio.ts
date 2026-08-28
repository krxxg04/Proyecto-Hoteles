import { clienteServidor } from '@/shared/supabase/servidor';

const CAMPOS =
  'id, turno_id, concepto, producto_id, cantidad, cuarto_id, monto, medio, banco, created_at';

/** El INSERT directo sobre `ventas` está revocado: precio y stock se resuelven dentro de la RPC. */
export async function registrar(p: {
  producto_id: string;
  cantidad: number;
  cuarto_id: string | null;
  medio: string;
  banco: string | null;
}) {
  const supabase = await clienteServidor();
  return supabase.rpc('registrar_venta', {
    p_producto_id: p.producto_id,
    p_cantidad: p.cantidad,
    p_cuarto_id: p.cuarto_id,
    p_medio: p.medio,
    p_banco: p.banco,
    p_moneda_orig: null,
    p_monto_orig: null,
  });
}

export async function buscarVentas(turnoId?: string) {
  const supabase = await clienteServidor();

  let query = supabase.from('ventas').select(CAMPOS).order('created_at', { ascending: false });

  if (turnoId) {
    query = query.eq('turno_id', turnoId);
  } else {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    query = query.gte('created_at', hoy.toISOString());
  }

  return query.limit(300);
}

export async function turnoAbierto() {
  const supabase = await clienteServidor();
  return supabase.rpc('turno_abierto');
}

export async function buscarMontosDelTurno(turnoId: string) {
  const supabase = await clienteServidor();
  return supabase.from('ventas').select('monto, medio').eq('turno_id', turnoId);
}

export async function buscarVentasConProducto(desde: string, hasta: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('ventas')
    .select('producto_id, cantidad, monto, productos(nombre, unidad)')
    .not('producto_id', 'is', null)
    .gte('created_at', desde)
    .lte('created_at', hasta);
}

/** Catálogo global de bancos. `ventas.banco` es una FK contra él: no vale texto libre. */
export async function buscarBancos() {
  const supabase = await clienteServidor();
  return supabase.from('bancos').select('clave, label').order('orden');
}
