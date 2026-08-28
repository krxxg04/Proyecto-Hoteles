import 'server-only';
import { cookies } from 'next/headers';
import { ejecutar, type Opciones, type Resultado } from './contrato';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000';

/**
 * Llamada desde un Server Component.
 *
 * La cookie de sesión hay que copiarla a mano: un fetch server-to-server no la lleva sola.
 */
export async function pedir<T>(ruta: string, opciones: Opciones = {}): Promise<Resultado<T>> {
  const tarro = await cookies();
  const cabecera = tarro
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  return ejecutar<T>(`${BACKEND}${ruta}`, opciones, cabecera);
}
