import { clienteServidor } from '@/shared/supabase/servidor';

/**
 * Bitácora del asistente: qué se pidió, qué se detectó y si terminó ejecutándose.
 *
 * Va por las funciones SQL (`registrar_mensaje_asistente` / `marcar_mensaje_asistente`),
 * no por un `insert`/`update` directo: son ellas las que fijan `tenant_id` y `usuario_id`
 * con `current_tenant_id()`/`auth.uid()`, igual que cualquier otra escritura del proyecto.
 * Si falla, no debe tumbar la conversación — registrar es un extra, no el motivo de la llamada.
 */

export async function registrarMensaje(entrada: {
  texto: string;
  resultado: 'tarjeta' | 'pregunta' | 'sin_entender';
  accion?: string | null;
  origen?: 'reglas' | 'ia' | null;
}): Promise<string | null> {
  try {
    const supabase = await clienteServidor();
    const { data, error } = await supabase.rpc('registrar_mensaje_asistente', {
      p_texto: entrada.texto,
      p_resultado: entrada.resultado,
      p_accion: entrada.accion ?? null,
      p_origen: entrada.origen ?? null,
    });
    if (error) return null;
    return data as string;
  } catch {
    return null;
  }
}

export async function marcarMensaje(
  registroId: string | undefined,
  confirmada: boolean,
  error?: string
): Promise<void> {
  if (!registroId) return;
  try {
    const supabase = await clienteServidor();
    await supabase.rpc('marcar_mensaje_asistente', {
      p_id: registroId,
      p_confirmada: confirmada,
      p_error: error ?? null,
    });
  } catch {
    // Registrar es un extra: si falla, la ejecución real ya pasó y no hay que deshacerla.
  }
}
