import { iniciarSesion, cerrarSesion, miSesion } from '@/modules/auth/application/sesion';
import { intentar, cuerpo } from '@/shared/http';
import { NextResponse } from 'next/server';

/** POST /api/auth  -> login con { dni, pin } */
export async function POST(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => iniciarSesion(body as { dni: string; pin: string }));
}

/** GET /api/auth -> quién está conectado */
export async function GET() {
  const sesion = await miSesion();
  return NextResponse.json({ ok: true, datos: sesion });
}

/** DELETE /api/auth -> cerrar sesión */
export async function DELETE() {
  return intentar(() => cerrarSesion());
}
