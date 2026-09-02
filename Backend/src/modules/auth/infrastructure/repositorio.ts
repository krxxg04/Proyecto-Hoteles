import { clienteServidor } from '@/shared/supabase/servidor';
import { clienteAdmin } from '@/shared/supabase/admin';

/**
 * Traduce DNI (+ hostal) -> email sintético `<dni>@<slug>.hostal.local`.
 *
 * Va con `service_role` a propósito: cuando lo resolvía el navegador con la clave pública,
 * `resolver_login` tenía que estar concedida a `anon`, y eso convertía el login en un
 * oráculo — cualquiera podía preguntar en qué hostal trabaja un DNI. Migración 14.
 */
export async function resolverLogin(dni: string, hostal?: string) {
  return clienteAdmin().rpc('resolver_login', {
    p_dni: dni,
    p_slug: hostal ?? null,
  }) as unknown as Promise<{
    data: Array<{ slug: string; email: string; hostal: string }> | null;
    error: { message: string } | null;
  }>;
}

/** Baja la bandera de PIN temporal. Solo después de que la contraseña cambió de verdad. */
export async function marcarPinPropio() {
  const supabase = await clienteServidor();
  return supabase.rpc('marcar_pin_propio');
}

/**
 * ¿Le pusieron un PIN temporal? Sale del perfil, no del JWT.
 *
 * Con el id explícito: el RLS de `profiles` deja ver a todo el personal del hostal, así
 * que un `.single()` sin filtrar revienta en cuanto hay más de una persona.
 */
export async function miPerfilPin(usuarioId: string) {
  const supabase = await clienteServidor();
  return supabase.from('profiles').select('pin_temporal').eq('id', usuarioId).single();
}

export async function entrar(email: string, pin: string) {
  const supabase = await clienteServidor();
  return supabase.auth.signInWithPassword({ email, password: pin });
}

export async function salir() {
  const supabase = await clienteServidor();
  return supabase.auth.signOut();
}

export async function cambiarPin(pinNuevo: string) {
  const supabase = await clienteServidor();
  return supabase.auth.updateUser({ password: pinNuevo });
}

/** El hostal de quien está conectado. El RLS ya limita `tenants` a su propia fila. */
export async function miHostal() {
  const supabase = await clienteServidor();
  return supabase.from('tenants').select('nombre, plan, slug').single();
}
