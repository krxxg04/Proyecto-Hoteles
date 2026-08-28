/**
 * Contrato con el backend: siempre `{ ok, datos } | { ok, error, campo? }`.
 * Es el mismo que documenta `/api/openapi`.
 */
export type Resultado<T> =
  | { ok: true; datos: T }
  | { ok: false; error: string; campo?: string };

export type Opciones = { metodo?: string; cuerpo?: unknown };

export async function ejecutar<T>(
  url: string,
  opciones: Opciones,
  cookie?: string
): Promise<Resultado<T>> {
  try {
    const r = await fetch(url, {
      method: opciones.metodo ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
      // Sin caché: son datos operativos que cambian entre recepcionistas.
      cache: 'no-store',
      credentials: 'include',
    });

    const json = (await r.json()) as Resultado<T>;

    if (!r.ok && !('ok' in json)) {
      return { ok: false, error: 'No se pudo conectar con el servidor.' };
    }
    return json;
  } catch {
    return { ok: false, error: 'No se pudo conectar con el servidor. Revisa tu conexión.' };
  }
}
