import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { CABECERA_ORIGEN, origenActual } from '../origen';

/** Cliente con la sesión del usuario: clave pública, cada consulta pasa por RLS. Este es el normal. */
export async function clienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Le dice a la auditoría quién escribe: una persona o el asistente. Ver `shared/origen.ts`.
      global: { headers: { [CABECERA_ORIGEN]: origenActual() } },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Los Server Components no pueden escribir cookies; el proxy ya refrescó la sesión.
          }
        },
      },
    }
  );
}
