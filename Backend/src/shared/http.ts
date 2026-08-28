import { NextResponse } from 'next/server';
import type { Resultado } from './resultado';

/** Puente entre los casos de uso y HTTP. Las rutas `/api` son solo la puerta; la lógica vive dentro. */
export function responder<T>(resultado: Resultado<T>, estadoOk = 200) {
  if (resultado.ok) {
    return NextResponse.json({ ok: true, datos: resultado.datos }, { status: estadoOk });
  }
  return NextResponse.json(
    { ok: false, error: resultado.error, campo: resultado.campo },
    { status: 400 }
  );
}

/** Convierte una excepción (p. ej. `exigirRol`) en JSON en vez de un 500. */
export async function intentar<T>(fn: () => Promise<Resultado<T>>) {
  try {
    return responder(await fn());
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Error inesperado';
    const estado = /sesión|permiso/i.test(mensaje) ? 403 : 500;
    return NextResponse.json({ ok: false, error: mensaje }, { status: estado });
  }
}

/** Lee el body JSON sin reventar si viene vacío o mal formado. */
export async function cuerpo(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
