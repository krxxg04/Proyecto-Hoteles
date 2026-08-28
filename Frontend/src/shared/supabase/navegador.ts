import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase en el navegador. Se usa SOLO para Realtime.
 *
 * Todo lo demás sigue yendo por HTTP al backend: leer y escribir desde aquí duplicaría
 * la lógica de negocio en el cliente, que es justo lo que el ADR-002 evita.
 *
 * Sobre el gate #2 de CLAUDE.md: lo que viaja aquí es la clave **pública** (anon), que
 * está pensada para el navegador y no da acceso a nada por sí sola — cada suscripción
 * pasa por el RLS con el JWT de la sesión. La `service_role` no toca el cliente jamás.
 *
 * La sesión sale de la misma cookie que pone el backend al entrar: viaja al navegador
 * a través del rewrite de `next.config.ts`, así que es del mismo origen y legible aquí.
 */

let cliente: SupabaseClient | null = null;

export function clienteNavegador(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin configurar, la app funciona igual: solo pierde el "en vivo" y hay que recargar.
  if (!url || !anon) return null;

  cliente ??= createBrowserClient(url, anon);
  return cliente;
}
