import { clienteServidor } from '@/shared/supabase/servidor';

const CAMPOS =
  'id, huesped_id, nombre_contacto, telefono, tipo_id, cuarto_id, fecha_entrada, ' +
  'fecha_salida, personas, estado, origen, notas, estadia_id, created_at, ' +
  'tipos_cuarto(nombre), cuartos(numero)';

/** Las de aquí en adelante. Lo viejo solo estorba en el mostrador. */
export async function buscarReservas(desde: string, incluirCerradas: boolean) {
  const supabase = await clienteServidor();

  let q = supabase.from('reservas').select(CAMPOS).gte('fecha_entrada', desde);
  if (!incluirCerradas) q = q.in('estado', ['pendiente', 'confirmada']);

  return q.order('fecha_entrada').limit(200);
}

export async function guardar(valores: Record<string, unknown>, tenantId: string, id?: string) {
  const supabase = await clienteServidor();

  if (id) {
    return supabase.from('reservas').update(valores).eq('id', id).select(CAMPOS).single();
  }
  return supabase
    .from('reservas')
    .insert({ ...valores, tenant_id: tenantId })
    .select(CAMPOS)
    .single();
}

export async function cambiarEstado(id: string, estado: string) {
  const supabase = await clienteServidor();
  return supabase.from('reservas').update({ estado }).eq('id', id).select('id').single();
}

export async function buscarReserva(id: string) {
  const supabase = await clienteServidor();
  return supabase.from('reservas').select(CAMPOS).eq('id', id).single();
}
