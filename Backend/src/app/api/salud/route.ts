import { NextResponse } from 'next/server';
import { proveedorActivo } from '@/modules/asistente/infrastructure/claude';
import { r2Configurado } from '@/modules/medios/infrastructure/r2';

/** Ping público. Confirma que el servidor levantó y qué tiene configurado. */
export async function GET() {
  const proveedor = proveedorActivo();

  return NextResponse.json({
    ok: true,
    servicio: 'hostal-backend',
    supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    // Solo el nombre del modelo, nunca la clave.
    ia: proveedor ? proveedor.nombre : 'solo reglas (falta ANTHROPIC_API_KEY)',
    medios: r2Configurado() ? 'r2 (bucket privado)' : 'sin configurar (faltan claves de R2)',
  });
}
