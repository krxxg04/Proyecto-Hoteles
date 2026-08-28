import { clienteServidor } from '@/shared/supabase/servidor';

/** Traduce DNI -> email sintético. Accesible sin sesión, pero solo devuelve el slug del hostal. */
export async function resolverLogin(dni: string) {
  const supabase = await clienteServidor();
  return supabase
    .rpc('resolver_login', { p_dni: dni })
    .maybeSingle<{ slug: string; email: string }>();
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
  return supabase.from('tenants').select('nombre, plan').single();
}
