import { clienteServidor } from '@/shared/supabase/servidor';

/**
 * La tabla `medios` tiene RLS por `tenant_id`, así que estas consultas ya salen
 * filtradas por hostal. Es lo que impide que alguien pida la URL firmada de una foto
 * ajena conociendo su id: no puede leer la fila, así que no hay `object_key` que firmar.
 */

const CAMPOS = 'id, bucket, object_key, mime, bytes, tipo, huesped_id, estadia_id, retener_hasta, created_at';

export async function registrar(valores: {
  tenant_id: string;
  bucket: string;
  object_key: string;
  mime: string;
  bytes: number;
  tipo: string;
  huesped_id: string | null;
  estadia_id: string | null;
  retener_hasta: string | null;
  subido_por: string;
}) {
  const supabase = await clienteServidor();
  return supabase.from('medios').insert(valores).select(CAMPOS).single();
}

export async function buscarMedio(id: string) {
  const supabase = await clienteServidor();
  return supabase.from('medios').select(CAMPOS).eq('id', id).single();
}

export async function listarDe(columna: 'huesped_id' | 'estadia_id', valor: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('medios')
    .select(CAMPOS)
    .eq(columna, valor)
    .order('created_at', { ascending: false });
}

export async function borrarFila(id: string) {
  const supabase = await clienteServidor();
  return supabase.from('medios').delete().eq('id', id);
}

/** ¿Este huésped consintió esta finalidad, y no lo ha revocado? (Ley 29733) */
export async function consentimientoVigente(huespedId: string, finalidad: string) {
  const supabase = await clienteServidor();
  return supabase
    .from('consentimientos')
    .select('id, otorgado, revocado_at')
    .eq('huesped_id', huespedId)
    .eq('finalidad', finalidad)
    .is('revocado_at', null)
    .eq('otorgado', true)
    .maybeSingle();
}

export async function registrarConsentimiento(valores: {
  tenant_id: string;
  huesped_id: string;
  finalidad: string;
  evidencia: string | null;
}) {
  const supabase = await clienteServidor();
  return supabase
    .from('consentimientos')
    .insert({ ...valores, otorgado: true, otorgado_at: new Date().toISOString() })
    .select('id')
    .single();
}
