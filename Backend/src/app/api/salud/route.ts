import { NextResponse } from 'next/server';
import { proveedorActivo } from '@/modules/asistente/infrastructure/claude';
import { r2Configurado } from '@/modules/medios/infrastructure/r2';
import { clienteAdmin } from '@/shared/supabase/admin';

/**
 * Ping público. Confirma que el servidor levantó y qué tiene configurado.
 *
 * Con `?db=1` además toca Postgres. Va detrás de un parámetro a propósito:
 *
 *   - El `healthCheckPath` de Render pega aquí seguido. Si la respuesta dependiera de la
 *     base, un hipo de Supabase haría que Render **reinicie un servicio sano**.
 *   - Pero un proyecto Supabase del plan gratuito **se pausa tras 7 días sin actividad**, y
 *     el keep-alive que solo miraba variables de entorno no lo despertaba: el backend
 *     quedaba caliente y la base dormida. La demo aparecía caída sin motivo aparente.
 *
 * La consulta es fija y no devuelve datos, solo si respondió y en cuánto: no hay nada que
 * filtrar aunque el endpoint sea público.
 */
export async function GET(request: Request) {
  const proveedor = proveedorActivo();
  const tocarBase = !!new URL(request.url).searchParams.get('db');

  const base = tocarBase ? await latido() : null;

  return NextResponse.json({
    ok: base ? base.ok : true,
    servicio: 'hostal-backend',
    supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    // Solo el nombre del modelo, nunca la clave.
    ia: proveedor ? proveedor.nombre : 'solo reglas (falta ANTHROPIC_API_KEY)',
    medios: r2Configurado() ? 'r2 (bucket privado)' : 'sin configurar (faltan claves de R2)',
    ...(base ? { base } : {}),
  });
}

/** Una consulta mínima que sí llega a Postgres. Cuenta filas, no las trae. */
async function latido() {
  const empezo = Date.now();

  try {
    const { error } = await clienteAdmin()
      .from('tenants')
      .select('*', { head: true, count: 'exact' });

    if (error) return { ok: false, error: error.message, ms: Date.now() - empezo };
    return { ok: true, ms: Date.now() - empezo };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'no se pudo consultar',
      ms: Date.now() - empezo,
    };
  }
}
