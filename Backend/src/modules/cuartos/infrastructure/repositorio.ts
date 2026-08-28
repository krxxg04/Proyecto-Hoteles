import { clienteServidor } from '@/shared/supabase/servidor';
import type { EstadoCuarto } from '../domain/tipos';
import type { ModoEstadia } from '@/modules/estadias/domain/tipos';

export const CAMPOS =
  'id, numero, tipo_id, estado, nota, aforo, caracteristicas, tarifa_costo, tarifa_amanecida, activo';

export async function buscarCuartos(estado?: EstadoCuarto) {
  const supabase = await clienteServidor();

  let query = supabase
    .from('cuartos')
    .select(`${CAMPOS}, tipos_cuarto(nombre)`)
    .eq('activo', true)
    .order('numero');

  if (estado) query = query.eq('estado', estado);
  return query;
}

export async function buscarEstados() {
  const supabase = await clienteServidor();
  return supabase.from('cuartos').select('estado').eq('activo', true);
}

export async function buscarCuarto(id: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('cuartos')
    .select(
      `${CAMPOS}, tipos_cuarto(*), estadias(id, huesped_id, fecha_entrada, fecha_salida, personas, tarifa_total, estado, huespedes(nombre, num_doc))`
    )
    .eq('id', id)
    .single();
}

export async function cambiarEstado(cuartoId: string, estado: EstadoCuarto, nota: string | null) {
  const supabase = await clienteServidor();
  return supabase.rpc('cambiar_estado_cuarto', {
    p_cuarto_id: cuartoId,
    p_estado: estado,
    p_nota: nota,
  });
}

/**
 * Cuándo se dejó lista por última vez.
 *
 * Sale del historial de estados y no de una columna en `cuartos`: la columna habría
 * que acordarse de escribirla, y el historial ya lo llena un trigger.
 */
export async function buscarUltimaLimpieza(cuartoId: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('cuarto_estado_log')
    .select('created_at, estado_new, profiles(nombre)')
    .eq('cuarto_id', cuartoId)
    .eq('estado_new', 'lista')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

/** La siguiente reserva de este cuarto. Hoy la tabla está vacía; la vista lo dice. */
export async function buscarProximaReserva(cuartoId: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('reservas')
    .select('id, fecha_entrada, personas, nombre_contacto, estado')
    .eq('cuarto_id', cuartoId)
    .in('estado', ['pendiente', 'confirmada'])
    .gte('fecha_entrada', new Date().toISOString().slice(0, 10))
    .order('fecha_entrada')
    .limit(1)
    .maybeSingle();
}

export async function buscarHistorialEstados(cuartoId: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('cuarto_estado_log')
    .select('id, estado_ant, estado_new, created_at, profiles(nombre)')
    .eq('cuarto_id', cuartoId)
    .order('created_at', { ascending: false })
    .limit(50);
}

export async function calcularTarifa(params: {
  cuarto_id: string;
  modo: ModoEstadia;
  horas: number | null;
  noches: number | null;
  fecha_entrada: string;
}) {
  const supabase = await clienteServidor();
  return supabase.rpc('calcular_tarifa', {
    p_cuarto_id: params.cuarto_id,
    p_modo: params.modo,
    p_horas: params.horas,
    p_noches: params.noches,
    p_fecha_entrada: params.fecha_entrada,
  });
}

export async function sugerir(personas: number, caracteristicas: string[]) {
  const supabase = await clienteServidor();
  return supabase.rpc('sugerir_cuarto', {
    p_personas: personas,
    p_caracteristicas: caracteristicas,
  });
}

export async function buscarTiposCuarto() {
  const supabase = await clienteServidor();
  return supabase.from('tipos_cuarto').select('*').eq('activo', true).order('nombre');
}

export async function guardarTipo(valores: object, tenantId: string, id?: string) {
  const supabase = await clienteServidor();
  const query = id
    ? supabase.from('tipos_cuarto').update(valores).eq('id', id)
    : supabase.from('tipos_cuarto').insert({ ...valores, tenant_id: tenantId });
  return query.select('*').single();
}

export async function guardar(valores: object, tenantId: string, id?: string) {
  const supabase = await clienteServidor();
  const query = id
    ? supabase.from('cuartos').update(valores).eq('id', id)
    : supabase.from('cuartos').insert({ ...valores, tenant_id: tenantId });
  return query.select(CAMPOS).single();
}

export async function estadiaActivaDe(cuartoId: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('estadias')
    .select('id')
    .eq('cuarto_id', cuartoId)
    .eq('estado', 'activa')
    .maybeSingle();
}

export async function desactivar(id: string) {
  const supabase = await clienteServidor();
  return supabase.from('cuartos').update({ activo: false }).eq('id', id);
}

export async function buscarCaracteristicas() {
  const supabase = await clienteServidor();
  return supabase.from('caracteristicas').select('clave, label, icono').order('orden');
}
