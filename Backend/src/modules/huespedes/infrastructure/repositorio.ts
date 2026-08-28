import { clienteServidor } from '@/shared/supabase/servidor';

const CAMPOS =
  'id, nombre, tipo_doc, num_doc, telefono, email, nacionalidad, notas, requiere_revision, created_at';

export async function buscarHuespedes(busqueda?: string) {
  const supabase = await clienteServidor();

  let query = supabase.from('huespedes').select(CAMPOS).order('nombre');

  if (busqueda?.trim()) {
    const q = busqueda.trim();
    query = query.or(`nombre.ilike.%${q}%,num_doc.ilike.%${q}%`);
  }

  return query.limit(200);
}

export async function buscarHuesped(id: string) {
  const supabase = await clienteServidor();
  return supabase.from('huespedes').select(CAMPOS).eq('id', id).single();
}

export async function buscarPorDoc(tipoDoc: string, numDoc: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('huespedes')
    .select(CAMPOS)
    .eq('tipo_doc', tipoDoc)
    .eq('num_doc', numDoc.trim())
    .maybeSingle();
}

export async function crear(valores: Record<string, unknown>, tenantId: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('huespedes')
    .insert({ ...limpiar(valores), tenant_id: tenantId })
    .select(CAMPOS)
    .single();
}

export async function actualizar(id: string, valores: Record<string, unknown>) {
  const supabase = await clienteServidor();
  return supabase.from('huespedes').update(limpiar(valores)).eq('id', id).select(CAMPOS).single();
}

export async function marcarRevision(id: string, motivo: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('huespedes')
    .update({ requiere_revision: true, notas: motivo })
    .eq('id', id);
}

export async function quitarMarca(id: string) {
  const supabase = await clienteServidor();
  return supabase.from('huespedes').update({ requiere_revision: false }).eq('id', id);
}

export async function buscarEstadiasDe(id: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('estadias')
    .select(
      'id, fecha_entrada, fecha_salida, modo, noches, horas, personas, tarifa_total, estado, cuartos(numero)'
    )
    .eq('huesped_id', id)
    .order('fecha_entrada', { ascending: false })
    .limit(50);
}

/** Los campos de texto vacíos se guardan como NULL, no como cadena vacía. */
function limpiar<T extends Record<string, unknown>>(obj: T) {
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) salida[k] = v === '' ? null : v;
  return salida;
}
