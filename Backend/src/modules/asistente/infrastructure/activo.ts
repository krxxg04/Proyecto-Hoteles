import 'server-only';
import type { ProveedorIA } from './proveedor';
import { proveedorDeepSeek } from './deepseek';
import { proveedorClaude } from './claude';

/**
 * Quién interpreta lo que las reglas no reconocieron.
 *
 * DeepSeek primero por coste (ADR-003). Claude se queda como alternativa: basta poner su
 * clave y quitar la de DeepSeek. Y si no hay ninguna, `null` — el asistente funciona solo
 * con reglas, cubre las 9 acciones y lo dice en `GET /api/salud`. Degradar en silencio
 * sería peor: nadie sabría que la mitad del asistente no está encendida.
 *
 * Vive aquí y no dentro de un adaptador para que elegir proveedor no obligue a importar
 * los dos desde cualquier sitio que solo quería saber si hay alguno.
 */
export function proveedorActivo(): ProveedorIA | null {
  if (process.env.DEEPSEEK_API_KEY) return proveedorDeepSeek();
  if (process.env.ANTHROPIC_API_KEY) return proveedorClaude();
  return null;
}

/** Para `GET /api/salud`: qué falta, dicho con el nombre exacto de la variable. */
export function faltaClaveIA(): string {
  return 'solo reglas (falta DEEPSEEK_API_KEY)';
}
