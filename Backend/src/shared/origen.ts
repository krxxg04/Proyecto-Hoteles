import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * De dónde viene una escritura: de una persona usando la interfaz (`app`), del
 * asistente de IA tras confirmarse una tarjeta (`asistente`) o de un script (`sistema`).
 *
 * `ai-media.md` pide registrar en auditoría lo que hace la IA. El `audit_log` ya
 * guardaba la escritura, pero no de dónde venía.
 *
 * El valor viaja hasta Postgres como cabecera `x-origen`: PostgREST la expone en
 * `request.headers` y el trigger `fn_audit()` la lee. Así no hay que meter un
 * parámetro extra en cada función de negocio ni en cada repositorio.
 */

export type Origen = 'app' | 'asistente' | 'sistema';

export const CABECERA_ORIGEN = 'x-origen';

/**
 * `AsyncLocalStorage` y no un parámetro: `ejecutar()` del asistente llama a casos de
 * uso de otros seis módulos, y cada uno abre su propio cliente varias capas abajo.
 * Marcar el contexto una vez es lo único que no obliga a tocar todas esas firmas.
 */
const almacen = new AsyncLocalStorage<Origen>();

/** Todo lo que se escriba dentro de `fn` queda auditado con ese origen. */
export function conOrigen<T>(origen: Origen, fn: () => Promise<T>): Promise<T> {
  return almacen.run(origen, fn);
}

export function origenActual(): Origen {
  return almacen.getStore() ?? 'app';
}
