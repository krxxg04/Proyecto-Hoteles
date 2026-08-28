import { clienteServidor } from '@/shared/supabase/servidor';

export async function abrir(efectivoContado: number, justificacion: string | null) {
  const supabase = await clienteServidor();
  return supabase.rpc('abrir_turno', {
    p_efectivo_contado: efectivoContado,
    p_justificacion: justificacion,
  });
}

export async function buscarEstadoCaja() {
  const supabase = await clienteServidor();
  return supabase.from('caja_estado').select('sencillo, caja_chica').maybeSingle();
}

export async function buscarTurnoAbierto() {
  const supabase = await clienteServidor();
  return supabase
    .from('turnos')
    // `turnos` apunta a `profiles` dos veces (usuario_id y cerrado_por): sin desambiguar,
    // PostgREST rechaza el embed por ambiguo.
    .select(
      'id, usuario_id, estado, abierto_at, cerrado_at, sencillo_esperado, sencillo_apertura, sencillo_dejado, profiles!usuario_id(nombre)'
    )
    .eq('estado', 'abierto')
    .maybeSingle();
}

export async function idTurnoAbierto() {
  const supabase = await clienteServidor();
  return supabase.rpc('turno_abierto');
}

export async function esperadoCierre(turnoId: string) {
  const supabase = await clienteServidor();
  return supabase.rpc('esperado_cierre', { p_turno_id: turnoId });
}

/** Todo el cierre en una transacción: un descuadre sin justificar aborta el conjunto. */
export async function cerrar(p: {
  conteos: unknown[];
  sencillo_dejar: number;
  ajuste_monto: number | null;
  ajuste_razon: string | null;
}) {
  const supabase = await clienteServidor();
  return supabase.rpc('cerrar_turno', {
    p_conteos: p.conteos,
    p_sencillo_dejar: p.sencillo_dejar,
    p_ajuste_monto: p.ajuste_monto,
    p_ajuste_razon: p.ajuste_razon,
  });
}

export async function buscarCierres(limite: number) {
  const supabase = await clienteServidor();
  return supabase
    .from('cierres_caja')
    .select(
      'id, recaudado, por_medio, por_banco, efectivo_en_caja, sencillo_dejado, a_caja_chica, ajuste_monto, ajuste_razon, incidencias_count, created_at, profiles(nombre)'
    )
    .order('created_at', { ascending: false })
    .limit(limite);
}

export async function buscarIncidencias(soloAbiertas: boolean) {
  const supabase = await clienteServidor();

  let query = supabase
    .from('incidencias')
    .select(
      'id, turno_id, producto_id, concepto, unidad, esperado, contado, diferencia, justificacion, estado, created_at'
    )
    .order('created_at', { ascending: false });

  if (soloAbiertas) query = query.eq('estado', 'abierta');
  return query.limit(100);
}

export async function marcarRevisada(id: string) {
  const supabase = await clienteServidor();
  return supabase.rpc('revisar_incidencia', { p_incidencia_id: id });
}
