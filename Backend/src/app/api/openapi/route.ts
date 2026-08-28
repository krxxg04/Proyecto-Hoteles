import { NextResponse } from 'next/server';
import { documentoOpenAPI } from '@/shared/docs/openapi';
import { docsHabilitados } from '@/shared/docs/habilitado';

/** GET /api/openapi -> la especificación en JSON (para Swagger, Postman o generar el cliente). */
export async function GET() {
  if (!docsHabilitados()) {
    return NextResponse.json({ ok: false, error: 'No disponible.' }, { status: 404 });
  }

  return NextResponse.json(documentoOpenAPI, { headers: { 'Cache-Control': 'no-store' } });
}
