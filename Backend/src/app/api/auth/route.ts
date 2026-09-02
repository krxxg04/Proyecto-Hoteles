import {
  iniciarSesion,
  cerrarSesion,
  miSesion,
  cambiarMiPin,
} from '@/modules/auth/application/sesion';
import { intentar, cuerpo } from '@/shared/http';
import { NextResponse } from 'next/server';

/** POST /api/auth -> login con { dni, pin, hostal? }. El hostal solo si el DNI está en varios. */
export async function POST(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => iniciarSesion(body as never));
}

/** GET /api/auth -> quién está conectado */
export async function GET() {
  const sesion = await miSesion();
  return NextResponse.json({ ok: true, datos: sesion });
}

/**
 * PATCH /api/auth -> cambiar el PIN propio con { pinActual, pinNuevo }.
 *
 * Existía el caso de uso y no la ruta, así que nadie podía cambiar su PIN: solo un
 * administrador podía reiniciar el de otra persona.
 */
export async function PATCH(request: Request) {
  const body = await cuerpo(request);
  return intentar(() => cambiarMiPin(body as never));
}

/** DELETE /api/auth -> cerrar sesión */
export async function DELETE() {
  return intentar(() => cerrarSesion());
}
