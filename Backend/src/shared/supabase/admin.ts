import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * `service_role`: IGNORA EL RLS, ve y escribe los datos de TODOS los hostales. Gate #2 de CLAUDE.md.
 * Solo para lo que no puede pasar por RLS (alta de personal y de hostales), nunca para esquivar un
 * error de permisos. Quien lo use verifica rol y hostal A MANO: aquí Postgres ya no protege.
 */
export function clienteAdmin() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY. Revisa el .env.local del proyecto.');
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, clave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
