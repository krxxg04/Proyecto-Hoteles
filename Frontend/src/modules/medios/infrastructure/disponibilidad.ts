/** Sin claves de R2 el backend solo puede devolver un error, así que el control de foto no se ofrece. */
async function consultar(): Promise<boolean> {
  try {
    const r = await fetch('/api/salud', { cache: 'no-store' });
    if (!r.ok) return false;
    const salud = (await r.json()) as { medios?: string };
    return typeof salud.medios === 'string' && !salud.medios.startsWith('sin configurar');
  } catch {
    return false;
  }
}

let promesa: Promise<boolean> | null = null;

/** Una sola consulta por carga de página, aunque se monten varios controles. */
export function mediosDisponibles(): Promise<boolean> {
  promesa ??= consultar();
  return promesa;
}
