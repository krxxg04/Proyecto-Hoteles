import { pedir } from '@/shared/api/servidor';
import type { Resultado } from '@/shared/api/contrato';
import type { Caracteristica, CuartoConTipo, TipoCuarto } from '../domain/tipos';

/** Lecturas desde Server Components. */
export async function listarCuartos(incluirInactivos = false): Promise<Resultado<CuartoConTipo[]>> {
  return pedir<CuartoConTipo[]>(`/api/cuartos${incluirInactivos ? '?inactivos=1' : ''}`);
}

export async function listarTiposCuarto(incluirInactivos = false): Promise<Resultado<TipoCuarto[]>> {
  return pedir<TipoCuarto[]>(`/api/cuartos?tipos=1${incluirInactivos ? '&inactivos=1' : ''}`);
}

/** Salen de `/api/catalogos`, que ya las sirve junto a los bancos para los formularios. */
export async function listarCaracteristicas(): Promise<Resultado<Caracteristica[]>> {
  const r = await pedir<{ caracteristicas: Caracteristica[] }>('/api/catalogos');
  return r.ok ? { ok: true, datos: r.datos.caracteristicas } : r;
}
