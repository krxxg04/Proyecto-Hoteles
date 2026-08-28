/**
 * Supabase infiere las relaciones incrustadas como arreglo aunque sean 1:1.
 *
 * `cuartos(numero)` en un select devuelve `{ numero }` en tiempo de ejecución, pero el
 * tipo generado dice `{ numero }[]`. Normalizar en cada consulta a mano era ruido
 * repetido en tres módulos.
 */
export function uno<T>(valor: T | T[] | null | undefined): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}
