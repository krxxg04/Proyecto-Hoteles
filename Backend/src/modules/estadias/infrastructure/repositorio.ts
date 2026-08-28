import { clienteServidor } from '@/shared/supabase/servidor';

type ParamsCheckin = {
  cuarto_id: string;
  modo: string;
  nombre: string;
  tipo_doc: string;
  num_doc: string;
  telefono: string | null;
  horas: number | null;
  noches: number | null;
  fecha_entrada: string;
  personas: number;
  medio: string;
  banco: string | null;
  acompanantes: unknown[];
};

/** Una sola llamada: huésped, tarifa, estadía, cuarto y cobro dentro de la misma transacción. */
export async function registrar(p: ParamsCheckin) {
  const supabase = await clienteServidor();
  return supabase.rpc('registrar_checkin', {
    p_cuarto_id: p.cuarto_id,
    p_modo: p.modo,
    p_nombre: p.nombre,
    p_tipo_doc: p.tipo_doc,
    p_num_doc: p.num_doc,
    p_telefono: p.telefono,
    p_horas: p.horas,
    p_noches: p.noches,
    p_fecha_entrada: p.fecha_entrada,
    p_personas: p.personas,
    p_medio: p.medio,
    p_banco: p.banco,
    p_acompanantes: p.acompanantes,
  });
}

export async function cerrar(estadiaId: string) {
  const supabase = await clienteServidor();
  return supabase.rpc('registrar_checkout', { p_estadia_id: estadiaId });
}

export async function buscarActivas() {
  const supabase = await clienteServidor();
  return supabase
    .from('estadias')
    .select(
      `
      id, modo, horas, noches, fecha_entrada, fecha_salida, hora_entrada,
      personas, tarifa_total, deposito, estado,
      cuartos(id, numero),
      huespedes(id, nombre, tipo_doc, num_doc, telefono)
    `
    )
    .eq('estado', 'activa')
    .order('fecha_salida');
}

export async function buscarEstadia(id: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('estadias')
    .select(
      `
      *,
      cuartos(numero, tipos_cuarto(nombre)),
      huespedes(nombre, tipo_doc, num_doc, telefono),
      acompanantes(nombre, tipo_doc, num_doc)
    `
    )
    .eq('id', id)
    .single();
}

export async function guardarInspeccionEn(valores: {
  tenant_id: string;
  cuarto_id: string;
  estadia_id: string | null;
  resultado: unknown;
  nota: string | null;
  medio_id: string | null;
  actor_id: string;
}) {
  const supabase = await clienteServidor();
  return supabase.from('inspecciones').insert(valores).select('id').single();
}

/** El cuarto y su última estadía cerrada: lo que hay que inspeccionar tras el check-out. */
export async function buscarCuartoAInspeccionar(cuartoId: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('cuartos')
    .select('id, numero, estado')
    .eq('id', cuartoId)
    .single();
}

export async function buscarUltimaEstadiaDe(cuartoId: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('estadias')
    .select('id, estado, hora_salida')
    .eq('cuarto_id', cuartoId)
    .order('hora_entrada', { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function buscarInspecciones(cuartoId?: string) {
  const supabase = await clienteServidor();
  let q = supabase
    .from('inspecciones')
    .select('id, cuarto_id, estadia_id, resultado, nota, medio_id, created_at, cuartos(numero)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (cuartoId) q = q.eq('cuarto_id', cuartoId);
  return q;
}
